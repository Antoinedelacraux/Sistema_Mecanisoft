import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { FacturacionError } from '@/lib/facturacion/errors'
import { prepararOrdenParaFacturacion } from '@/lib/facturacion/ordenes'

const bodySchema = z.object({
  id_transaccion: z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)]),
  tipo_comprobante: z.enum(['boleta', 'factura']).optional()
})

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
    const tipoSolicitado = parsed.data.tipo_comprobante
      ? parsed.data.tipo_comprobante.toUpperCase() === 'FACTURA'
        ? 'FACTURA'
        : 'BOLETA'
      : undefined

    const payload = await prepararOrdenParaFacturacion(idTransaccion, tipoSolicitado)

    return NextResponse.json({
      message: 'Orden preparada para facturación (modo borrador).',
      data: payload
    })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error enviando orden a facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
