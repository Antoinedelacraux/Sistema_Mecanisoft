import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ParamsMaybePromise = { params: { id: string } } | { params: Promise<{ id: string }> }
async function resolveParams(p: ParamsMaybePromise["params"]): Promise<{ id: string }> {
  return p instanceof Promise ? await p : p
}

export async function GET(
  request: NextRequest,
  ctx: ParamsMaybePromise
) {
  try {
    const { id: idParam } = await resolveParams(ctx.params)
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const trabajador = await prisma.trabajador.findUnique({
      where: { id_trabajador: id },
      include: {
        usuario: {
          include: {
            persona: {
              include: {
                empresa_persona: true,
              },
            },
            rol: true
          }
        },
        _count: {
          select: { 
            tareas_asignadas: true,
            ordenes_principales: true
          }
        }
      }
    })

    if (!trabajador) {
      return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    return NextResponse.json(trabajador)

  } catch (error) {
    console.error('Error obteniendo trabajador:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  ctx: ParamsMaybePromise
) {
  try {
    const { id: idParam } = await resolveParams(ctx.params)
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const data = await request.json()

    // Verificar que el trabajador existe
    const trabajadorExistente = await prisma.trabajador.findUnique({
      where: { id_trabajador: id },
      include: {
        usuario: {
          include: {
            persona: {
              include: {
                empresa_persona: true,
              },
            },
          },
        }
      }
    })

    if (!trabajadorExistente) {
      return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 })
    }

    // Actualizar en transacción
    const trabajadorActualizado = await prisma.$transaction(async (tx) => {
      // Actualizar persona si hay cambios
      if (data.nombre || data.apellido_paterno || data.telefono || data.correo) {
        await tx.persona.update({
          where: { id_persona: trabajadorExistente.usuario.persona.id_persona },
          data: {
            ...(data.nombre && { nombre: data.nombre }),
            ...(data.apellido_paterno && { apellido_paterno: data.apellido_paterno }),
            ...(data.apellido_materno !== undefined && { apellido_materno: data.apellido_materno }),
            ...(data.telefono && { telefono: data.telefono }),
            ...(data.correo && { correo: data.correo })
          }
        })
      }

      // Actualizar trabajador
      const trabajador = await tx.trabajador.update({
        where: { id_trabajador: id },
        data: {
          especialidad: data.especialidad,
          nivel_experiencia: data.nivel_experiencia,
          tarifa_hora: parseFloat(data.tarifa_hora) || 0
        },
        include: {
          usuario: {
            include: {
              persona: {
                include: {
                  empresa_persona: true,
                },
              },
              rol: true
            }
          }
        }
      })

      return trabajador
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'UPDATE_TRABAJADOR',
        descripcion: `Trabajador actualizado: ${trabajadorExistente.codigo_empleado}`,
        tabla: 'trabajador'
      }
    })

    return NextResponse.json(trabajadorActualizado)

  } catch (error) {
    console.error('Error actualizando trabajador:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: ParamsMaybePromise
) {
  try {
    const { id: idParam } = await resolveParams(ctx.params)
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(idParam)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { action, activo } = await request.json()

    if (action === 'toggle_status') {
      const trabajador = await prisma.trabajador.findUnique({
        where: { id_trabajador: id },
        include: {
          usuario: {
            include: {
              persona: {
                include: {
                  empresa_persona: true,
                },
              },
            },
          }
        }
      })

      if (!trabajador) {
        return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 })
      }

      // Actualizar estado del trabajador y usuario
      const trabajadorActualizado = await prisma.$transaction(async (tx) => {
        await tx.usuario.update({
          where: { id_usuario: trabajador.id_usuario },
          data: { estado: activo }
        })

        return await tx.trabajador.update({
          where: { id_trabajador: id },
          data: { activo: activo },
          include: {
            usuario: {
              include: {
                persona: {
                  include: {
                    empresa_persona: true,
                  },
                },
                rol: true
              }
            }
          }
        })
      })

      // Registrar en bitácora
      await prisma.bitacora.create({
        data: {
          id_usuario: parseInt(session.user.id),
          accion: 'TOGGLE_STATUS_TRABAJADOR',
          descripcion: `Trabajador ${activo ? 'activado' : 'desactivado'}: ${trabajador.codigo_empleado}`,
          tabla: 'trabajador'
        }
      })

      return NextResponse.json(trabajadorActualizado)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH trabajador:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}