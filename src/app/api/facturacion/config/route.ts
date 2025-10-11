import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { getFacturacionConfigCompleta, updateFacturacionConfig } from '@/lib/facturacion/config'
import { FacturacionError } from '@/lib/facturacion/errors'

const bodySchema = z.object({
  afecta_igv: z.boolean(),
  igv_porcentaje: z.coerce.number().min(0).max(1),
  serie_boleta_default: z.string().trim().min(1).max(10),
  serie_factura_default: z.string().trim().min(1).max(10),
  precios_incluyen_igv_default: z.boolean(),
  moneda_default: z.string().trim().length(3)
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const config = await getFacturacionConfigCompleta()
    return NextResponse.json({ data: config })
  } catch (error) {
    console.error('Error obteniendo configuración de facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const updated = await updateFacturacionConfig(parsed.data)
    return NextResponse.json({ message: 'Configuración actualizada correctamente.', data: updated })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error actualizando configuración de facturación:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
