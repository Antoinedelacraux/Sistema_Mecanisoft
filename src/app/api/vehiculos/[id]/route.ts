import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(v: T | Promise<T>): v is Promise<T> {
  return typeof (v as unknown as { then?: unknown }).then === 'function'
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: idRaw } = await resolveParams(ctx)
  const id = parseInt(idRaw)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id_vehiculo: id },
      include: {
        cliente: {
          include: {
            persona: true
          }
        },
        modelo: {
          include: {
            marca: true
          }
        }
      }
    })

    if (!vehiculo) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }

    return NextResponse.json(vehiculo)

  } catch (error) {
    console.error('Error obteniendo vehículo:', error)
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: idRaw } = await resolveParams(ctx)
  const id = parseInt(idRaw)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const data = await request.json()

    // Verificar que el vehículo existe
    const vehiculoExistente = await prisma.vehiculo.findUnique({
      where: { id_vehiculo: id },
      include: {
        cliente: { include: { persona: true } },
        modelo: { include: { marca: true } }
      }
    })

    if (!vehiculoExistente) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Verificar placa duplicada (si se cambió)
    if (data.placa.toUpperCase() !== vehiculoExistente.placa) {
      const existePlaca = await prisma.vehiculo.findUnique({
        where: { placa: data.placa.toUpperCase() }
      })

      if (existePlaca) {
        return NextResponse.json(
          { error: 'Ya existe un vehículo con esta placa' }, 
          { status: 400 }
        )
      }
    }

    // Actualizar vehículo
    const vehiculoActualizado = await prisma.vehiculo.update({
      where: { id_vehiculo: id },
      data: {
        id_cliente: parseInt(data.id_cliente),
        id_modelo: parseInt(data.id_modelo),
        placa: data.placa.toUpperCase(),
        tipo: data.tipo,
        año: parseInt(data.año),
        tipo_combustible: data.tipo_combustible,
        transmision: data.transmision,
        numero_chasis: data.numero_chasis,
        numero_motor: data.numero_motor,
        observaciones: data.observaciones
      },
      include: {
        cliente: {
          include: {
            persona: true
          }
        },
        modelo: {
          include: {
            marca: true
          }
        }
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'UPDATE_VEHICULO',
        descripcion: `Vehículo actualizado: ${data.placa}`,
        tabla: 'vehiculo'
      }
    })

    return NextResponse.json(vehiculoActualizado)

  } catch (error) {
    console.error('Error actualizando vehículo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: idRaw } = await resolveParams(ctx)
  const id = parseInt(idRaw)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id_vehiculo: id },
      include: {
        cliente: { include: { persona: true } },
        modelo: { include: { marca: true } }
      }
    })

    if (!vehiculo) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Soft delete - cambiar estado a false
    await prisma.vehiculo.update({
      where: { id_vehiculo: id },
      data: { estado: false }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'DELETE_VEHICULO',
        descripcion: `Vehículo eliminado: ${vehiculo.placa} - ${vehiculo.modelo.marca.nombre_marca} ${vehiculo.modelo.nombre_modelo}`,
        tabla: 'vehiculo'
      }
    })

    return NextResponse.json({ message: 'Vehículo eliminado correctamente' })

  } catch (error) {
    console.error('Error eliminando vehículo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}