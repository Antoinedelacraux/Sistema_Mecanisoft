import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trabajadorIdRaw = searchParams.get('trabajador_id')
    const estadoRaw = searchParams.get('estado')

    const allowedEstados = ['pendiente', 'en_proceso', 'pausado', 'completado'] as const
    type EstadoTarea = typeof allowedEstados[number]

    const whereCondition: Prisma.TareaWhereInput = {
      detalle_transaccion: {
        transaccion: {
          estado_orden: {
            in: ['pendiente', 'asignado', 'en_proceso', 'pausado', 'completado', 'entregado']
          }
        }
      }
    }

    // Filtro por trabajador (numérico)
    {
      const trabajadorId = trabajadorIdRaw ? Number(trabajadorIdRaw) : NaN
      if (!Number.isNaN(trabajadorId)) {
        // Filtramos por el campo escalar directamente
        whereCondition.id_trabajador = trabajadorId
      } else {
        // Prefetch de IDs de trabajadores activos para evitar filtros de relación problemáticos
        const activos = await prisma.trabajador.findMany({
          where: { activo: true },
          select: { id_trabajador: true }
        })
        const activosIds = activos.map(t => t.id_trabajador)
        // Solo agregamos el filtro 'in' si hay IDs activos
        if (activosIds.length > 0) {
          whereCondition.OR = [
            { id_trabajador: undefined },
            { id_trabajador: { in: activosIds } }
          ]
        } else {
          whereCondition.OR = [
            { id_trabajador: undefined }
          ]
        }
      }
    }

    // Filtro por estado válido
    if (estadoRaw && allowedEstados.includes(estadoRaw as EstadoTarea)) {
      whereCondition.estado = estadoRaw as EstadoTarea
    }

    let tareas
    const baseInclude = {
      detalle_transaccion: {
        include: {
          producto: true,
          servicio: {
            include: {
              marca: true,
              modelo: {
                include: {
                  marca: true
                }
              }
            }
          },
          transaccion: {
            include: {
              persona: true,
              transaccion_vehiculos: {
                include: {
                  vehiculo: {
                    include: {
                      modelo: {
                        include: {
                          marca: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      trabajador: {
        include: {
          usuario: {
            include: {
              persona: true
            }
          }
        }
      }
    } satisfies Prisma.TareaInclude

    try {
      tareas = await prisma.tarea.findMany({
        where: whereCondition,
        include: baseInclude,
        orderBy: [
          { estado: 'asc' },
          { created_at: 'asc' }
        ]
      })
    } catch (innerError) {
      console.error('Fallo al cargar tareas con incluye extendido. Reintentando con estructura reducida.', innerError)
      const fallbackInclude: Prisma.TareaInclude = {
        detalle_transaccion: {
          include: {
            producto: true,
            servicio: true,
            transaccion: {
              include: {
                persona: true,
                transaccion_vehiculos: {
                  include: {
                    vehiculo: {
                      include: {
                        modelo: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        trabajador: {
          include: {
            usuario: {
              include: {
                persona: true
              }
            }
          }
        }
      }
      tareas = await prisma.tarea.findMany({
        where: whereCondition,
        include: fallbackInclude,
        orderBy: [
          { estado: 'asc' },
          { created_at: 'asc' }
        ]
      })
    }

    return NextResponse.json({ tareas })
  } catch (error: unknown) {
    console.error('Error obteniendo tareas:', error)
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}