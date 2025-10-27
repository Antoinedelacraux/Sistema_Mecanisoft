import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/reportes/metrics'

function toPrometheus(m: Record<string, number>) {
  // basic exposition
  return Object.entries(m).map(([k, v]) => `reportes_${k} ${v}`).join('\n') + '\n'
}

export async function GET() {
  try {
    const m = getMetrics()
    const text = toPrometheus(m)
    return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; version=0.0.4' } })
  } catch (err) {
    console.error('[reportes/metrics/prometheus] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
