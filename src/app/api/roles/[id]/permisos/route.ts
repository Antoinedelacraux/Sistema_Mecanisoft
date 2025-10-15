import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { listRolePermissionsController } from '@/lib/roles/controllers/list-role-permissions'
import { assignRolePermissionsController } from '@/lib/roles/controllers/assign-role-permissions'

type RouteParams = { id: string }
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

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await resolveParams(context)
    const idRol = parseIdRol(id)
    return listRolePermissionsController(idRol)
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[roles:permisos:GET] Error procesando la solicitud', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await resolveParams(context)
    const idRol = parseIdRol(id)
    return assignRolePermissionsController(idRol, request)
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[roles:permisos:POST] Error procesando la solicitud', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
