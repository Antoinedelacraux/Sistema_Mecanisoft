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
      const unidad = await prisma.unidadMedida.findUnique({
        where: { id_unidad: id }
      })

      if (!unidad) {
        return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 })
      }

      const unidadActualizadaDb = await prisma.unidadMedida.update({
        where: { id_unidad: id },
        data: { estatus: estatus },
        include: {
          _count: {
            select: { productos: true }
          }
        }
      })

      const unidadActualizada = { ...unidadActualizadaDb }

      // Registrar en bitácora
      await prisma.bitacora.create({
        data: {
          id_usuario: parseInt(session.user.id),
          accion: 'TOGGLE_STATUS_UNIDAD',
          descripcion: `Unidad ${estatus ? 'activada' : 'desactivada'}: ${unidad.nombre_unidad}`,
          tabla: 'unidad_medida'
        }
      })

      return NextResponse.json(unidadActualizada)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH unidad:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}