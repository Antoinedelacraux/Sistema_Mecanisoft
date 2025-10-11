import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { prepararCotizacionParaFacturacion } from '@/lib/facturacion/cotizaciones'
import { FacturacionError } from '@/lib/facturacion/errors'

const bodySchema = z.object({
  id_cotizacion: z.union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)])
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

    const idCotizacion = Number(parsed.data.id_cotizacion)

    const payload = await prepararCotizacionParaFacturacion(idCotizacion)

    return NextResponse.json({
      message: 'Cotización lista para facturación (modo borrador).',
      data: payload
    })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error preparando cotización para facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
