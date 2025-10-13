import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateClientePayload, ClienteValidationError } from '@/lib/clientes/validation'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

// Tipado flexible para compatibilidad con el validador de rutas de Next 15
type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as unknown as { then?: unknown })?.then === 'function'
}
async function resolveParams(ctx: ParamsInput): Promise<{ id: string }> {
  const raw = (ctx as { params: { id: string } | Promise<{ id: string }> }).params
  return isPromise(raw) ? await raw : raw
}

const withPermiso = async (codigoPermiso: string, mensaje403: string) => {
  const session = await getServerSession(authOptions)
  try {
    await asegurarPermiso(session, codigoPermiso, { prismaClient: prisma })
    if (!session) {
      return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
    }
    return { session } as const
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
    }
    if (error instanceof PermisoDenegadoError) {
      return { error: NextResponse.json({ error: mensaje403 }, { status: 403 }) } as const
    }
    throw error
  }
}

export async function GET(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const guard = await withPermiso('clientes.listar', 'No cuentas con permisos para visualizar clientes')
    if ('error' in guard) return guard.error

    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        persona: {
          include: {
            empresa_persona: true,
          },
        },
        vehiculos: {
          include: {
            modelo: {
              include: {
                marca: true,
              },
            },
          },
        },
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ✅ Agregar nuevo endpoint para cambiar estado
export async function PATCH(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const guard = await withPermiso('clientes.editar', 'No cuentas con permisos para gestionar clientes')
    if ('error' in guard) return guard.error
    const session = guard.session
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { action, estatus } = await request.json()

    if (action === 'toggle_status') {
      const cliente = await prisma.cliente.findUnique({
        where: { id_cliente: id },
        include: {
          persona: {
            include: {
              empresa_persona: true,
            },
          },
        },
      })

      if (!cliente) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }

      // Actualizar estado
      await prisma.cliente.update({
        where: { id_cliente: id },
        data: { estatus: estatus }
      })

      // Registrar en bitácora
      await prisma.bitacora.create({
        data: {
          id_usuario: parseInt(session.user.id, 10),
          accion: 'TOGGLE_STATUS_CLIENTE',
          descripcion: `Cliente ${estatus ? 'activado' : 'desactivado'}: ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}`,
          tabla: 'cliente'
        }
      })

      return NextResponse.json(cliente) // Devolver el cliente con la persona incluida
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH cliente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const guard = await withPermiso('clientes.editar', 'No cuentas con permisos para gestionar clientes')
    if ('error' in guard) return guard.error
    const session = guard.session
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const data = await request.json()

    const clienteExistente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        persona: {
          include: {
            empresa_persona: true,
          },
        },
      },
    })

    if (!clienteExistente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    let validated
    try {
      validated = await validateClientePayload(data, {
        prisma,
        personaId: clienteExistente.persona.id_persona,
      })
    } catch (error) {
      if (error instanceof ClienteValidationError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }

    const clienteActualizado = await prisma.$transaction(async (tx) => {
      const personaActualizada = await tx.persona.update({
        where: { id_persona: clienteExistente.id_persona },
        data: {
          nombre: validated.nombre,
          apellido_paterno: validated.apellido_paterno,
          apellido_materno: validated.apellido_materno,
          tipo_documento: validated.tipo_documento,
          numero_documento: validated.numero_documento,
          sexo: validated.sexo,
          telefono: validated.telefono,
          correo: validated.correo,
          nombre_comercial: validated.nombre_comercial_persona,
          registrar_empresa: validated.registrar_empresa,
          fecha_nacimiento: validated.fecha_nacimiento,
        },
      })

      if (validated.empresa) {
        await tx.empresaPersona.upsert({
          where: { persona_id: personaActualizada.id_persona },
          create: {
            persona_id: personaActualizada.id_persona,
            ruc: validated.empresa.ruc,
            razon_social: validated.empresa.razon_social,
            nombre_comercial: validated.empresa.nombre_comercial,
            direccion_fiscal: validated.empresa.direccion_fiscal,
          },
          update: {
            ruc: validated.empresa.ruc,
            razon_social: validated.empresa.razon_social,
            nombre_comercial: validated.empresa.nombre_comercial,
            direccion_fiscal: validated.empresa.direccion_fiscal,
          },
        })
      } else if (clienteExistente.persona.empresa_persona) {
        await tx.empresaPersona.delete({
          where: { persona_id: personaActualizada.id_persona },
        })
      }

      return tx.cliente.findUnique({
        where: { id_cliente: id },
        include: {
          persona: {
            include: {
              empresa_persona: true,
            },
          },
          _count: {
            select: { vehiculos: true }
          }
        },
      })
    })

    if (!clienteActualizado) {
      return NextResponse.json(
        { error: 'No se pudo encontrar el cliente actualizado' },
        { status: 404 }
      )
    }

    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id, 10),
        accion: 'UPDATE_CLIENTE',
        descripcion: `Cliente actualizado: ${clienteActualizado.persona.nombre} ${clienteActualizado.persona.apellido_paterno}`,
        tabla: 'cliente',
      },
    })

    return NextResponse.json(clienteActualizado)
  } catch (error) {
    console.error('Error general en PUT cliente:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ✅ En src/app/api/clientes/[id]/route.ts - actualizar DELETE:

export async function DELETE(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const guard = await withPermiso('clientes.editar', 'No cuentas con permisos para gestionar clientes')
    if ('error' in guard) return guard.error
    const session = guard.session
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        persona: true,
        vehiculos: true // ✅ Verificar si tiene vehículos
      }
    })

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // ✅ Verificar si tiene vehículos asociados
    if (cliente.vehiculos.length > 0) {
      return NextResponse.json({
        error: `No se puede eliminar el cliente porque tiene ${cliente.vehiculos.length} vehículo(s) asociado(s). Elimina primero los vehículos.`
      }, { status: 400 })
    }

    // ✅ Eliminar completamente - usando transacción
    await prisma.$transaction(async (tx) => {
      // Eliminar cliente
      await tx.cliente.delete({
        where: { id_cliente: id }
      })

      // Eliminar persona
      await tx.persona.delete({
        where: { id_persona: cliente.id_persona }
      })
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id, 10),
        accion: 'DELETE_CLIENTE_PERMANENT',
        descripcion: `Cliente eliminado permanentemente: ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}`,
        tabla: 'cliente'
      }
    })

    return NextResponse.json({ message: 'Cliente eliminado permanentemente' })

  } catch (error) {
    console.error('Error eliminando cliente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}