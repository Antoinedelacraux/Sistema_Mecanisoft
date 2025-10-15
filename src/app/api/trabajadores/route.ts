import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/lib/auth'
import { listTrabajadores } from './controllers/list-controller'
import { createTrabajador } from './controllers/create-controller'
import { ApiError } from './controllers/errors'

const parseEstado = (value: string | null) => {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  if (['activos', 'inactivos', 'baja', 'todos'].includes(normalized)) {
    return normalized as 'activos' | 'inactivos' | 'baja' | 'todos'
  }
  return undefined
}

const handleError = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[Trabajadores API] Error:', error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const estado = parseEstado(searchParams.get('estado'))

    const trabajadores = await listTrabajadores({
      search: searchParams.get('search'),
      cargo: searchParams.get('cargo'),
      estado,
      includeInactive: searchParams.get('include_inactive') === 'true',
      soloActivos: searchParams.get('solo_activos') === 'true',
      usuarioId: searchParams.get('usuario_id') ? Number(searchParams.get('usuario_id')) : null
    })

    return NextResponse.json({ trabajadores })
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
    const resultado = await createTrabajador(payload, Number(session.user.id))
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}