import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import {
  obtenerPermisosDeRol,
  obtenerPermisosPersonalizadosDeUsuario,
  obtenerPermisosResueltosDeUsuario,
  setPermisosPersonalizadosDeUsuario
} from '@/lib/permisos/service'

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
      return { error: NextResponse.json({ error: 'No cuentas con permisos para administrar personalizaciones' }, { status: 403 }) } as const
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
    const idUsuario = parseId(id)

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: idUsuario },
      select: { id_usuario: true, id_rol: true }
    })

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const [base, personalizados, resueltos] = await Promise.all([
      obtenerPermisosDeRol(usuario.id_rol),
      obtenerPermisosPersonalizadosDeUsuario(idUsuario),
      obtenerPermisosResueltosDeUsuario(idUsuario)
    ])

    return NextResponse.json({ permisos: { base, personalizados, resueltos } })
  } catch (error) {
    if (error instanceof Error && error.message === 'ID inválido') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error obteniendo permisos del usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const guard = await withPermisosAdmin()
    if ('error' in guard) return guard.error
    const session = guard.session

    const { id } = await resolveParams(context)
    const idUsuario = parseId(id)
    const payload = await request.json()

    const lista = Array.isArray(payload?.personalizaciones) ? payload.personalizaciones : []
    const personalizaciones = lista.filter(
      (item: any) =>
        item &&
        typeof item.codigo === 'string' &&
        item.codigo.trim().length > 0 &&
        typeof item.concedido === 'boolean' &&
        typeof item.origen === 'string' &&
        item.origen.trim().length > 0
    )

    if (!personalizaciones.length) {
      return NextResponse.json({ error: 'Debe proporcionar personalizaciones válidas' }, { status: 400 })
    }

    const actorId = parseActorId(session.user?.id)

    const personalizados = await setPermisosPersonalizadosDeUsuario({
      idUsuario,
      usuarioActorId: actorId,
      personalizaciones: personalizaciones.map((item: any) => ({
        codigo: item.codigo,
        concedido: item.concedido,
        origen: item.origen,
        comentario: typeof item.comentario === 'string' ? item.comentario : null
      })),
      descripcion: typeof payload.descripcion === 'string' ? payload.descripcion : undefined
    })

    const resueltos = await obtenerPermisosResueltosDeUsuario(idUsuario)

    return NextResponse.json({ permisos: { personalizados, resueltos } })
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

    console.error('Error actualizando permisos del usuario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
