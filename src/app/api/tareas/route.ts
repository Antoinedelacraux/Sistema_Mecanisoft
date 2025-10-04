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
      trabajador: { activo: true },
      detalle_transaccion: {
        transaccion: {
          estado_orden: {
            in: ['pendiente', 'asignado', 'en_proceso', 'completado']
          }
        }
      }
    }

    // Filtro por trabajador (numérico)
    if (trabajadorIdRaw) {
      const trabajadorId = Number(trabajadorIdRaw)
      if (!Number.isNaN(trabajadorId)) {
        whereCondition.id_trabajador = trabajadorId
      }
    }

    // Filtro por estado válido
    if (estadoRaw && allowedEstados.includes(estadoRaw as EstadoTarea)) {
      whereCondition.estado = estadoRaw as EstadoTarea
    }

    const tareas = await prisma.tarea.findMany({
      where: whereCondition,
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
      },
      orderBy: [
        { estado: 'asc' }, // pendientes primero
        { created_at: 'asc' }
      ]
    })

    return NextResponse.json({ tareas })
  } catch (error: unknown) {
    console.error('Error obteniendo tareas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}