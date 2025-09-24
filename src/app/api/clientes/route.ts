import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const includeInactive = searchParams.get('includeInactive') === 'true' // ✅ Nuevo parámetro

    const skip = (page - 1) * limit

    // Construir filtro de búsqueda
    const whereCondition = search ? {
      OR: [
        { persona: { nombre: { contains: search, mode: 'insensitive' as const } } },
        { persona: { apellido_paterno: { contains: search, mode: 'insensitive' as const } } },
        { persona: { numero_documento: { contains: search, mode: 'insensitive' as const } } },
        { persona: { correo: { contains: search, mode: 'insensitive' as const } } },
      ]
    } : {}

    // ✅ CAMBIO IMPORTANTE: No filtrar por estatus, mostrar todos
    const finalWhereCondition = {
      ...whereCondition
      // Removemos: estatus: true
    }

    // Obtener clientes con paginación
    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where: finalWhereCondition,
        include: {
          persona: true,
          _count: {
            select: { vehiculos: true }
          }
        },
        orderBy: [
          { estatus: 'desc' }, // ✅ Activos primero
          { fecha_registro: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.cliente.count({
        where: finalWhereCondition
      })
    ])

    return NextResponse.json({
      clientes,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        limit
      }
    })

  } catch (error) {
    console.error('Error obteniendo clientes:', error)
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
    
    // Validar datos requeridos
    const {
      nombre,
      apellido_paterno,
      apellido_materno,
      tipo_documento,
      numero_documento,
      sexo,
      telefono,
      correo,
      empresa
    } = data

    if (!nombre || !apellido_paterno || !tipo_documento || !numero_documento) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar si el documento ya existe
    const existeDocumento = await prisma.persona.findUnique({
      where: { numero_documento }
    })

    if (existeDocumento) {
      return NextResponse.json(
        { error: 'Ya existe una persona con este número de documento' }, 
        { status: 400 }
      )
    }

    // Crear persona y cliente en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // Crear persona
      const persona = await tx.persona.create({
        data: {
          nombre,
          apellido_paterno,
          apellido_materno,
          tipo_documento,
          numero_documento,
          sexo,
          telefono,
          correo,
          empresa
        }
      })

      // Crear cliente
      const cliente = await tx.cliente.create({
        data: {
          id_persona: persona.id_persona
        },
        include: {
          persona: true
        }
      })

      return cliente
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_CLIENTE',
        descripcion: `Cliente creado: ${nombre} ${apellido_paterno}`,
        tabla: 'cliente'
      }
    })

    return NextResponse.json(resultado, { status: 201 })

  } catch (error) {
    console.error('Error creando cliente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}