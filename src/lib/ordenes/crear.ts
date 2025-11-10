import type { PrismaClient } from '@prisma/client'

import { calcularProgresoOrden, generateCodigoOrden, isUniqueConstraintError } from './helpers'
import type { CrearOrdenInput } from './validators'
import { OrdenServiceError } from './errors'
import { prepararContextoCreacion } from './crear/validaciones'
import { calcularEstimaciones } from './crear/estimaciones'
import { crearDetallesYReservas } from './crear/reservas'
import { invalidateIndicators } from '@/lib/indicadores/cache'

export interface CrearOrdenResultado {
  status: number
  body: unknown
}

export async function crearOrden(prisma: PrismaClient, data: CrearOrdenInput, usuarioId: number): Promise<CrearOrdenResultado> {
  const contexto = await prepararContextoCreacion(prisma, data)
  const estimaciones = calcularEstimaciones(contexto, data)
  const { itemsValidados } = contexto

  let transaccionCreada: { id_transaccion: number; fecha_fin_estimada: Date | null } | null = null
  let codigoFinal = ''

  for (let intento = 0; intento < 3 && !transaccionCreada; intento++) {
    const codigoOrden = await generateCodigoOrden(prisma)
    try {
      transaccionCreada = await prisma.$transaction(async (tx) => {
        const transaccion = await tx.transaccion.create({
          data: {
            persona: { connect: { id_persona: contexto.cliente.id_persona } },
            usuario: { connect: { id_usuario: usuarioId } },
            ...(contexto.trabajadorPrincipalId && {
              trabajador_principal: { connect: { id_trabajador: contexto.trabajadorPrincipalId } },
            }),
            tipo_transaccion: 'orden',
            tipo_comprobante: 'orden_trabajo',
            codigo_transaccion: codigoOrden,
            fecha: new Date(),
            descuento: 0,
            impuesto: estimaciones.impuesto,
            porcentaje: 18,
            total: estimaciones.total,
            observaciones: data.observaciones,
            estado_orden: estimaciones.estadoInicialOrden,
            prioridad: data.prioridad || 'media',
            ...(estimaciones.fechaFinCalculada ? { fecha_fin_estimada: estimaciones.fechaFinCalculada } : {}),
            duracion_min: contexto.totalMinutosMin > 0 ? contexto.totalMinutosMin : null,
            duracion_max: contexto.totalMinutosMax > 0 ? contexto.totalMinutosMax : null,
            unidad_tiempo: contexto.totalMinutosMin > 0 || contexto.totalMinutosMax > 0 ? 'minutos' : null,
          },
        })

        await tx.transaccionVehiculo.create({
          data: {
            id_transaccion: transaccion.id_transaccion,
            id_vehiculo: contexto.idVehiculo,
            id_usuario: usuarioId,
            descripcion: `Orden de trabajo: ${codigoOrden}`,
          },
        })

        for (const idTrabSec of contexto.trabajadoresSecundarios) {
          if (contexto.trabajadorPrincipalId && idTrabSec === contexto.trabajadorPrincipalId) continue
          try {
            await tx.transaccionTrabajador.create({
              data: { id_transaccion: transaccion.id_transaccion, id_trabajador: idTrabSec, rol: 'apoyo' },
            })
          } catch (error) {
            if (!isUniqueConstraintError(error)) {
              console.warn('Pivot trabajador duplicado u error', error)
            }
          }
        }

        await crearDetallesYReservas(tx, itemsValidados, {
          transaccionId: transaccion.id_transaccion,
          codigoOrden,
          trabajadorAsignadoInicial: estimaciones.trabajadorAsignadoInicial,
          estadoInicialTarea: estimaciones.estadoInicialTarea,
          almacenReservaFallback: contexto.almacenReservaId,
          usuarioId,
        })

        return transaccion
      })
      codigoFinal = codigoOrden
    } catch (error) {
      if (isUniqueConstraintError(error) && intento < 2) {
        continue
      }
      throw error
    }
  }

  if (!transaccionCreada) {
    throw new OrdenServiceError(500, 'No se pudo generar código de orden único')
  }

  try {
    const { logEvent } = await import('@/lib/bitacora/log-event')
    await logEvent({
      prismaClient: prisma,
      usuarioId,
      accion: 'CREATE_ORDEN',
      descripcion: `Orden creada: ${codigoFinal} - Cliente: ${contexto.cliente.persona.nombre} ${contexto.cliente.persona.apellido_paterno}`,
      tabla: 'transaccion',
    })
  } catch (err) {
    console.error('[ordenes] no se pudo registrar en bitácora:', err)
  }

  void invalidateIndicators({ prefix: 'mantenimientos.' }).catch((err) => {
    console.error('[indicadores] fallo invalidando cache tras crear orden', err)
  })

  const ordenCompleta = await prisma.transaccion.findUnique({
    where: { id_transaccion: transaccionCreada.id_transaccion },
    include: {
      persona: true,
      trabajador_principal: { include: { usuario: { include: { persona: true } } } },
      transaccion_vehiculos: { include: { vehiculo: { include: { modelo: { include: { marca: true } } } } } },
      detalles_transaccion: {
        include: {
          producto: true,
          servicio: true,
          tareas: true,
          servicio_asociado: { include: { servicio: true, producto: true } },
          productos_asociados: { include: { producto: true } },
        },
      },
      _count: { select: { detalles_transaccion: true } },
    },
  })

  if (!ordenCompleta) {
    throw new OrdenServiceError(500, 'No se pudo recuperar la orden creada')
  }

  const progreso = await calcularProgresoOrden(prisma, ordenCompleta.id_transaccion)

  const tareasPendientes = itemsValidados.filter((item) => item.tipo === 'servicio' && !(
    contexto.trabajadorPrincipalId ?? contexto.trabajadoresSecundarios[0]
  )).length

  return {
    status: 201,
    body: {
      ...ordenCompleta,
      resumen: {
        subtotal: Number(contexto.subtotal.toFixed(2)),
        impuesto: Number(estimaciones.impuesto.toFixed(2)),
        total: Number(estimaciones.total.toFixed(2)),
        tareas_pendientes_generar: tareasPendientes,
        tiempo_estimado_min: contexto.totalMinutosMin,
        tiempo_estimado_max: contexto.totalMinutosMax,
        fecha_fin_estimada: transaccionCreada.fecha_fin_estimada ?? estimaciones.fechaFinCalculada ?? null,
        progreso,
      },
    },
  }
}
