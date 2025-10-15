import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { disableRole } from '@/lib/roles/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function deleteRoleController(idRol: number) {
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

    const detalle = await disableRole(idRol, actorId)

    return NextResponse.json({
      role: detalle.rol,
      permisos: detalle.permisos,
      totalUsuarios: detalle.totalUsuarios
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'No se pudo recuperar el rol deshabilitado') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[roles:delete] Error al deshabilitar rol', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
