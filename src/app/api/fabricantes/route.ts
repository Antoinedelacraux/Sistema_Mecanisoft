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

    const fabricantes = await prisma.fabricante.findMany({
      where: { estado: true },
      orderBy: { nombre_fabricante: 'asc' },
      include: {
        _count: {
          select: { productos: true }
        }
      }
    })

    return NextResponse.json({ fabricantes })

  } catch (error) {
    console.error('Error obteniendo fabricantes:', error)
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

    const { nombre_fabricante, descripcion } = await request.json()

    if (!nombre_fabricante) {
      return NextResponse.json(
        { error: 'El nombre del fabricante es requerido' }, 
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existeFabricante = await prisma.fabricante.findFirst({
      where: {
        nombre_fabricante: {
          equals: nombre_fabricante,
          mode: 'insensitive'
        }
      }
    })

    if (existeFabricante) {
      return NextResponse.json(
        { error: 'Ya existe un fabricante con ese nombre' }, 
        { status: 400 }
      )
    }

    const fabricante = await prisma.fabricante.create({
      data: {
        nombre_fabricante,
        descripcion
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_FABRICANTE',
        descripcion: `Fabricante creado: ${nombre_fabricante}`,
        tabla: 'fabricante'
      }
    })

    return NextResponse.json(fabricante, { status: 201 })

  } catch (error) {
    console.error('Error creando fabricante:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}