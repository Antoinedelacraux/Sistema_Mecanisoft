import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

type ParamsMaybePromise = { params: { id: string } } | { params: Promise<{ id: string }> }

async function resolveParams(p: ParamsMaybePromise["params"]): Promise<{ id: string }> {
  return p instanceof Promise ? await p : p
}

export async function PATCH(
  request: NextRequest,
  ctx: ParamsMaybePromise
) {
  try {
    const { id: idParam } = await resolveParams(ctx.params)
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'tareas.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar tareas' }, { status: 403 })
      }
      throw error
    }
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      const usuarioId = Number.parseInt(session.user.id, 10)
      if (!Number.isFinite(usuarioId)) {
        return NextResponse.json({ error: 'Identificador de usuario inválido' }, { status: 401 })
      }

    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }
    const { action, estado, notas_trabajador } = await request.json()

    const tarea = await prisma.tarea.findUnique({ where: { id_tarea: id } })

    if (!tarea) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
  let bitacoraDescripcion = ''

    switch (action) {
      case 'cambiar_estado':
        updateData.estado = estado
        
        // Manejar timestamps según el estado
        if (estado === 'en_proceso') {
          // Reinicio de tracking de tiempo sólo si venía de pendiente o pausado (fecha_inicio null)
          updateData.fecha_inicio = new Date()
          bitacoraDescripcion = 'Tarea iniciada'
        } else if (estado === 'completado') {
          updateData.fecha_fin = new Date()
          if (tarea.fecha_inicio) {
            const tiempoSegmento = Math.round((Date.now() - new Date(tarea.fecha_inicio).getTime()) / (1000 * 60))
            updateData.tiempo_real = (tarea.tiempo_real || 0) + (tiempoSegmento > 0 ? tiempoSegmento : 0)
          } else {
            // Si no hay fecha_inicio asumimos que ya estaba pausada y tiempo_real acumulado
            updateData.tiempo_real = tarea.tiempo_real || 0
          }
          bitacoraDescripcion = 'Tarea completada'
          // Limpiar fecha_inicio para indicar finalizada
          updateData.fecha_inicio = null
        }
        
        if (notas_trabajador) {
          updateData.notas_trabajador = notas_trabajador
        }
        
        break

      case 'pausar':
        // Calcular tiempo parcial
        if (tarea.fecha_inicio) {
          const tiempoParcial = Math.round(
            (new Date().getTime() - new Date(tarea.fecha_inicio).getTime()) / (1000 * 60)
          )
          updateData.tiempo_real = (tarea.tiempo_real || 0) + tiempoParcial
        }
        updateData.estado = 'pausado'
        updateData.fecha_inicio = null
  bitacoraDescripcion = 'Tarea pausada'
        break

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }


    // Actualizar tarea
    await prisma.tarea.update({ where: { id_tarea: id }, data: updateData })

    // Obtener la transacción (orden) asociada a la tarea
    const tareaActualizada = await prisma.tarea.findUnique({
      where: { id_tarea: id },
      include: {
        detalle_transaccion: {
          include: {
            producto: true,
            transaccion: {
              include: {
                persona: true,
                transaccion_vehiculos: {
                  include: {
                    vehiculo: {
                      include: {
                        modelo: { include: { marca: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    // Si hay transacción asociada, sincronizar estado_orden
    const transaccion = tareaActualizada?.detalle_transaccion?.transaccion
    if (transaccion) {
      // Buscar todas las tareas asociadas a la orden
      const tareasOrden = await prisma.tarea.findMany({
        where: {
          detalle_transaccion: {
            transaccion: {
              id_transaccion: transaccion.id_transaccion
            }
          }
        }
      })
      // Determinar el estado global de la orden
      let nuevoEstadoOrden = 'pendiente'
      if (tareasOrden.every(t => t.estado === 'completado')) {
        nuevoEstadoOrden = 'completado'
      } else if (tareasOrden.some(t => t.estado === 'en_proceso')) {
        nuevoEstadoOrden = 'en_proceso'
      } else if (tareasOrden.some(t => t.estado === 'pausado')) {
        nuevoEstadoOrden = 'pausado'
      } else if (tareasOrden.some(t => t.estado === 'pendiente')) {
        nuevoEstadoOrden = 'pendiente'
      }
      // Actualizar el estado de la orden
      await prisma.transaccion.update({
        where: { id_transaccion: transaccion.id_transaccion },
        data: { estado_orden: nuevoEstadoOrden }
      })
    }

    // Bitácora (no bloquear la respuesta si falla)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({ usuarioId, accion: 'UPDATE_TAREA', descripcion: bitacoraDescripcion || 'Actualización de tarea', tabla: 'tarea' })
    } catch (err) {
      console.error('[tareas] no se pudo registrar en bitácora:', err)
    }

    return NextResponse.json(tareaActualizada)

  } catch (error) {
    console.error('Error actualizando tarea:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}