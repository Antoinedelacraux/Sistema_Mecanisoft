import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const marca = await prisma.marca.findUnique({
      where: { id_marca: id },
      include: {
        _count: {
          select: { modelos: true }
        }
      }
    })

    if (!marca) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 })
    }

    return NextResponse.json(marca)

  } catch (error) {
    console.error('Error obteniendo marca:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { nombre_marca, descripcion } = await request.json()

    if (!nombre_marca) {
      return NextResponse.json(
        { error: 'El nombre de la marca es requerido' }, 
        { status: 400 }
      )
    }

    // Verificar que la marca existe
    const marcaExistente = await prisma.marca.findUnique({
      where: { id_marca: id }
    })

    if (!marcaExistente) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 })
    }

    // Verificar si ya existe otra marca con el mismo nombre
    const existeOtraMarca = await prisma.marca.findFirst({
      where: {
        nombre_marca: {
          equals: nombre_marca,
          mode: 'insensitive'
        },
        id_marca: {
          not: id
        }
      }
    })

    if (existeOtraMarca) {
      return NextResponse.json(
        { error: 'Ya existe otra marca con ese nombre' }, 
        { status: 400 }
      )
    }

    const marcaActualizada = await prisma.marca.update({
      where: { id_marca: id },
      data: {
        nombre_marca,
        descripcion
      },
      include: {
        _count: {
          select: { modelos: true }
        }
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'UPDATE_MARCA',
        descripcion: `Marca actualizada: ${nombre_marca}`,
        tabla: 'marca'
      }
    })

    return NextResponse.json(marcaActualizada)

  } catch (error) {
    console.error('Error actualizando marca:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const marca = await prisma.marca.findUnique({
      where: { id_marca: id },
      include: {
        _count: {
          select: { modelos: true }
        }
      }
    })

    if (!marca) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 })
    }

    // Verificar si tiene modelos asociados
    if (marca._count.modelos > 0) {
      return NextResponse.json({
        error: `No se puede eliminar la marca porque tiene ${marca._count.modelos} modelo(s) asociado(s)`
      }, { status: 400 })
    }

    // Soft delete
    await prisma.marca.update({
      where: { id_marca: id },
      data: { estado: false }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'DELETE_MARCA',
        descripcion: `Marca eliminada: ${marca.nombre_marca}`,
        tabla: 'marca'
      }
    })

    return NextResponse.json({ message: 'Marca eliminada correctamente' })

  } catch (error) {
    console.error('Error eliminando marca:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}