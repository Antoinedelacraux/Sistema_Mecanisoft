import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Compatibilidad con validador de rutas (params puede ser Promise)
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

    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const modelo = await prisma.modelo.findUnique({
      where: { id_modelo: id },
      include: {
        marca: true,
        _count: {
          select: { vehiculos: true }
        }
      }
    })

    if (!modelo) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })
    }

    return NextResponse.json(modelo)

  } catch (error) {
    console.error('Error obteniendo modelo:', error)
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
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { id_marca, nombre_modelo, descripcion } = await request.json()

    if (!id_marca || !nombre_modelo) {
      return NextResponse.json(
        { error: 'Marca y nombre del modelo son requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar que el modelo existe
    const modeloExistente = await prisma.modelo.findUnique({
      where: { id_modelo: id }
    })

    if (!modeloExistente) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })
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

    // Verificar si ya existe otro modelo con el mismo nombre para esa marca
    const existeOtroModelo = await prisma.modelo.findFirst({
      where: {
        id_marca: parseInt(id_marca),
        nombre_modelo: {
          equals: nombre_modelo,
          mode: 'insensitive'
        },
        id_modelo: {
          not: id
        }
      }
    })

    if (existeOtroModelo) {
      return NextResponse.json(
        { error: 'Ya existe otro modelo con ese nombre para esta marca' }, 
        { status: 400 }
      )
    }

    const modeloActualizado = await prisma.modelo.update({
      where: { id_modelo: id },
      data: {
        id_marca: parseInt(id_marca),
        nombre_modelo,
        descripcion
      },
      include: {
        marca: true,
        _count: {
          select: { vehiculos: true }
        }
      }
    })

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({
        usuarioId: parseInt(session.user.id),
        accion: 'UPDATE_MODELO',
        descripcion: `Modelo actualizado: ${marca.nombre_marca} ${nombre_modelo}`,
        tabla: 'modelo'
      })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (UPDATE_MODELO):', err)
    }

    return NextResponse.json(modeloActualizado)

  } catch (error) {
    console.error('Error actualizando modelo:', error)
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
    const { id: rawId } = await resolveParams(ctx)
    const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const modelo = await prisma.modelo.findUnique({
      where: { id_modelo: id },
      include: {
        marca: true,
        _count: {
          select: { vehiculos: true }
        }
      }
    })

    if (!modelo) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })
    }

    // Verificar si tiene vehículos asociados
    if (modelo._count.vehiculos > 0) {
      return NextResponse.json({
        error: `No se puede eliminar el modelo porque tiene ${modelo._count.vehiculos} vehículo(s) asociado(s)`
      }, { status: 400 })
    }

    // Soft delete
    await prisma.modelo.update({
      where: { id_modelo: id },
      data: { estado: false }
    })

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({
        usuarioId: parseInt(session.user.id),
        accion: 'DELETE_MODELO',
        descripcion: `Modelo eliminado: ${modelo.marca.nombre_marca} ${modelo.nombre_modelo}`,
        tabla: 'modelo'
      })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (DELETE_MODELO):', err)
    }

    return NextResponse.json({ message: 'Modelo eliminado correctamente' })

  } catch (error) {
    console.error('Error eliminando modelo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}