import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getVentasPorMetodoPago } from '@/lib/dashboard'
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
  const { filters } = parseDashboardParams(searchParams)

  try {
    const ventasMetodoPago = await getVentasPorMetodoPago(filters)
    return NextResponse.json({ ventasMetodoPago })
  } catch (error) {
    console.error('Error al consultar método de pago del dashboard', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos por método de pago.' }, { status: 500 })
  }
}
