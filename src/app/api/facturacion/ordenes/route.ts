import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  id_transaccion: z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)]),
  tipo_comprobante: z.enum(['boleta', 'factura']).optional()
})

const toNumber = (value: unknown): number => {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === 'object' && 'toString' in (value as Record<string, unknown>)) {
    const str = (value as Record<string, unknown>).toString?.()
    if (typeof str === 'string') {
      const n = parseFloat(str)
      return Number.isFinite(n) ? n : 0
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

    const idTransaccion = Number(parsed.data.id_transaccion)
    const tipoComprobanteSolicitado = parsed.data.tipo_comprobante

    const orden = await prisma.transaccion.findUnique({
      where: { id_transaccion: idTransaccion },
      include: {
        persona: true,
        transaccion_vehiculos: {
          include: {
            vehiculo: {
              include: {
                modelo: { include: { marca: true } },
                cliente: { include: { persona: true } }
              }
            }
          }
        },
        detalles_transaccion: {
          include: {
            producto: true,
            servicio: true
          }
        }
      }
    })

    if (!orden || orden.tipo_transaccion !== 'orden' || orden.estatus !== 'activo') {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    if (orden.estado_orden !== 'completado') {
      return NextResponse.json({ error: 'Solo las órdenes completadas pueden enviarse a facturación.' }, { status: 400 })
    }

    if (orden.estado_pago === 'pagado') {
      return NextResponse.json({ error: 'La orden ya se encuentra pagada.' }, { status: 400 })
    }

    if (orden.tipo_comprobante && orden.numero_comprobante) {
      return NextResponse.json({ error: 'La orden ya tiene un comprobante asignado.' }, { status: 409 })
    }

    const numeroDocumento = orden.persona?.numero_documento ?? ''
    const tipoComprobanteInferido = tipoComprobanteSolicitado ?? (numeroDocumento.length === 11 ? 'factura' : 'boleta')

    const items = orden.detalles_transaccion.map((detalle) => ({
      tipo: detalle.servicio ? 'servicio' : 'producto',
      descripcion: detalle.servicio?.nombre ?? detalle.producto?.nombre ?? 'Item',
      cantidad: detalle.cantidad,
      precio_unitario: toNumber(detalle.precio),
      descuento: toNumber(detalle.descuento),
      total: toNumber(detalle.precio) * detalle.cantidad - toNumber(detalle.descuento)
    }))

    const payloadFacturacion = {
      id_transaccion: orden.id_transaccion,
      codigo_orden: orden.codigo_transaccion,
      cliente: {
        nombre: `${orden.persona?.nombre ?? ''} ${orden.persona?.apellido_paterno ?? ''}`.trim(),
        documento: numeroDocumento,
        correo: orden.persona?.correo ?? '',
        telefono: orden.persona?.telefono ?? ''
      },
      vehiculo: orden.transaccion_vehiculos[0]?.vehiculo
        ? {
            placa: orden.transaccion_vehiculos[0]?.vehiculo.placa ?? '',
            marca: orden.transaccion_vehiculos[0]?.vehiculo.modelo.marca.nombre_marca ?? '',
            modelo: orden.transaccion_vehiculos[0]?.vehiculo.modelo.nombre_modelo ?? ''
          }
        : null,
      totales: {
        subtotal: toNumber(orden.total) - toNumber(orden.impuesto),
        igv: toNumber(orden.impuesto),
        total: toNumber(orden.total)
      },
      items,
      tipo_comprobante: tipoComprobanteInferido
    }

    return NextResponse.json({
      message: 'Orden preparada para facturación electrónica (modo inicial, sin registrar).',
      data: payloadFacturacion
    })
  } catch (error) {
    console.error('Error enviando orden a facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
