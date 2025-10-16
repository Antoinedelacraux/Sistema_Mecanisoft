import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getVentasSeries } from '@/lib/dashboard'
import { parseDashboardParams } from '@/lib/dashboard-params'
import { authOptions } from '@/lib/auth'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermiso(session, 'dashboard.ver')
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
    }
    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: 'No cuentas con permisos para consultar el dashboard.' }, { status: 403 })
    }
    throw error
  }

  const { searchParams } = new URL(request.url)
  const { filters, granularity } = parseDashboardParams(searchParams)
  const format = searchParams.get('format')

  try {
    const series = await getVentasSeries(filters, granularity)
    if (format?.toLowerCase() === 'csv') {
      const csvRows = ['label,date,total', ...series.map((item) => `${item.label},${item.date},${item.total.toFixed(2)}`)]
      return new NextResponse(csvRows.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="ventas-series.csv"'
        }
      })
    }
    return NextResponse.json({ series })
  } catch (error) {
    console.error('Error al consultar series de ventas del dashboard', error)
    return NextResponse.json({ error: 'No se pudieron cargar las series de ventas.' }, { status: 500 })
  }
}
