import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const clienteId = searchParams.get('cliente_id')

    const skip = (page - 1) * limit

    // Construir filtro de búsqueda
    let whereCondition: Prisma.VehiculoWhereInput = {
      estado: true,
      // ✅ Solo vehículos de clientes ACTIVOS
      cliente: {
        estatus: true
      }
    }

    // Filtro por cliente específico
    if (clienteId) {
      const idCli = parseInt(clienteId)
      if (!isNaN(idCli)) {
        whereCondition = { ...whereCondition, id_cliente: idCli }
      }
    }

    // Filtro de búsqueda
    if (search) {
      whereCondition = {
        ...whereCondition,
        OR: [
        { placa: { contains: search, mode: 'insensitive' as const } },
        { cliente: { 
          persona: { 
            OR: [
              { nombre: { contains: search, mode: 'insensitive' as const } },
              { apellido_paterno: { contains: search, mode: 'insensitive' as const } },
              { numero_documento: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        }},
        { modelo: { nombre_modelo: { contains: search, mode: 'insensitive' as const } } },
        { modelo: { marca: { nombre_marca: { contains: search, mode: 'insensitive' as const } } } }
        ]
      }
    }

    // Obtener vehículos con paginación
    const [vehiculos, total] = await Promise.all([
      prisma.vehiculo.findMany({
        where: whereCondition,
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
        },
        orderBy: {
          placa: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.vehiculo.count({
        where: whereCondition
      })
    ])

    return NextResponse.json({
      vehiculos,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        limit
      }
    })

  } catch (error) {
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

    const data = await request.json()
    
    const {
      id_cliente,
      id_modelo,
      placa,
      tipo,
      año,
      tipo_combustible,
      transmision,
      numero_chasis,
      numero_motor,
      observaciones
    } = data

    // Validar campos requeridos
    if (!id_cliente || !id_modelo || !placa || !tipo || !año || !tipo_combustible || !transmision) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar que el cliente existe y está activo
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: parseInt(id_cliente) },
      include: { persona: true }
    })

    if (!cliente || !cliente.estatus) {
      return NextResponse.json(
        { error: 'El cliente no existe o está inactivo' }, 
        { status: 400 }
      )
    }

    // Verificar que la placa no existe
    const existePlaca = await prisma.vehiculo.findUnique({
      where: { placa: placa.toUpperCase() }
    })

    if (existePlaca) {
      return NextResponse.json(
        { error: 'Ya existe un vehículo con esta placa' }, 
        { status: 400 }
      )
    }

    // Verificar que el modelo existe
    const modelo = await prisma.modelo.findUnique({
      where: { id_modelo: parseInt(id_modelo) },
      include: { marca: true }
    })

    if (!modelo) {
      return NextResponse.json(
        { error: 'El modelo especificado no existe' }, 
        { status: 400 }
      )
    }

    // Crear vehículo
    const vehiculo = await prisma.vehiculo.create({
      data: {
        id_cliente: parseInt(id_cliente),
        id_modelo: parseInt(id_modelo),
        placa: placa.toUpperCase(),
        tipo,
        año: parseInt(año),
        tipo_combustible,
        transmision,
        numero_chasis,
        numero_motor,
        observaciones
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

    // Registrar en bitácora (no bloquear la creación si falla)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({ usuarioId: parseInt(session.user.id), accion: 'CREATE_VEHICULO', descripcion: `Vehículo creado: ${modelo.marca.nombre_marca} ${modelo.nombre_modelo} - ${placa}`, tabla: 'vehiculo' })
    } catch (err) {
      console.error('[vehiculos] no se pudo registrar en bitácora:', err)
    }

    return NextResponse.json(vehiculo, { status: 201 })

  } catch (error) {
    console.error('Error creando vehículo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}