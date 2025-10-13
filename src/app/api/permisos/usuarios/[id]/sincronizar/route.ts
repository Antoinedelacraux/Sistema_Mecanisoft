import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { sincronizarPermisosUsuarioConRol } from '@/lib/permisos/service'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

function parseId(idRaw: string) {
  const id = parseInt(idRaw, 10)
  if (Number.isNaN(id) || id <= 0) {
    throw new Error('ID inválido')
  }
  return id
}

function parseActorId(rawId: unknown) {
  const value = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN
  if (Number.isNaN(value) || value <= 0) {
    throw new Error('Usuario actor inválido')
  }
  return value
}

type RouteParams = { id: string }

const resolveParams = async (context: { params: Promise<RouteParams> }) => {
  const params = await context.params
  return params
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'permisos.asignar')
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para sincronizar permisos' }, { status: 403 })
      }
      throw error
    }

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await resolveParams(context)
    const idUsuario = parseId(id)
    const actorId = parseActorId(session.user?.id)
    const payload = await request.json().catch(() => ({}))
    const conservarPersonalizaciones = Boolean(payload?.conservarPersonalizaciones)

    const resultado = await sincronizarPermisosUsuarioConRol({
      idUsuario,
      usuarioActorId: actorId,
      conservarPersonalizaciones,
    })

    return NextResponse.json({ resultado })
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (error instanceof Error && error.message === 'Usuario actor inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('Error sincronizando permisos del usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
