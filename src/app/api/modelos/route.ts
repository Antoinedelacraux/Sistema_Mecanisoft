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
    const marcaId = searchParams.get('marca_id')

    const whereCondition = {
      estado: true,
      ...(marcaId && { id_marca: parseInt(marcaId) })
    }

    const modelos = await prisma.modelo.findMany({
      where: whereCondition,
      include: {
        marca: true,
        _count: {
          select: { vehiculos: true }
        }
      },
      orderBy: { nombre_modelo: 'asc' }
    })

    return NextResponse.json({ modelos })

  } catch (error) {
    console.error('Error obteniendo modelos:', error)
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

    const { id_marca, nombre_modelo, descripcion } = await request.json()

    if (!id_marca || !nombre_modelo) {
      return NextResponse.json(
        { error: 'Marca y nombre del modelo son requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar que la marca existe
    const marca = await prisma.marca.findUnique({
      where: { id_marca: parseInt(id_marca) }
    })

    if (!marca) {
      return NextResponse.json(
        { error: 'La marca especificada no existe' }, 
        { status: 400 }
      )
    }

    // Verificar si ya existe el modelo para esa marca
    const existeModelo = await prisma.modelo.findFirst({
      where: {
        id_marca: parseInt(id_marca),
        nombre_modelo: {
          equals: nombre_modelo,
          mode: 'insensitive'
        }
      }
    })

    if (existeModelo) {
      return NextResponse.json(
        { error: 'Ya existe un modelo con ese nombre para esta marca' }, 
        { status: 400 }
      )
    }

    const modelo = await prisma.modelo.create({
      data: {
        id_marca: parseInt(id_marca),
        nombre_modelo,
        descripcion
      },
      include: {
        marca: true
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_MODELO',
        descripcion: `Modelo creado: ${marca.nombre_marca} ${nombre_modelo}`,
        tabla: 'modelo'
      }
    })

    return NextResponse.json(modelo, { status: 201 })

  } catch (error) {
    console.error('Error creando modelo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}