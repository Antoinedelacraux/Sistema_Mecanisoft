import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/lib/auth'
import { ApiError } from '../controllers/errors'
import { getTrabajadorOrThrow } from '../controllers/detail-controller'
import { updateTrabajador } from '../controllers/update-controller'
import { handleTrabajadorStatus } from '../controllers/status-controller'

type ParamsMaybePromise = { params: { id: string } } | { params: Promise<{ id: string }> }

const resolveParams = async (params: ParamsMaybePromise['params']) =>
  params instanceof Promise ? params : params

const parseId = (idParam: string) => {
  const id = Number(idParam)
  if (Number.isNaN(id)) {
    throw new ApiError(400, 'ID inválido')
  }
  return id
}

const handleError = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[Trabajadores API] Error:', error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}

export async function GET(request: NextRequest, ctx: ParamsMaybePromise) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await resolveParams(ctx.params)
    const trabajador = await getTrabajadorOrThrow(parseId(id))
    return NextResponse.json(trabajador)
  } catch (error) {
    return handleError(error)
  }
}

export async function PUT(request: NextRequest, ctx: ParamsMaybePromise) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await resolveParams(ctx.params)
    const payload = await request.json()
    const trabajador = await updateTrabajador(parseId(id), payload, Number(session.user.id))
    return NextResponse.json(trabajador)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest, ctx: ParamsMaybePromise) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await resolveParams(ctx.params)
    const payload = await request.json()
    const trabajador = await handleTrabajadorStatus(parseId(id), payload, Number(session.user.id))
    return NextResponse.json(trabajador)
  } catch (error) {
    return handleError(error)
  }
}