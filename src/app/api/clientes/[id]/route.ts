import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Tipado flexible para compatibilidad con el validador de rutas de Next 15
type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as unknown as { then?: unknown })?.then === 'function'
}
async function resolveParams(ctx: ParamsInput): Promise<{ id: string }> {
  const raw = (ctx as { params: { id: string } | Promise<{ id: string }> }).params
  return isPromise(raw) ? await raw : raw
}

export async function GET(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        persona: true,
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { action, estatus } = await request.json()

    if (action === 'toggle_status') {
      const cliente = await prisma.cliente.findUnique({
        where: { id_cliente: id },
        include: { persona: true }
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const data = await request.json();
    console.log('Datos recibidos:', data); // Log para depuración

    // Verificar que el cliente existe
    const clienteExistente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: { persona: true },
    });

    if (!clienteExistente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Verificar si el nuevo documento ya existe (si se cambió)
    if (data.numero_documento !== clienteExistente.persona.numero_documento) {
      const existeDocumento = await prisma.persona.findUnique({
        where: { numero_documento: data.numero_documento },
      });

      if (existeDocumento) {
        return NextResponse.json(
          { error: 'Ya existe una persona con este número de documento' },
          { status: 400 }
        );
      }
    }

    try {
      // Actualizar persona
      await prisma.persona.update({
        where: { id_persona: clienteExistente.id_persona },
        data: {
          nombre: data.nombre,
          apellido_paterno: data.apellido_paterno,
          apellido_materno: data.apellido_materno || null,
          tipo_documento: data.tipo_documento,
          numero_documento: data.numero_documento,
          sexo: data.sexo || null,
          telefono: data.telefono || null,
          correo: data.correo || null,
          empresa: data.empresa || null,
        },
      });
    } catch (error) {
      console.error('Error actualizando persona:', error);
      return NextResponse.json(
        { error: 'Error actualizando los datos de la persona' },
        { status: 500 }
      );
    }

    try {
      // Volver a buscar el cliente con todas las relaciones para la respuesta y la bitácora
      const clienteActualizado = await prisma.cliente.findUnique({
        where: { id_cliente: id },
        include: { persona: true },
      });

      // Verificar si clienteActualizado es null
      if (!clienteActualizado) {
        return NextResponse.json(
          { error: 'No se pudo encontrar el cliente actualizado' },
          { status: 404 }
        );
      }

      // Registrar en bitácora
      await prisma.bitacora.create({
        data: {
          id_usuario: parseInt(session.user.id, 10),
          accion: 'UPDATE_CLIENTE',
          descripcion: `Cliente actualizado: ${clienteActualizado.persona.nombre} ${clienteActualizado.persona.apellido_paterno}`,
          tabla: 'cliente',
        },
      });

      return NextResponse.json(clienteActualizado);
    } catch (error) {
      console.error('Error registrando en bitácora o buscando cliente actualizado:', error);
      return NextResponse.json(
        { error: 'Error interno al finalizar la actualización' },
        { status: 500 }
      );
    }
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
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