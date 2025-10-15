import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { createRole } from '@/lib/roles/service'
import { parseCreateRolePayload } from '@/lib/roles/validators'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function createRoleController(request: NextRequest) {
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
    const data = parseCreateRolePayload(payload)
    const actorId = Number.parseInt(session.user?.id ?? '', 10)
    if (!Number.isFinite(actorId)) {
      return NextResponse.json({ error: 'Usuario actor inválido' }, { status: 400 })
    }

    const detalle = await createRole(data, actorId)

    return NextResponse.json({
      role: detalle.rol,
      permisos: detalle.permisos,
      totalUsuarios: detalle.totalUsuarios
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Ya existe un rol con ese nombre') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[roles:create] Error al crear rol', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
