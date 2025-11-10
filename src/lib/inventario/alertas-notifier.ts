import { Queue } from 'bullmq'

import { logger } from '@/lib/logger'
import { createRedisConnection } from '@/lib/redisClient'
import { sendMail } from '@/lib/mailer'
import type { InventarioResumenCritico } from '@/types/inventario'

const DEFAULT_REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const INVENTORY_ALERT_EMAIL_JOB = 'inventario-alert-email'

export type InventoryAlertEmailJobPayload = {
  productos: InventarioResumenCritico[]
  totalCriticos: number
  recipients: string[]
  triggeredBy?: number | null
  triggeredAt: string
  slackWebhook?: string | null
}

export type InventoryAlertEnqueueResult = {
  queued: boolean
  recipients: string[]
  reason?: string
}

const parseRecipients = (value?: string | string[]): string[] => {
  const list: string[] = []

  const push = (input?: string | null) => {
    if (!input) return
    const cleaned = input.trim()
    if (!cleaned) return
    if (!list.includes(cleaned)) {
      list.push(cleaned)
    }
  }

  const normalized = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  for (const entry of normalized) {
    push(entry)
  }

  const additional = process.env.INVENTARIO_ALERT_RECIPIENTS || ''
  if (additional) {
    for (const entry of additional.split(',')) {
      push(entry)
    }
  }

  return list
}

const shouldUseRedisFallback = () => process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true'

const buildEmailBody = (payload: InventoryAlertEmailJobPayload): { subject: string; text: string } => {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const lines = payload.productos.slice(0, 10).map((producto) => {
    return `- ${producto.nombre} (${producto.codigo_producto}) · Almacén: ${producto.almacen} · Disponible: ${producto.stock_disponible} · Mínimo: ${producto.stock_minimo}`
  })

  const remaining = payload.productos.length > 10
    ? `\n…y ${payload.productos.length - 10} producto(s) adicionales en nivel crítico.`
    : ''

  const text = [
    `Se detectaron ${payload.totalCriticos} producto(s) con stock por debajo del mínimo configurado.`,
    '',
    lines.join('\n') || 'No se registraron productos específicos en la alerta.',
    remaining,
    '',
    `Revisa el detalle completo en ${baseUrl}/dashboard/inventario`,
    payload.triggeredBy ? `Alertado por usuario ID: ${payload.triggeredBy}` : '',
    `Generado en: ${payload.triggeredAt}`,
  ].filter(Boolean).join('\n')

  const subject = `[Inventario] ${payload.totalCriticos} producto(s) en stock crítico`
  return { subject, text }
}

const resolveSlackWebhook = (explicit?: string | null) => {
  if (explicit) {
    return explicit
  }
  const envValue = process.env.INVENTARIO_ALERT_SLACK_WEBHOOK
  if (!envValue) return null
  const trimmed = envValue.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function sendSlackNotification(payload: InventoryAlertEmailJobPayload) {
  const webhook = resolveSlackWebhook(payload.slackWebhook ?? null)
  if (!webhook) {
    return
  }

  try {
    const summaryLines = payload.productos.slice(0, 10).map((producto) => `• ${producto.nombre} (${producto.codigo_producto}) · Disp: ${producto.stock_disponible} · Min: ${producto.stock_minimo}`)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const text = [
      `🚨 *Inventario crítico*: ${payload.totalCriticos} producto(s) debajo del mínimo`,
      ...summaryLines,
      summaryLines.length >= 10 && payload.productos.length > 10
        ? `…y ${payload.productos.length - 10} productos adicionales`
        : null,
      `Detalle completo: ${baseUrl}/dashboard/inventario`,
    ].filter(Boolean).join('\n')

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    logger.info({ totalCriticos: payload.totalCriticos }, 'inventory-alert slack notification sent')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: message }, 'inventory-alert slack notification failed')
  }
}

export async function sendInventoryAlertEmailJob(payload: InventoryAlertEmailJobPayload) {
  if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
    logger.warn('inventory-alert-email job skipped: no recipients configurados', { totalCriticos: payload.totalCriticos })
    return { sent: false, reason: 'NO_RECIPIENTS' as const }
  }

  const { subject, text } = buildEmailBody(payload)

  await sendMail({ to: payload.recipients.join(','), subject, text })
  logger.info({ recipients: payload.recipients.length, totalCriticos: payload.totalCriticos }, 'inventory-alert-email job processed')
  await sendSlackNotification(payload)
  return { sent: true }
}

export async function enqueueInventoryAlertNotification(params: {
  productos: InventarioResumenCritico[]
  totalCriticos: number
  triggeredBy?: number | null
  recipients?: string | string[]
  force?: boolean
  slackWebhook?: string | null
}): Promise<InventoryAlertEnqueueResult> {
  const recipients = parseRecipients(params.recipients)
  if (recipients.length === 0) {
    logger.warn('inventory-alert notification no ejecutada: sin destinatarios configurados')
    return { queued: false, recipients: [], reason: 'NO_RECIPIENTS' }
  }

  if (params.totalCriticos === 0 && params.force !== true) {
    logger.debug('inventory-alert notification omitida: no hay productos críticos', { recipients })
    return { queued: false, recipients, reason: 'NO_ALERTS' }
  }

  const payload: InventoryAlertEmailJobPayload = {
    productos: params.productos,
    totalCriticos: params.totalCriticos,
    triggeredBy: params.triggeredBy ?? null,
    triggeredAt: new Date().toISOString(),
    recipients,
    slackWebhook: params.slackWebhook ?? null,
  }

  if (shouldUseRedisFallback()) {
    logger.warn('Redis en modo fallback; enviando alerta de inventario directamente')
    await sendInventoryAlertEmailJob(payload)
    return { queued: false, recipients, reason: 'FALLBACK_DIRECT' }
  }

  let connection: any | undefined
  let queue: InstanceType<typeof Queue> | null = null
  const queueName = process.env.REPORTS_QUEUE_NAME || 'reportes'
  try {
    connection = await createRedisConnection(DEFAULT_REDIS_URL)
    queue = new Queue(queueName, { connection })

    await queue.add(INVENTORY_ALERT_EMAIL_JOB, payload, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    })

    logger.info({ queue: queueName, recipients: recipients.length }, 'Inventario alerta encolada exitosamente')
    return { queued: true, recipients }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: message }, 'Error al encolar alerta de inventario; ejecutando fallback directo')
    try {
      await sendInventoryAlertEmailJob(payload)
      return { queued: false, recipients, reason: 'QUEUE_UNAVAILABLE' }
    } catch (sendError) {
      const sendMessage = sendError instanceof Error ? sendError.message : String(sendError)
      logger.error({ err: sendMessage }, 'Fallo al enviar alerta de inventario en fallback')
      throw sendError
    }
  } finally {
    if (queue) {
      try {
        await queue.close()
      } catch (closeError) {
        const closeMessage = closeError instanceof Error ? closeError.message : String(closeError)
        logger.warn({ err: closeMessage }, 'No se pudo cerrar Queue de inventario tras encolar alerta')
      }
    }
    if (connection && typeof connection.disconnect === 'function') {
      connection.disconnect()
    } else if (connection && typeof connection.quit === 'function') {
      await connection.quit()
    }
  }
}
