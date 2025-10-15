import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { listPermisosAgrupados } from '@/lib/roles/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function listPermissionsByModuleController() {
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

    const modulos = await listPermisosAgrupados()

    return NextResponse.json({ modulos })
  } catch (error) {
    console.error('[roles:permissions:modules] Error al listar permisos agrupados', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
