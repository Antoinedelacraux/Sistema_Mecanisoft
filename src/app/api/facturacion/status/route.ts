import { NextResponse } from 'next/server'

import { assertFacturacionDisponible } from '@/lib/facturacion/config'
import { FacturacionError } from '@/lib/facturacion/errors'

export async function GET() {
  try {
    await assertFacturacionDisponible()
    return NextResponse.json({ habilitada: true })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ habilitada: false, reason: error.message })
    }

    console.error('[facturacion/status] unexpected error', error)
    return NextResponse.json({ habilitada: false, reason: 'No se pudo verificar el estado de facturación.' }, { status: 500 })
  }
}
