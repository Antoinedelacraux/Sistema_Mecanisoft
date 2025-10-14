import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { EstadoPagoVenta, MetodoPagoVenta, OrigenComprobante, TipoComprobante } from '@prisma/client'
import { listarVentas } from './controllers/listar-ventas'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metodo: z.nativeEnum(MetodoPagoVenta).optional(),
  estado_pago: z.nativeEnum(EstadoPagoVenta).optional(),
  origen: z.nativeEnum(OrigenComprobante).optional(),
  tipo: z.nativeEnum(TipoComprobante).optional(),
  serie: z.string().trim().max(15).optional(),
  search: z.string().trim().max(100).optional()
})

const parseDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000`)
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

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(searchParams)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { page, limit, fecha_desde, fecha_hasta, metodo, estado_pago, origen, tipo, serie, search } = parsed.data

    const resultado = await listarVentas(
      {
        page,
        limit,
        fechaDesde: parseDate(fecha_desde),
        fechaHasta: fecha_hasta ? new Date(`${fecha_hasta}T23:59:59.999`) : null,
        metodo: metodo ?? null,
        estadoPago: estado_pago ?? null,
        origen: origen ?? null,
        tipo: tipo ?? null,
        serie: serie ?? null,
        search: search ?? null
      },
      prisma
    )

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error obteniendo ventas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
