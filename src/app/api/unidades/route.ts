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
    const includeInactive = searchParams.get('include_inactive') === 'true'

    const whereCondition = includeInactive ? {} : { estatus: true }

    const unidadesDb = await prisma.unidadMedida.findMany({
      where: whereCondition,
      orderBy: [
        { estatus: 'desc' },
        { nombre_unidad: 'asc' }
      ],
      include: {
        _count: {
          select: { productos: true }
        }
      }
    })

    const unidades = unidadesDb.map(u => ({ ...u, estatus: u.estatus }))

    return NextResponse.json({ unidades })

  } catch (error) {
    console.error('Error obteniendo unidades:', error)
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

    const { nombre_unidad, abreviatura } = await request.json()

    if (!nombre_unidad || !abreviatura) {
      return NextResponse.json(
        { error: 'Nombre y abreviatura son requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existeUnidad = await prisma.unidadMedida.findFirst({
      where: {
        OR: [
          {
            nombre_unidad: {
              equals: nombre_unidad,
              mode: 'insensitive'
            }
          },
          {
            abreviatura: {
              equals: abreviatura,
              mode: 'insensitive'
            }
          }
        ]
      }
    })

    if (existeUnidad) {
      return NextResponse.json(
        { error: 'Ya existe una unidad con ese nombre o abreviatura' }, 
        { status: 400 }
      )
    }

    const unidadCreada = await prisma.unidadMedida.create({
      data: {
        nombre_unidad,
        abreviatura
      },
      include: {
        _count: {
          select: { productos: true }
        }
      }
    })

    const unidad = { ...unidadCreada }

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_UNIDAD',
        descripcion: `Unidad creada: ${nombre_unidad} (${abreviatura})`,
        tabla: 'unidad_medida'
      }
    })

  return NextResponse.json(unidad, { status: 201 })

  } catch (error) {
    console.error('Error creando unidad:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}