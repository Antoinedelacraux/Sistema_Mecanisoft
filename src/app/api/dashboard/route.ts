import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getDashboardSummary, getTopProductos, getVentasPorMetodoPago, getVentasSeries } from '@/lib/dashboard'
import { parseDashboardParams } from '@/lib/dashboard-params'
import { authOptions } from '@/lib/auth'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

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

  const { filters, granularity, topLimit } = parseDashboardParams(searchParams)

  try {
    const [summary, series, ventasMetodoPago, topProductos] = await Promise.all([
      getDashboardSummary(filters),
      getVentasSeries(filters, granularity),
      getVentasPorMetodoPago(filters),
      getTopProductos(filters, topLimit)
    ])

    return NextResponse.json(
      {
        summary,
        ventasSeries: series,
        ventasMetodoPago,
        topProductos
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error al consultar dashboard', error)
    return NextResponse.json({ error: 'No se pudo cargar la información del dashboard.' }, { status: 500 })
  }
}
