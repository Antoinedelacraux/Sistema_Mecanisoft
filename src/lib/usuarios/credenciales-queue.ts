import { Queue } from 'bullmq'

import { prisma } from '@/lib/prisma'
import { enviarCredenciales } from './credenciales'
import { logger } from '@/lib/logger'

export const USUARIOS_QUEUE_NAME = process.env.USUARIOS_QUEUE_NAME || 'usuarios'
export const JOB_REENVIAR_PENDIENTES = 'usuarios.reprocesar-pendientes'

export type ReprocesarPendientesPayload = {
  limit?: number
  triggeredBy?: number
  asunto?: string
  mensaje_adicional?: string | null
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 200

const resolveLimit = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_LIMIT
  }
  const normalized = Math.floor(value)
  if (normalized <= 0) return DEFAULT_LIMIT
  return Math.min(normalized, MAX_LIMIT)
}

export const resolveSystemUserId = (override?: number) => {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override
  }
  const envValue = process.env.USUARIOS_SYSTEM_USER_ID || process.env.SYSTEM_USER_ID
  if (!envValue) {
    return 1
  }
  const parsed = Number(envValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const resolveAsunto = (input?: string) => {
  if (!input) return 'Credenciales de acceso'
  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : 'Credenciales de acceso'
}

const resolveMensaje = (input?: string | null) => {
  if (input === undefined) {
    const autoMessage = process.env.USUARIOS_CREDENCIALES_MENSAJE_AUTO
    return autoMessage ? autoMessage.trim() : 'Este es un reenvío automático de credenciales. Si no puedes acceder, contacta a soporte.'
  }
  if (input === null) return null
  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function procesarCredencialesPendientes(payload: ReprocesarPendientesPayload = {}) {
  const limit = resolveLimit(payload.limit)
  const triggeredBy = resolveSystemUserId(payload.triggeredBy)
  const asunto = resolveAsunto(payload.asunto)
  const mensajeAdicional = resolveMensaje(payload.mensaje_adicional)

  const pendientes = await prisma.usuario.findMany({
    where: { envio_credenciales_pendiente: true },
    orderBy: [
      { ultimo_envio_credenciales: 'asc' },
      { id_usuario: 'asc' }
    ],
    take: limit,
    select: { id_usuario: true }
  })

  let procesados = 0
  const errores: Array<{ usuarioId: number; error: string }> = []

  for (const usuario of pendientes) {
    try {
      await enviarCredenciales({
        usuarioId: usuario.id_usuario,
        payload: {
          asunto,
          mensaje_adicional: mensajeAdicional
        },
        sessionUserId: triggeredBy
      })
      procesados += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errores.push({ usuarioId: usuario.id_usuario, error: message })
      logger.error({ usuarioId: usuario.id_usuario, err: message }, '[usuarios] fallo al reenviar credenciales pendientes')
    }
  }

  return {
    encontrados: pendientes.length,
    procesados,
    errores
  }
}

export async function enqueueReprocesarPendientes(queue: Queue, payload: ReprocesarPendientesPayload = {}) {
  await queue.add(JOB_REENVIAR_PENDIENTES, payload, {
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 }
  })
}
