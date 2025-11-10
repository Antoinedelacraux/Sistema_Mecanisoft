import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listarVehiculos, crearVehiculo } from '@/lib/vehiculos/service'
import { VehiculoServiceError } from '@/lib/vehiculos/errors'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Number.parseInt(searchParams.get('limit') ?? '10', 10)
    const search = searchParams.get('search') ?? ''
    const clienteIdParam = searchParams.get('cliente_id')
    const clienteId = clienteIdParam && /^\d+$/.test(clienteIdParam) ? Number.parseInt(clienteIdParam, 10) : undefined

    const resultado = await listarVehiculos({
      page,
      limit,
      search,
      clienteId,
    }, { prismaClient: prisma })

    return NextResponse.json(resultado)

  } catch (error) {
    if (error instanceof VehiculoServiceError) {
      return NextResponse.json({ error: error.message, ...(error.payload ?? {}) }, { status: error.status })
    }
    console.error('Error obteniendo vehículos:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const data = await request.json()
    const vehiculo = await crearVehiculo(data, { prismaClient: prisma, usuarioId })

    return NextResponse.json(vehiculo, { status: 201 })

  } catch (error) {
    if (error instanceof VehiculoServiceError) {
      return NextResponse.json({ error: error.message, ...(error.payload ?? {}) }, { status: error.status })
    }
    console.error('Error creando vehículo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}