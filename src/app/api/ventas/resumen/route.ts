import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { obtenerResumenVentas } from '../controllers/resumen-ventas'

const querySchema = z.object({
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

const parseDate = (value?: string | null, endOfDay = false) => {
  if (!value) return null
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'
  const parsed = new Date(`${value}${suffix}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      try {
        await asegurarPermiso(session, 'facturacion.ver', { prismaClient: prisma })
      } catch (permisoError) {
        if (permisoError instanceof PermisoDenegadoError) {
          await asegurarPermiso(session, 'facturacion.emitir', { prismaClient: prisma })
        } else {
          throw permisoError
        }
      }
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para ver ventas' }, { status: 403 })
      }
      throw error
    }

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { fecha_desde, fecha_hasta } = parsed.data

    const resumen = await obtenerResumenVentas(
      {
        fechaDesde: parseDate(fecha_desde ?? null, false),
        fechaHasta: parseDate(fecha_hasta ?? null, true)
      },
      prisma
    )

    return NextResponse.json(resumen)
  } catch (error) {
    console.error('Error obteniendo resumen de ventas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
