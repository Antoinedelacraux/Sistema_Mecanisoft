import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: {
        persona: true,
        vehiculos: {
          include: {
            modelo: {
              include: {
                marca: true
              }
            }
          }
        }
      }
    })

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json(cliente)

  } catch (error) {
    console.error('Error obteniendo cliente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

// ✅ Agregar nuevo endpoint para cambiar estado
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
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
      const clienteActualizado = await prisma.cliente.update({
        where: { id_cliente: id },
        data: { estatus: estatus }
      })

      // Registrar en bitácora
      await prisma.bitacora.create({
        data: {
          id_usuario: parseInt(session.user.id),
          accion: 'TOGGLE_STATUS_CLIENTE',
          descripcion: `Cliente ${estatus ? 'activado' : 'desactivado'}: ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}`,
          tabla: 'cliente'
        }
      })

      return NextResponse.json(clienteActualizado)
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const data = await request.json()

    // Verificar que el cliente existe
    const clienteExistente = await prisma.cliente.findUnique({
      where: { id_cliente: id },
      include: { persona: true }
    })

    if (!clienteExistente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Verificar si el nuevo documento ya existe (si se cambió)
    if (data.numero_documento !== clienteExistente.persona.numero_documento) {
      const existeDocumento = await prisma.persona.findUnique({
        where: { numero_documento: data.numero_documento }
      })

      if (existeDocumento) {
        return NextResponse.json(
          { error: 'Ya existe una persona con este número de documento' }, 
          { status: 400 }
        )
      }
    }

    // Actualizar persona
    const clienteActualizado = await prisma.persona.update({
      where: { id_persona: clienteExistente.id_persona },
      data: {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno,
        tipo_documento: data.tipo_documento,
        numero_documento: data.numero_documento,
        sexo: data.sexo,
        telefono: data.telefono,
        correo: data.correo,
        empresa: data.empresa
      },
      include: {
        cliente: true
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'UPDATE_CLIENTE',
        descripcion: `Cliente actualizado: ${data.nombre} ${data.apellido_paterno}`,
        tabla: 'cliente'
      }
    })

    return NextResponse.json(clienteActualizado)

  } catch (error) {
    console.error('Error actualizando cliente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

// ✅ En src/app/api/clientes/[id]/route.ts - actualizar DELETE:

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
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
        id_usuario: parseInt(session.user.id),
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