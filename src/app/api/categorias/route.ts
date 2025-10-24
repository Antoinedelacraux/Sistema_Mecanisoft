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

    const categorias = await prisma.categoria.findMany({
      where: whereCondition,
      orderBy: [
        { estatus: 'desc' }, // Activos primero
        { nombre: 'asc' }
      ],
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

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({
        usuarioId: parseInt(session.user.id),
        accion: 'CREATE_CATEGORIA',
        descripcion: `Categoría creada: ${nombre}`,
        tabla: 'categoria'
      })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (CREATE_CATEGORIA):', err)
    }

    return NextResponse.json(categoria, { status: 201 })

  } catch (error) {
    console.error('Error creando categoría:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

