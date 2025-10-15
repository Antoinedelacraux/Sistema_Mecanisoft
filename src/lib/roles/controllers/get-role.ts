import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getRoleDetail } from '@/lib/roles/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function getRoleController(idRol: number) {
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

    const detalle = await getRoleDetail(idRol)
    if (!detalle) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      role: detalle.rol,
      permisos: detalle.permisos,
      totalUsuarios: detalle.totalUsuarios
    })
  } catch (error) {
    console.error('[roles:get] Error al obtener rol', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
