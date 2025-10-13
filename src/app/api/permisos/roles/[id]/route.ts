import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { obtenerPermisosDeRol, setPermisosDeRol } from '@/lib/permisos/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

function parseId(idRaw: string) {
  const id = parseInt(idRaw, 10)
  if (Number.isNaN(id) || id <= 0) {
    throw new Error('ID inválido')
  }
  return id
}

function isPermisosNoEncontradosError(error: unknown) {
  return error instanceof Error && error.message.includes('Permisos no encontrados')
}

function parseActorId(rawId: unknown) {
  const value = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN
  if (Number.isNaN(value) || value <= 0) {
    throw new Error('Usuario actor inválido')
  }
  return value
}

const withPermisosAdmin = async () => {
  const session = await getServerSession(authOptions)
  try {
    await asegurarPermiso(session, 'permisos.asignar')
    if (!session) {
      return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
    }
    return { session } as const
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
    }
    if (error instanceof PermisoDenegadoError) {
      return { error: NextResponse.json({ error: 'No cuentas con permisos para administrar plantillas de permisos' }, { status: 403 }) } as const
    }
    throw error
  }
}

type RouteParams = { id: string }

const resolveParams = async (context: { params: Promise<RouteParams> }) => {
  const params = await context.params
  return params
}

export async function GET(_: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const guard = await withPermisosAdmin()
    if ('error' in guard) return guard.error

    const { id } = await resolveParams(context)
    const idRol = parseId(id)
    const permisos = await obtenerPermisosDeRol(idRol)

    return NextResponse.json({ permisos })
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error obteniendo permisos del rol:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const guard = await withPermisosAdmin()
    if ('error' in guard) return guard.error
    const session = guard.session

    const { id } = await resolveParams(context)
    const idRol = parseId(id)
    const payload = await request.json()

    if (!payload || !Array.isArray(payload.codigos)) {
      return NextResponse.json({ error: 'Lista de códigos requerida' }, { status: 400 })
    }

    const codigos = payload.codigos.filter((codigo: unknown): codigo is string => typeof codigo === 'string' && codigo.trim().length > 0)

    const actorId = parseActorId(session.user?.id)

    const permisosActualizados = await setPermisosDeRol({
      idRol,
      codigosPermisos: codigos,
      usuarioActorId: actorId,
      descripcion: typeof payload.descripcion === 'string' ? payload.descripcion : undefined
    })

    return NextResponse.json({ permisos: permisosActualizados })
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (isPermisosNoEncontradosError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    }

    if (error instanceof Error && error.message === 'Usuario actor inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error actualizando permisos del rol:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
