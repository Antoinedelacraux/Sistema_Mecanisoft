import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { emitirComprobante } from '@/lib/facturacion/comprobantes'
import { FacturacionError } from '@/lib/facturacion/errors'

const paramsSchema = z.object({
  id: z.string().regex(/^[0-9]+$/)
})

const bodySchema = z
  .object({
    descripcion: z.string().trim().max(1000).optional(),
    notas: z.string().trim().max(1000).optional()
  })
  .optional()

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const params = await context.params
    const paramsParsed = paramsSchema.safeParse(params)
    if (!paramsParsed.success) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
    }

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsedBody = bodySchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsedBody.error.flatten() }, { status: 400 })
    }

    const { descripcion, notas } = parsedBody.data ?? {}

    const comprobante = await emitirComprobante({
      comprobanteId: Number(paramsParsed.data.id),
      usuarioId: Number(session.user.id),
      descripcion: descripcion ?? null,
      notas: notas ?? null
    })

    return NextResponse.json({
      message: 'Comprobante emitido correctamente.',
      data: comprobante
    })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error emitiendo comprobante:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
