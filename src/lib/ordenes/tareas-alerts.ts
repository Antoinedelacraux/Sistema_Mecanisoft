import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'

export const ORDENES_QUEUE_NAME = process.env.ORDENES_QUEUE_NAME || 'ordenes'
export const ORDENES_JOB_TAREAS_ALERTA = 'ordenes.alerta-tareas-pausadas'

const DEFAULT_THRESHOLD_HOURS = 12
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export type TareaPausadaCritica = {
  idTarea: number
  codigoOrden: string
  prioridad: string | null
  servicio: string | null
  trabajador: string | null
  horasPausada: number
  pausadaDesde: string
  cliente: string | null
}

export type TareasPausadasResultado = {
  total: number
  tareas: TareaPausadaCritica[]
  thresholdHours: number
  cutoff: string
}

export type TareasAlertJobPayload = {
  thresholdHours?: number
  limit?: number
  recipients?: string | string[]
  triggeredBy?: number
  slackWebhook?: string | null
}

const resolveThresholdHours = (value?: number) => {
  const envValue = process.env.TAREAS_PAUSADAS_THRESHOLD_HOURS
  const source = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : envValue ? Number(envValue) : undefined
  if (typeof source !== 'number' || Number.isNaN(source) || source <= 0) {
    return DEFAULT_THRESHOLD_HOURS
  }
  return Math.min(Math.floor(source), 24 * 14)
}

const resolveLimit = (value?: number) => {
  const envValue = process.env.TAREAS_PAUSADAS_ALERT_LIMIT
  const source = typeof value === 'number' && Number.isFinite(value) ? value : envValue ? Number(envValue) : undefined
  if (typeof source !== 'number' || Number.isNaN(source) || source <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(source), MAX_LIMIT)
}

const parseRecipients = (value?: string | string[]) => {
  const list: string[] = []

  const push = (input?: string | null) => {
    if (!input) return
    const cleaned = input.trim()
    if (!cleaned) return
    if (!list.includes(cleaned)) {
      list.push(cleaned)
    }
  }

  if (Array.isArray(value)) {
    value.forEach(push)
  } else if (typeof value === 'string') {
    value.split(',').forEach(push)
  }

  const envRecipients = process.env.TAREAS_ALERT_RECIPIENTS
  if (envRecipients) {
    envRecipients.split(',').forEach(push)
  }

  return list
}

const formatPersona = (persona?: { nombre: string; apellido_paterno: string; apellido_materno: string | null }) => {
  if (!persona) return null
  return [persona.nombre, persona.apellido_paterno, persona.apellido_materno?.trim()].filter(Boolean).join(' ')
}

export async function obtenerTareasPausadasCriticas(payload: TareasAlertJobPayload = {}): Promise<TareasPausadasResultado> {
  const thresholdHours = resolveThresholdHours(payload.thresholdHours)
  const limit = resolveLimit(payload.limit)
  const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000)

  const tareas = await prisma.tarea.findMany({
    where: {
      estado: 'pausado',
      updated_at: {
        lt: cutoff,
      },
    },
    orderBy: [{ updated_at: 'asc' }],
    take: limit,
    select: {
      id_tarea: true,
      updated_at: true,
      detalle_transaccion: {
        select: {
          servicio: {
            select: { nombre: true },
          },
          transaccion: {
            select: {
              codigo_transaccion: true,
              prioridad: true,
              persona: {
                select: {
                  nombre: true,
                  apellido_paterno: true,
                  apellido_materno: true,
                },
              },
            },
          },
        },
      },
      trabajador: {
        select: {
          persona: {
            select: {
              nombre: true,
              apellido_paterno: true,
              apellido_materno: true,
            },
          },
        },
      },
    },
  })

  const mapped: TareaPausadaCritica[] = tareas.map((tarea) => {
    const orden = tarea.detalle_transaccion?.transaccion
    const servicio = tarea.detalle_transaccion?.servicio
    const trabajador = tarea.trabajador

    const updatedAt = tarea.updated_at ?? cutoff
    const hoursDiff = Math.max((Date.now() - updatedAt.getTime()) / (60 * 60 * 1000), thresholdHours)

    return {
      idTarea: tarea.id_tarea,
      codigoOrden: orden?.codigo_transaccion ?? 'N/D',
      prioridad: orden?.prioridad ?? null,
      servicio: servicio?.nombre ?? null,
      trabajador: formatPersona(trabajador?.persona ?? undefined),
      horasPausada: Number(hoursDiff.toFixed(2)),
      pausadaDesde: updatedAt.toISOString(),
      cliente: formatPersona(orden?.persona ?? undefined),
    }
  })

  return {
    total: mapped.length,
    tareas: mapped,
    thresholdHours,
    cutoff: cutoff.toISOString(),
  }
}

