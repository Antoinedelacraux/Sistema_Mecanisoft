import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/reportes/metrics'

export async function GET() {
  try {
    const m = getMetrics()
    return NextResponse.json({ success: true, metrics: m })
  } catch (err) {
    console.error('[reportes/metrics] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
