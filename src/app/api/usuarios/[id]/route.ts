import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { ApiError } from '../controllers/errors'
import { getUsuarioOrThrow } from '../controllers/detail-controller'
import { updateUsuario } from '../controllers/update-controller'
import { changeEstadoUsuario, deleteUsuario } from '../controllers/status-controller'
import { resetPasswordUsuario } from '../controllers/reset-password-controller'
import { registrarEnvioCredenciales } from '../controllers/notifications-controller'
import { enviarCredencialesUsuario } from '../controllers/send-credentials-controller'

const handleError = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[Usuarios API] Error:', error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}

interface RouteParams {
  id: string
}

const parseContextId = async (context: { params: Promise<RouteParams> }) => {
  const { id } = await context.params
  return Number(id)
}

export async function GET(_request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = await parseContextId(context)
    const usuario = await getUsuarioOrThrow(id)
    return NextResponse.json({ usuario })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = await parseContextId(context)
    const payload = await request.json()
    const action = typeof payload?.action === 'string' ? payload.action : 'update'

    if (action === 'estado') {
      const estado = payload.estado
      if (typeof estado !== 'boolean') {
        throw new ApiError(400, 'Estado inválido')
      }
      const resultado = await changeEstadoUsuario({
        id,
        estado,
        motivo: typeof payload?.motivo === 'string' ? payload.motivo : undefined,
        sessionUserId: Number(session.user.id)
      })
      return NextResponse.json(resultado)
    }

    if (action === 'reset_password') {
      const resultado = await resetPasswordUsuario(id, payload, Number(session.user.id))
      return NextResponse.json(resultado)
    }

    if (action === 'registrar_envio') {
      const resultado = await registrarEnvioCredenciales({
        id,
        exitoso: Boolean(payload?.exitoso),
        error: typeof payload?.error === 'string' ? payload.error : null,
        sessionUserId: Number(session.user.id)
      })
      return NextResponse.json(resultado)
    }

    if (action === 'enviar_credenciales') {
      const resultado = await enviarCredencialesUsuario(
        id,
        payload,
        Number(session.user.id)
      )
      return NextResponse.json(resultado)
    }

    const { action: _ignored, ...rest } = payload ?? {}
    const resultado = await updateUsuario(id, rest, Number(session.user.id))
    return NextResponse.json(resultado)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = await parseContextId(context)
    const resultado = await deleteUsuario(id, Number(session.user.id))
    return NextResponse.json(resultado)
  } catch (error) {
    return handleError(error)
  }
}
