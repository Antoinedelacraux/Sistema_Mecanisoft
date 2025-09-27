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

    const marcas = await prisma.marca.findMany({
      where: { estado: true },
      orderBy: { nombre_marca: 'asc' },
      include: {
        _count: {
          select: { modelos: true }
        }
      }
    })

    return NextResponse.json({ marcas })

  } catch (error) {
    console.error('Error obteniendo marcas:', error)
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

    const { nombre_marca, descripcion } = await request.json()

    if (!nombre_marca) {
      return NextResponse.json(
        { error: 'El nombre de la marca es requerido' }, 
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existeMarca = await prisma.marca.findFirst({
      where: {
        nombre_marca: {
          equals: nombre_marca,
          mode: 'insensitive'
        }
      }
    })

    if (existeMarca) {
      return NextResponse.json(
        { error: 'Ya existe una marca con ese nombre' }, 
        { status: 400 }
      )
    }

    const marca = await prisma.marca.create({
      data: {
        nombre_marca,
        descripcion
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_MARCA',
        descripcion: `Marca creada: ${nombre_marca}`,
        tabla: 'marca'
      }
    })

    return NextResponse.json(marca, { status: 201 })

  } catch (error) {
    console.error('Error creando marca:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}