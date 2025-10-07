import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  id_cotizacion: z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)])
})

const toNumber = (value: unknown): number => {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const result = (value as { toString?: () => string }).toString?.()
    if (typeof result === 'string') {
      const n = parseFloat(result)
      if (Number.isFinite(n)) return n
    }
  }
  const fallback = Number(value)
  return Number.isFinite(fallback) ? fallback : 0
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const idCotizacion = Number(parsed.data.id_cotizacion)

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id_cotizacion: idCotizacion },
      include: {
        cliente: { include: { persona: true } },
        vehiculo: { include: { modelo: { include: { marca: true } } } },
        detalle_cotizacion: { include: { producto: true, servicio: true } }
      }
    })

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cotizacion.estado !== 'aprobada') {
      return NextResponse.json({ error: 'Solo las cotizaciones aprobadas pueden enviarse a facturación.' }, { status: 400 })
    }

    const esSoloProductos = cotizacion.detalle_cotizacion.every((detalle) => !detalle.id_servicio)
    if (!esSoloProductos) {
      return NextResponse.json({ error: 'Solo se permiten cotizaciones de tipo solo productos en esta etapa.' }, { status: 400 })
    }

    const items = cotizacion.detalle_cotizacion.map((detalle) => ({
      tipo: 'producto' as const,
      descripcion: detalle.producto?.nombre ?? 'Producto',
      cantidad: detalle.cantidad,
      precio_unitario: toNumber(detalle.precio_unitario),
      descuento: toNumber(detalle.descuento),
      total: toNumber(detalle.total)
    }))

    const numeroDocumento = cotizacion.cliente.persona.numero_documento ?? ''
    const tipoComprobanteSugerido = numeroDocumento.length === 11 ? 'factura' : 'boleta'

    const payloadFacturacion = {
      id_cotizacion: cotizacion.id_cotizacion,
      codigo_cotizacion: cotizacion.codigo_cotizacion,
      cliente: {
        nombre: `${cotizacion.cliente.persona.nombre} ${cotizacion.cliente.persona.apellido_paterno}`.trim(),
        documento: cotizacion.cliente.persona.numero_documento,
        correo: cotizacion.cliente.persona.correo ?? '',
        telefono: cotizacion.cliente.persona.telefono ?? ''
      },
      vehiculo: cotizacion.vehiculo
        ? {
            placa: cotizacion.vehiculo.placa,
            marca: cotizacion.vehiculo.modelo.marca.nombre_marca,
            modelo: cotizacion.vehiculo.modelo.nombre_modelo
          }
        : null,
      totales: {
        subtotal: toNumber(cotizacion.subtotal),
        igv: toNumber(cotizacion.impuesto),
        total: toNumber(cotizacion.total)
      },
      items,
  tipo_comprobante_sugerido: tipoComprobanteSugerido
    }

    return NextResponse.json({
      message: 'Cotización lista para facturación (modo inicial, sin registrar).',
      data: payloadFacturacion
    })
  } catch (error) {
    console.error('Error preparando cotización para facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
