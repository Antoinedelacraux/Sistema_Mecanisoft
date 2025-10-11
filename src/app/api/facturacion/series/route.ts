import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { TipoComprobante } from '@prisma/client'

import { listarSeries, crearSerie } from '@/lib/facturacion/series'
import { FacturacionError } from '@/lib/facturacion/errors'

const querySchema = z.object({
  tipo: z.enum(['BOLETA', 'FACTURA']).optional(),
  activo: z.enum(['true', 'false']).optional()
})

const bodySchema = z.object({
  tipo: z.enum(['BOLETA', 'FACTURA']),
  serie: z.string().trim().min(1).max(10),
  descripcion: z.string().trim().max(150).optional(),
  correlativo_inicial: z
    .union([z.coerce.number().int().min(0), z.undefined()])
    .optional(),
  activo: z.boolean().optional(),
  establecer_como_default: z.boolean().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const parsed = querySchema.safeParse({
      tipo: searchParams.get('tipo') ?? undefined,
      activo: searchParams.get('activo') ?? undefined
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { tipo, activo } = parsed.data
    const tipoFiltro = tipo ? (tipo as TipoComprobante) : undefined
    const activoFlag = typeof activo === 'string' ? activo === 'true' : undefined
    const series = await listarSeries({
      tipo: tipoFiltro,
      activo: activoFlag
    })

    return NextResponse.json({ data: series })
  } catch (error) {
    console.error('Error listando series de facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
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

    const serie = await crearSerie(parsed.data)
    return NextResponse.json({ message: 'Serie creada correctamente.', data: serie }, { status: 201 })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error creando serie de facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
