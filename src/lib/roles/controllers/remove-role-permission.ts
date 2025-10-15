import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { removePermissionFromRole } from '@/lib/roles/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function removeRolePermissionController(idRol: number, codigoPermiso: string) {
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

    const actorId = Number.parseInt(session.user?.id ?? '', 10)
    if (!Number.isFinite(actorId)) {
      return NextResponse.json({ error: 'Usuario actor inválido' }, { status: 400 })
    }

    await removePermissionFromRole(idRol, codigoPermiso, actorId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Permiso no encontrado' || error.message === 'Rol no encontrado') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'El rol no tenía asignado ese permiso') {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }
    console.error('[roles:permissions:remove] Error al revocar permiso del rol', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
