import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { updateRole } from '@/lib/roles/service'
import { parseUpdateRolePayload } from '@/lib/roles/validators'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function updateRoleController(idRol: number, request: NextRequest) {
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
    const data = parseUpdateRolePayload(payload)

    const actorId = Number.parseInt(session.user?.id ?? '', 10)
    if (!Number.isFinite(actorId)) {
      return NextResponse.json({ error: 'Usuario actor inválido' }, { status: 400 })
    }

    const detalle = await updateRole(idRol, data, actorId)

    return NextResponse.json({
      role: detalle.rol,
      permisos: detalle.permisos,
      totalUsuarios: detalle.totalUsuarios
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Rol no encontrado') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'Ya existe un rol con ese nombre') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }
    console.error('[roles:update] Error al actualizar rol', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
