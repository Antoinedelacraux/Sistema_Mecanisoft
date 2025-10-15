import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { listRoles } from '@/lib/roles/service'
import { parseListRolesQuery } from '@/lib/roles/validators'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function listRolesController(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const query = parseListRolesQuery(request.nextUrl.searchParams)
    const requierePermiso = query.includeInactive || query.includeStats

    if (requierePermiso) {
      try {
        await asegurarPermiso(session, 'roles.administrar')
      } catch (error) {
        if (error instanceof SesionInvalidaError) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        if (error instanceof PermisoDenegadoError) {
          return NextResponse.json({ error: 'No cuentas con permisos para administrar roles' }, { status: 403 })
        }
        throw error
      }
    }

    const roles = await listRoles(
      {
        search: query.search,
        includeInactive: requierePermiso ? query.includeInactive : false,
        includeStats: requierePermiso ? query.includeStats : false
      },
      undefined
    )

    return NextResponse.json({ roles })
  } catch (error) {
    console.error('[roles:list] Error al listar roles', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
