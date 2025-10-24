import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as unknown as { then?: unknown })?.then === 'function'
}
async function resolveParams(ctx: ParamsInput): Promise<{ id: string }> {
  const raw = (ctx as { params: { id: string } | Promise<{ id: string }> }).params
  return isPromise(raw) ? await raw : raw
}

export async function PATCH(
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

    const { action, estatus } = await request.json()

    if (action === 'toggle_status') {
      const categoria = await prisma.categoria.findUnique({
        where: { id_categoria: id }
      })

      if (!categoria) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
      }

      const categoriaActualizada = await prisma.categoria.update({
        where: { id_categoria: id },
        data: { estatus: estatus },
        include: {
          _count: {
            select: { productos: true }
          }
        }
      })

      // Registrar en bitácora (mejor esfuerzo)
      try {
        const { logEvent } = await import('@/lib/bitacora/log-event')
        await logEvent({
          usuarioId: parseInt(session.user.id),
          accion: 'TOGGLE_STATUS_CATEGORIA',
          descripcion: `Categoría ${estatus ? 'activada' : 'desactivada'}: ${categoria.nombre}`,
          tabla: 'categoria'
        })
      } catch (err) {
        console.error('No fue posible registrar en bitácora (TOGGLE_STATUS_CATEGORIA):', err)
      }

      return NextResponse.json(categoriaActualizada)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH categoria:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

// Añadido para cumplir con el validador de rutas de Next y evitar incompatibilidades de tipos.
export async function GET(
  _request: NextRequest,
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

    const categoria = await prisma.categoria.findUnique({
      where: { id_categoria: id },
      include: {
        _count: { select: { productos: true } }
      }
    })

    if (!categoria) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    return NextResponse.json(categoria)
  } catch (error) {
    console.error('Error obteniendo categoría:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}