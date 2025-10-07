import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateClientePayload, ClienteValidationError } from '@/lib/clientes/validation'

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
          persona: {
            include: {
              empresa_persona: true
            }
          },
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

    const payload = await request.json()

    let validated
    try {
      validated = await validateClientePayload(payload, { prisma })
    } catch (error) {
      if (error instanceof ClienteValidationError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const persona = await tx.persona.create({
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
          fecha_nacimiento: validated.fecha_nacimiento
        }
      })

      if (validated.empresa) {
        await tx.empresaPersona.create({
          data: {
            persona_id: persona.id_persona,
            ruc: validated.empresa.ruc,
            razon_social: validated.empresa.razon_social,
            nombre_comercial: validated.empresa.nombre_comercial,
            direccion_fiscal: validated.empresa.direccion_fiscal
          }
        })
      }

      return tx.cliente.create({
        data: {
          id_persona: persona.id_persona
        },
        include: {
          persona: {
            include: {
              empresa_persona: true
            }
          },
          _count: {
            select: { vehiculos: true }
          }
        }
      })
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_CLIENTE',
        descripcion: `Cliente creado: ${validated.nombre} ${validated.apellido_paterno}`,
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