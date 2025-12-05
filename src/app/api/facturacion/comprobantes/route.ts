import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { FacturacionError } from '@/lib/facturacion/errors'
import { prepararCotizacionParaFacturacion } from '@/lib/facturacion/cotizaciones'
import { prepararOrdenParaFacturacion } from '@/lib/facturacion/ordenes'
import { crearBorradorDesdePayload, listarComprobantes, serializeComprobante } from '@/lib/facturacion/comprobantes'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  estado: z.enum(['BORRADOR', 'EMITIDO', 'ANULADO', 'OBSERVADO']).optional(),
  tipo: z.enum(['BOLETA', 'FACTURA']).optional(),
  serie: z.string().trim().min(1).max(10).optional(),
  origen: z.enum(['COTIZACION', 'ORDEN']).optional()
  ,date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

const bodySchema = z.object({
  origen_tipo: z.enum(['COTIZACION', 'ORDEN']),
  origen_id: z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)]),
  serie: z.string().trim().min(1).max(10).optional(),
  override_tipo: z.enum(['BOLETA', 'FACTURA']).optional(),
  motivo_override: z.string().trim().max(500).optional(),
  usar_empresa: z.boolean().optional(),
  precios_incluyen_igv: z.boolean().optional(),
  notas: z.string().trim().max(1000).optional(),
  descripcion: z.string().trim().max(1000).optional()
})

const toNumber = (value: number | string): number => {
  if (typeof value === 'number') return value
  return Number.parseInt(value, 10)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'facturacion.emitir')
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para emitir comprobantes' }, { status: 403 })
      }
      throw error
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const rawBody = await request.json()
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { origen_tipo, serie, override_tipo, motivo_override, usar_empresa, precios_incluyen_igv, notas, descripcion } = parsed.data
    const origenId = toNumber(parsed.data.origen_id)

    const payloadBase = origen_tipo === 'COTIZACION'
      ? await prepararCotizacionParaFacturacion(origenId)
      : await prepararOrdenParaFacturacion(origenId, override_tipo ?? undefined)

    const payload = {
      ...payloadBase,
      empresa_asociada: usar_empresa ? payloadBase.empresa_asociada : null,
      notas: notas ?? payloadBase.notas ?? null,
      descripcion: descripcion ?? payloadBase.descripcion ?? null,
      totales: {
        ...payloadBase.totales,
        precios_incluyen_igv: precios_incluyen_igv ?? payloadBase.totales.precios_incluyen_igv
      }
    }

    if (usar_empresa && !payload.empresa_asociada) {
      throw new FacturacionError('El cliente no cuenta con una empresa asociada para facturar.', 422)
    }

    // Crear borrador y, si viene de una ORDEN, marcar la orden como entregada
    const usuarioId = Number(session.user.id)

    const txResult = await prisma.$transaction(async (tx) => {
      // If the origin is an order, re-check its state inside the transaction
      // to provide an idempotent behaviour and avoid duplicate comprobantes.
      if (origen_tipo === 'ORDEN') {
        const orden = await tx.transaccion.findUnique({
          where: { id_transaccion: origenId },
          include: { comprobantes: true }
        })

        if (!orden) {
          throw new FacturacionError('Orden no encontrada', 404)
        }

        // If the order already marked as entregado or already has comprobantes,
        // prevent creating another one.
        const comprobanteRelacionado = Array.isArray(orden.comprobantes)
          ? orden.comprobantes[0]
          : orden.comprobantes

        if (orden.estado_orden === 'entregado' || comprobanteRelacionado) {
          throw new FacturacionError('La orden ya fue enviada a facturación o está marcada como entregada.', 409)
        }
      }

      const comprobante = await crearBorradorDesdePayload({
        payload,
        usuarioId,
        serie,
        overrideTipo: override_tipo ?? null,
        motivoOverride: motivo_override ?? null,
        prismaClient: tx
      })

      if (origen_tipo === 'ORDEN') {
        // actualizar transaccion a entregado y crear bitacora
        await tx.transaccion.update({
          where: { id_transaccion: origenId },
          data: { estado_orden: 'entregado' }
        })

        await tx.bitacora.create({
          data: {
            id_usuario: usuarioId,
            accion: 'ORDEN_ENVIADA_FACTURACION',
            descripcion: `Orden ${payload.origen_codigo} enviada a facturación y marcada como entregada`,
            tabla: 'transaccion'
          }
        })
      }

      if (origen_tipo === 'COTIZACION') {
        // Si viene de una cotización (preparada por prepararCotizacionParaFacturacion)
        // marcamos la cotización como en facturación para reflejar el flujo.
        await tx.cotizacion.update({
          where: { id_cotizacion: origenId },
          data: { estado: 'en_facturacion' }
        })

        await tx.bitacora.create({
          data: {
            id_usuario: usuarioId,
            accion: 'COTIZACION_ENVIADA_FACTURACION',
            descripcion: `Cotización ${payload.origen_codigo} enviada a facturación`,
            tabla: 'cotizacion'
          }
        })
      }

      return comprobante
    })

    return NextResponse.json(
      {
        message: 'Comprobante en borrador creado correctamente.',
        data: serializeComprobante(txResult)
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error al crear comprobante:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'facturacion.emitir')
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para visualizar comprobantes' }, { status: 403 })
      }
      throw error
    }

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const paramsObject = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(paramsObject)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { page, limit, search, estado, tipo, serie, origen, date } = parsed.data
    let fechaDesde: Date | null = null
    let fechaHasta: Date | null = null
    if (date) {
      const start = new Date(date + 'T00:00:00.000')
      const end = new Date(date + 'T23:59:59.999')
      if (!isNaN(start.valueOf()) && !isNaN(end.valueOf())) {
        fechaDesde = start
        fechaHasta = end
      }
    }

    const resultado = await listarComprobantes({
      page,
      limit,
      search: search ?? null,
      estado: estado ?? null,
      tipo: tipo ?? null,
      serie: serie ?? null,
      origen: origen ?? null,
      fechaDesde,
      fechaHasta
    })

    return NextResponse.json({
      data: resultado.comprobantes,
      pagination: resultado.pagination
    })
  } catch (error) {
    console.error('Error listando comprobantes:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
