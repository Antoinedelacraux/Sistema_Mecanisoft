import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { listarCatalogoPermisos } from '@/lib/permisos/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'permisos.asignar')
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para administrar permisos' }, { status: 403 })
      }
      throw error
    }

    const { searchParams } = new URL(request.url)
    const incluirInactivos = searchParams.get('incluirInactivos') === 'true'

    const permisos = await listarCatalogoPermisos({ incluirInactivos })

    return NextResponse.json({ permisos })
  } catch (error) {
    console.error('Error obteniendo catálogo de permisos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
