import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { listUsuarios } from './controllers/list-controller'
import { createUsuario } from './controllers/create-controller'
import { ApiError } from './controllers/errors'

const parseBoolean = (value: string | null) => {
  if (!value) return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const parseDate = (value: string | null) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const parseEstado = (value: string | null) => {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  if (['activos', 'inactivos', 'todos'].includes(normalized)) {
    return normalized as 'activos' | 'inactivos' | 'todos'
  }
  return undefined
}

const handleError = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[Usuarios API] Error:', error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const resultado = await listUsuarios({
      search: searchParams.get('search'),
      rol: searchParams.get('rol'),
      estado: parseEstado(searchParams.get('estado')),
      requiereCambio: parseBoolean(searchParams.get('requiere_cambio')) ?? null,
      pendientesEnvio: parseBoolean(searchParams.get('pendientes_envio')) ?? null,
      fechaDesde: parseDate(searchParams.get('fecha_desde')) ?? null,
      fechaHasta: parseDate(searchParams.get('fecha_hasta')) ?? null,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20
    })

    return NextResponse.json(resultado)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const resultado = await createUsuario(payload, Number(session.user.id))
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