const resolveSlackWebhook = (explicit?: string | null) => {
  if (explicit) return explicit
  const fromEnv = process.env.TAREAS_ALERT_SLACK_WEBHOOK
  if (!fromEnv) return null
  const trimmed = fromEnv.trim()
  return trimmed.length > 0 ? trimmed : null
}

const buildEmailBody = (resultado: TareasPausadasResultado, triggeredBy?: number) => {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const lines = resultado.tareas.slice(0, 15).map((tarea) => {
    const horas = tarea.horasPausada.toFixed(1)
    const trabajador = tarea.trabajador ?? 'Sin asignar'
    const servicio = tarea.servicio ?? 'Servicio sin nombre'
    return `- Orden ${tarea.codigoOrden} · Tarea ${tarea.idTarea} (${servicio}) · ${horas}h en pausa · Responsable: ${trabajador}`
  })

  const remaining = resultado.tareas.length > 15
    ? `\n…y ${resultado.tareas.length - 15} tarea(s) adicionales por encima de ${resultado.thresholdHours}h.`
    : ''

  const text = [
    `Se encontraron ${resultado.tareas.length} tareas en estado 'pausado' por más de ${resultado.thresholdHours} horas.`,
    '',
    lines.join('\n') || 'No se listaron tareas específicas.',
    remaining,
    '',
    `Detalle completo en ${baseUrl}/dashboard/tareas`,
    triggeredBy ? `Alerta solicitada por usuario ID ${triggeredBy}.` : null,
    `Generado en: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n')

  const subject = `[Órdenes] ${resultado.tareas.length} tarea(s) pausadas sobre ${resultado.thresholdHours}h`
  return { subject, text }
}

const sendSlack = async (resultado: TareasPausadasResultado, webhook: string | null) => {
  if (!webhook) return
  try {
    const head = resultado.tareas.slice(0, 10).map((tarea) => `• Orden ${tarea.codigoOrden} · ${tarea.horasPausada.toFixed(1)}h en pausa · ${tarea.trabajador ?? 'Sin asignar'}`)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const text = [
      `⏸️ *Tareas en pausa*: ${resultado.tareas.length} detectadas por encima de ${resultado.thresholdHours}h`,
      ...head,
      head.length >= 10 && resultado.tareas.length > 10 ? `…y ${resultado.tareas.length - 10} adicionales.` : null,
      `Revisa ${baseUrl}/dashboard/tareas para más detalles.`,
    ].filter(Boolean).join('\n')
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    logger.info({ total: resultado.tareas.length }, '[ordenes] alerta slack de tareas pausadas enviada')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: message }, '[ordenes] error enviando alerta slack de tareas pausadas')
  }
}

export async function procesarAlertasTareasPausadas(payload: TareasAlertJobPayload = {}) {
  const resultado = await obtenerTareasPausadasCriticas(payload)
  if (resultado.total === 0) {
    logger.info('[ordenes] sin tareas pausadas críticas, alerta omitida')
    return {
      total: 0,
      notified: false,
      reason: 'NO_TASKS' as const,
    }
  }

  const recipients = parseRecipients(payload.recipients)
  if (recipients.length === 0) {
    logger.warn('[ordenes] alerta tareas pausadas omitida: sin destinatarios configurados')
    return {
      total: resultado.total,
      notified: false,
      reason: 'NO_RECIPIENTS' as const,
    }
  }

  const { subject, text } = buildEmailBody(resultado, payload.triggeredBy)
  await sendMail({ to: recipients.join(','), subject, text })
  await sendSlack(resultado, resolveSlackWebhook(payload.slackWebhook ?? null))

  logger.info({ total: resultado.total, recipients: recipients.length }, '[ordenes] alerta de tareas pausadas enviada')

  return {
    total: resultado.total,
    notified: true,
    recipients,
  }
}
