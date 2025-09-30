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

    const categorias = await prisma.categoria.findMany({
      where: { estatus: true },
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { productos: true }
        }
      }
    })

    return NextResponse.json({ categorias })

  } catch (error) {
    console.error('Error obteniendo categorías:', error)
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

    const { nombre } = await request.json()

    if (!nombre) {
      return NextResponse.json(
        { error: 'El nombre de la categoría es requerido' }, 
        { status: 400 }
      )
    }

    // Verificar si ya existe
    const existeCategoria = await prisma.categoria.findFirst({
      where: {
        nombre: {
          equals: nombre,
          mode: 'insensitive'
        }
      }
    })

    if (existeCategoria) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre' }, 
        { status: 400 }
      )
    }

    const categoria = await prisma.categoria.create({
      data: { nombre }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_CATEGORIA',
        descripcion: `Categoría creada: ${nombre}`,
        tabla: 'categoria'
      }
    })

    return NextResponse.json(categoria, { status: 201 })

  } catch (error) {
    console.error('Error creando categoría:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}