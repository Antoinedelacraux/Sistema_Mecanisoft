import { NextResponse } from 'next/server'

import { removeRolePermissionController } from '@/lib/roles/controllers/remove-role-permission'

type RouteParams = { id: string; codigo: string }
type Context = { params: RouteParams | Promise<RouteParams> }

async function resolveParams(context: Context): Promise<RouteParams> {
  const params = await context.params
  return params
}

function parseIdRol(id: string): number {
  const value = Number.parseInt(id, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('ID inválido')
  }
  return value
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id, codigo } = await resolveParams(context)
    const idRol = parseIdRol(id)
    const codigoPermiso = decodeURIComponent(codigo)

    if (!codigoPermiso) {
      return NextResponse.json({ error: 'Código de permiso inválido' }, { status: 400 })
    }

    return removeRolePermissionController(idRol, codigoPermiso)
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[roles:permisos:DELETE] Error procesando la solicitud', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
