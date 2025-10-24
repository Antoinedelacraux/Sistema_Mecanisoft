import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(v: T | Promise<T>): v is Promise<T> {
  return typeof (v as unknown as { then?: unknown }).then === 'function'
}
async function resolveParams(ctx: ParamsInput): Promise<{ id: string }> {
  const raw = (ctx as { params: { id: string } | Promise<{ id: string }> }).params
  return isPromise(raw) ? await raw : raw
}

export async function GET(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: idRaw } = await resolveParams(ctx)
  const id = parseInt(idRaw)
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
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: idRaw } = await resolveParams(ctx)
  const id = parseInt(idRaw)
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

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({
        usuarioId: parseInt(session.user.id),
        accion: 'UPDATE_MARCA',
        descripcion: `Marca actualizada: ${nombre_marca}`,
        tabla: 'marca'
      })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (UPDATE_MARCA):', err)
    }

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
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: idRaw } = await resolveParams(ctx)
  const id = parseInt(idRaw)
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

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({
        usuarioId: parseInt(session.user.id),
        accion: 'DELETE_MARCA',
        descripcion: `Marca eliminada: ${marca.nombre_marca}`,
        tabla: 'marca'
      })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (DELETE_MARCA):', err)
    }

    return NextResponse.json({ message: 'Marca eliminada correctamente' })

  } catch (error) {
    console.error('Error eliminando marca:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}