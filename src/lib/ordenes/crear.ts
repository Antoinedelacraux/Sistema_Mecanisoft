import type { PrismaClient } from '@prisma/client'
import { reservarStockEnTx } from '@/lib/inventario/reservas'
import { calcularProgresoOrden, convertirATotalMinutos, generateCodigoOrden, isUniqueConstraintError, toInt } from './helpers'
import type { CrearOrdenInput } from './validators'
import { OrdenServiceError } from './errors'

interface ItemValidado {
  id_producto?: number
  id_servicio?: number
  cantidad: number
  precio: number
  descuento: number
  total: number
  tipo: 'producto' | 'servicio'
  servicio_ref?: number
  almacenId?: number
  ubicacionId?: number | null
  tiempo_servicio?: {
    minimo: number
    maximo: number
    unidad: string
    minimoMinutos: number
    maximoMinutos: number
  }
}

export interface CrearOrdenResultado {
  status: number
  body: unknown
}

export async function crearOrden(prisma: PrismaClient, data: CrearOrdenInput, usuarioId: number): Promise<CrearOrdenResultado> {
  const id_cliente = toInt(data.id_cliente)
  const id_vehiculo = toInt(data.id_vehiculo)
  const id_trabajador_principal = toInt(data.id_trabajador_principal)
  const trabajadoresSecundarios = (data.trabajadores_secundarios || []).map(toInt).filter((n): n is number => Boolean(n))

  if (!id_cliente || !id_vehiculo) {
    throw new OrdenServiceError(400, 'Cliente o vehículo inválido')
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente },
    include: { persona: true }
  })
  if (!cliente || !cliente.estatus) {
    throw new OrdenServiceError(400, 'El cliente no existe o está inactivo')
  }

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id_vehiculo },
    include: { modelo: { include: { marca: true } } }
  })
  if (!vehiculo || vehiculo.id_cliente !== id_cliente) {
    throw new OrdenServiceError(400, 'El vehículo no pertenece al cliente seleccionado')
  }

  if (id_trabajador_principal) {
    const trabajador = await prisma.trabajador.findUnique({
      where: { id_trabajador: id_trabajador_principal },
      select: { id_trabajador: true, activo: true }
    })
    if (!trabajador || !trabajador.activo) {
      throw new OrdenServiceError(400, 'El trabajador seleccionado no está disponible')
    }
  }

  const almacenPrincipal = await prisma.almacen.findFirst({
    where: { activo: true },
    orderBy: { id_almacen: 'asc' }
  })
  if (!almacenPrincipal) {
    throw new OrdenServiceError(409, 'No hay almacenes activos configurados')
  }
  const almacenReservaId = almacenPrincipal.id_almacen

  const productoIds = [...new Set(data.items.map((i) => toInt(i.id_producto)).filter((n): n is number => Boolean(n)))]
  const [productos, servicios] = await Promise.all([
    prisma.producto.findMany({ where: { id_producto: { in: productoIds } } }),
    prisma.servicio.findMany({ where: { id_servicio: { in: productoIds } } })
  ])
  const productosMap = new Map(productos.map((p) => [p.id_producto, p]))
  const serviciosMap = new Map(servicios.map((s) => [s.id_servicio, s]))

  let subtotal = 0
  let totalMinutosMin = 0
  let totalMinutosMax = 0
  const itemsValidados: ItemValidado[] = []

  const modoSoloServicios = (data.modo_orden || 'servicios_y_productos') === 'solo_servicios'

  for (const raw of data.items) {
    if (modoSoloServicios && raw.tipo === 'producto') {
      throw new OrdenServiceError(400, 'Modo Solo servicios activo: no se permiten productos en la orden.')
    }

    const id_producto = toInt(raw.id_producto)
    if (!id_producto) {
      throw new OrdenServiceError(400, 'ID de producto/servicio inválido')
    }

    const tipoSolicitado = raw.tipo
    const producto = productosMap.get(id_producto)
    const servicio = serviciosMap.get(id_producto)

    let tipo: 'producto' | 'servicio'
    if (tipoSolicitado === 'producto') {
      if (!producto || producto.estatus === false) {
        throw new OrdenServiceError(400, `Producto con ID ${id_producto} no está disponible`)
      }
      tipo = 'producto'
    } else if (tipoSolicitado === 'servicio') {
      if (!servicio || servicio.estatus === false) {
        throw new OrdenServiceError(400, `Servicio con ID ${id_producto} no está disponible`)
      }
      tipo = 'servicio'
    } else if (servicio && servicio.estatus !== false) {
      tipo = 'servicio'
    } else if (producto && producto.estatus !== false) {
      tipo = 'producto'
    } else {
      throw new OrdenServiceError(400, `Item con ID ${id_producto} no está disponible`)
    }

    const cantidad = toInt(raw.cantidad)
    if (!cantidad) {
      throw new OrdenServiceError(400, `Cantidad inválida para item ${id_producto}`)
    }

    const precio = typeof raw.precio_unitario === 'string' ? parseFloat(raw.precio_unitario) : (raw.precio_unitario as number)
    const descuento = raw.descuento ? (typeof raw.descuento === 'string' ? parseFloat(raw.descuento) : raw.descuento) : 0
    if (descuento < 0 || descuento > 100) {
      throw new OrdenServiceError(400, `Descuento inválido para item ${producto?.nombre || servicio?.nombre || id_producto}`)
    }
    if (tipo === 'producto' && producto && producto.stock < cantidad) {
      throw new OrdenServiceError(400, `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`)
    }

    const almacenSeleccionado = tipo === 'producto' ? toInt(raw.almacen_id) ?? almacenReservaId : undefined
    const ubicacionSeleccionada = tipo === 'producto'
      ? (raw.ubicacion_id === null || raw.ubicacion_id === undefined ? null : toInt(raw.ubicacion_id) ?? null)
      : undefined

    if (tipo === 'producto' && !almacenSeleccionado) {
      throw new OrdenServiceError(400, `Debe seleccionar un almacén válido para el producto ${producto?.nombre || id_producto}`)
    }

    const totalItem = cantidad * precio * (1 - descuento / 100)
    subtotal += totalItem

    const servicioInfo = serviciosMap.get(id_producto)
    const tiempoServicio = tipo === 'servicio' && servicioInfo
      ? {
          minimo: servicioInfo.tiempo_minimo,
          maximo: servicioInfo.tiempo_maximo,
          unidad: servicioInfo.unidad_tiempo,
          minimoMinutos: convertirATotalMinutos(servicioInfo.tiempo_minimo, servicioInfo.unidad_tiempo) * cantidad,
          maximoMinutos: convertirATotalMinutos(servicioInfo.tiempo_maximo, servicioInfo.unidad_tiempo) * cantidad
        }
      : undefined

    if (tiempoServicio) {
      totalMinutosMin += tiempoServicio.minimoMinutos
      totalMinutosMax += tiempoServicio.maximoMinutos
    }

    itemsValidados.push({
      ...(tipo === 'producto' ? { id_producto } : { id_servicio: id_producto }),
      cantidad,
      precio,
      descuento,
      total: totalItem,
      tipo,
      ...(tipo === 'producto' && raw.servicio_ref ? { servicio_ref: toInt(raw.servicio_ref) } : {}),
      ...(tipo === 'producto' ? { almacenId: almacenSeleccionado ?? almacenReservaId } : {}),
      ...(tipo === 'producto' ? { ubicacionId: ubicacionSeleccionada ?? null } : {}),
      ...(tiempoServicio ? { tiempo_servicio: tiempoServicio } : {})
    })
  }

  const impuesto = subtotal * 0.18
  const total = subtotal + impuesto

  const fechaReferencia = new Date()
  const fechaFinCalculada = data.fecha_fin_estimada
    ? (data.fecha_fin_estimada instanceof Date ? data.fecha_fin_estimada : new Date(data.fecha_fin_estimada))
    : totalMinutosMax > 0
      ? new Date(fechaReferencia.getTime() + totalMinutosMax * 60_000)
      : null

  const trabajadorAsignadoInicial = id_trabajador_principal ?? trabajadoresSecundarios[0] ?? null
  const estadoInicialOrden = trabajadorAsignadoInicial ? 'asignado' : 'pendiente'
  const estadoInicialTarea = trabajadorAsignadoInicial ? 'por_hacer' : 'pendiente'

  let transaccionCreada: { id_transaccion: number; fecha_fin_estimada: Date | null } | null = null
  let codigoFinal = ''

  for (let intento = 0; intento < 3; intento++) {
    const codigoOrden = await generateCodigoOrden(prisma)
    try {
      transaccionCreada = await prisma.$transaction(async (tx) => {
        const transaccion = await tx.transaccion.create({
          data: {
            persona: { connect: { id_persona: cliente.id_persona } },
            usuario: { connect: { id_usuario: usuarioId } },
            ...(id_trabajador_principal && { trabajador_principal: { connect: { id_trabajador: id_trabajador_principal } } }),
            tipo_transaccion: 'orden',
            tipo_comprobante: 'orden_trabajo',
            codigo_transaccion: codigoOrden,
            fecha: new Date(),
            descuento: 0,
            impuesto,
            porcentaje: 18,
            total,
            observaciones: data.observaciones,
            estado_orden: estadoInicialOrden,
            prioridad: data.prioridad || 'media',
            ...(fechaFinCalculada ? { fecha_fin_estimada: fechaFinCalculada } : {}),
            duracion_min: totalMinutosMin > 0 ? totalMinutosMin : null,
            duracion_max: totalMinutosMax > 0 ? totalMinutosMax : null,
            unidad_tiempo: totalMinutosMin > 0 || totalMinutosMax > 0 ? 'minutos' : null
          }
        })

        await tx.transaccionVehiculo.create({
          data: {
            id_transaccion: transaccion.id_transaccion,
            id_vehiculo,
            id_usuario: usuarioId,
            descripcion: `Orden de trabajo: ${codigoOrden}`
          }
        })

        for (const idTrabSec of trabajadoresSecundarios) {
          if (id_trabajador_principal && idTrabSec === id_trabajador_principal) continue
          try {
            await tx.transaccionTrabajador.create({
              data: { id_transaccion: transaccion.id_transaccion, id_trabajador: idTrabSec, rol: 'apoyo' }
            })
          } catch (e) {
            if (!isUniqueConstraintError(e)) {
              console.warn('Pivot trabajador duplicado u error', e)
            }
          }
        }

        const mapaDetalleServicio = new Map<number, number>()
        for (const item of itemsValidados.filter((i) => i.tipo === 'servicio')) {
          const detalle = await tx.detalleTransaccion.create({
            data: {
              id_transaccion: transaccion.id_transaccion,
              id_servicio: item.id_servicio ?? null,
              cantidad: item.cantidad,
              precio: item.precio,
              descuento: item.descuento,
              total: item.total
            }
          })
          mapaDetalleServicio.set(item.id_servicio!, detalle.id_detalle_transaccion)
          const estimado = item.tiempo_servicio ? item.tiempo_servicio.maximoMinutos : 60
          try {
            await tx.tarea.create({
              data: {
                id_detalle_transaccion: detalle.id_detalle_transaccion,
                id_trabajador: trabajadorAsignadoInicial,
                estado: estadoInicialTarea,
                tiempo_estimado: estimado
              }
            })
          } catch (e) {
            console.warn('Fallo creación de tarea automática', e)
          }
        }

        const cuentaProductosPorServicio = new Map<number, number>()
        for (const item of itemsValidados.filter((i) => i.tipo === 'producto' && i.servicio_ref)) {
          const srvId = item.servicio_ref!
          const count = cuentaProductosPorServicio.get(srvId) || 0
          if (count >= 1) {
            throw new OrdenServiceError(400, `Cada servicio solo puede tener 0 o 1 producto asociado (servicio ${srvId})`)
          }
          cuentaProductosPorServicio.set(srvId, count + 1)
        }

        for (const item of itemsValidados.filter((i) => i.tipo === 'producto')) {
          const detalleProducto = await tx.detalleTransaccion.create({
            data: {
              id_transaccion: transaccion.id_transaccion,
              id_producto: item.id_producto ?? null,
              cantidad: item.cantidad,
              precio: item.precio,
              descuento: item.descuento,
              total: item.total,
              id_detalle_servicio_asociado: item.servicio_ref ? mapaDetalleServicio.get(item.servicio_ref) ?? null : null
            }
          })
          await tx.producto.update({
            where: { id_producto: item.id_producto! },
            data: { stock: { decrement: item.cantidad } }
          })
          await reservarStockEnTx(tx, {
            productoId: item.id_producto!,
            almacenId: item.almacenId ?? almacenReservaId,
            ubicacionId: item.ubicacionId ?? null,
            usuarioId,
            cantidad: item.cantidad,
            transaccionId: transaccion.id_transaccion,
            detalleTransaccionId: detalleProducto.id_detalle_transaccion,
            motivo: `Reserva para orden ${codigoOrden}`,
            metadata: {
              origen: 'orden_trabajo',
              codigo_transaccion: codigoOrden,
              almacen_id: item.almacenId ?? almacenReservaId,
              ubicacion_id: item.ubicacionId ?? null,
            },
          })
        }

        return transaccion
      })
      codigoFinal = codigoOrden
      break
    } catch (e) {
      if (isUniqueConstraintError(e) && intento < 2) {
        continue
      }
      throw e
    }
  }

  if (!transaccionCreada) {
    throw new OrdenServiceError(500, 'No se pudo generar código de orden único')
  }

  await prisma.bitacora.create({
    data: {
      id_usuario: usuarioId,
      accion: 'CREATE_ORDEN',
      descripcion: `Orden creada: ${codigoFinal} - Cliente: ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}`,
      tabla: 'transaccion'
    }
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
          productos_asociados: { include: { producto: true } }
        }
      },
      _count: { select: { detalles_transaccion: true } }
    }
  })

  if (!ordenCompleta) {
    throw new OrdenServiceError(500, 'No se pudo recuperar la orden creada')
  }

  const progreso = await calcularProgresoOrden(prisma, ordenCompleta.id_transaccion)

  return {
    status: 201,
    body: {
      ...ordenCompleta,
      resumen: {
        subtotal: Number(subtotal.toFixed(2)),
        impuesto: Number(impuesto.toFixed(2)),
        total: Number(total.toFixed(2)),
        tareas_pendientes_generar: itemsValidados.filter((i) => i.tipo === 'servicio' && !(id_trabajador_principal ?? trabajadoresSecundarios[0])).length,
        tiempo_estimado_min: totalMinutosMin,
        tiempo_estimado_max: totalMinutosMax,
        fecha_fin_estimada: transaccionCreada?.fecha_fin_estimada ?? fechaFinCalculada ?? null,
        progreso
      }
    }
  }
}
