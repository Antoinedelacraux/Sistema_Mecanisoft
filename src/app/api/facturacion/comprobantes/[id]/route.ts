import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { obtenerComprobantePorId } from '@/lib/facturacion/comprobantes'
import { FacturacionError } from '@/lib/facturacion/errors'

const paramsSchema = z.object({
  id: z.string().regex(/^[0-9]+$/)
})

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const params = await context.params
    const parsed = paramsSchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
    }

    const comprobanteId = Number(parsed.data.id)
    const comprobante = await obtenerComprobantePorId(comprobanteId)

    return NextResponse.json({ data: comprobante })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error obteniendo comprobante:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
