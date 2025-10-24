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
      const fabricante = await prisma.fabricante.findUnique({
        where: { id_fabricante: id }
      })

      if (!fabricante) {
        return NextResponse.json({ error: 'Fabricante no encontrado' }, { status: 404 })
      }

      const fabricanteActualizadoDb = await prisma.fabricante.update({
        where: { id_fabricante: id },
        data: { estado: estatus },
        include: {
          _count: {
            select: { productos: true }
          }
        }
      })

      const fabricanteActualizado = { ...fabricanteActualizadoDb, estatus: fabricanteActualizadoDb.estado }

      // Registrar en bitácora (mejor esfuerzo)
      try {
        const { logEvent } = await import('@/lib/bitacora/log-event')
        await logEvent({
          usuarioId: parseInt(session.user.id),
          accion: 'TOGGLE_STATUS_FABRICANTE',
          descripcion: `Fabricante ${estatus ? 'activado' : 'desactivado'}: ${fabricante.nombre_fabricante}`,
          tabla: 'fabricante'
        })
      } catch (err) {
        console.error('No fue posible registrar en bitácora (TOGGLE_STATUS_FABRICANTE):', err)
      }

      return NextResponse.json(fabricanteActualizado)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH fabricante:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}