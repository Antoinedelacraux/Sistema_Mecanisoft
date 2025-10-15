import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { assignPermissionsToRole } from '@/lib/roles/service'
import { parseAssignPermissionsPayload } from '@/lib/roles/validators'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function assignRolePermissionsController(idRol: number, request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const data = parseAssignPermissionsPayload(payload)

    const actorId = Number.parseInt(session.user?.id ?? '', 10)
    if (!Number.isFinite(actorId)) {
      return NextResponse.json({ error: 'Usuario actor inválido' }, { status: 400 })
    }

    const permisos = await assignPermissionsToRole(idRol, data, actorId)

    return NextResponse.json({ permisos })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permisos no encontrados')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[roles:permissions:assign] Error al asignar permisos al rol', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
