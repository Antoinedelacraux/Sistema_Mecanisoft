import { Queue } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { logger } from '@/lib/logger'
import {
  ORDENES_JOB_TAREAS_ALERTA,
  ORDENES_QUEUE_NAME,
  procesarAlertasTareasPausadas,
  type TareasAlertJobPayload,
} from '@/lib/ordenes/tareas-alerts'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const CRON_TAREAS = process.env.TAREAS_ALERT_CRON || '0 */2 * * *'

const shouldUseFallback = () => process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true'

const buildPayload = (): TareasAlertJobPayload => ({
  thresholdHours: process.env.TAREAS_PAUSADAS_THRESHOLD_HOURS ? Number(process.env.TAREAS_PAUSADAS_THRESHOLD_HOURS) : undefined,
  limit: process.env.TAREAS_PAUSADAS_ALERT_LIMIT ? Number(process.env.TAREAS_PAUSADAS_ALERT_LIMIT) : undefined,
  recipients: process.env.TAREAS_ALERT_RECIPIENTS,
  slackWebhook: process.env.TAREAS_ALERT_SLACK_WEBHOOK || null,
  triggeredBy: process.env.SYSTEM_USER_ID ? Number(process.env.SYSTEM_USER_ID) : undefined,
})

async function main() {
  const payload = buildPayload()

  if (shouldUseFallback()) {
    logger.warn('[ordenes-scheduler] REDIS en fallback. Ejecutando alerta directamente')
    const resultado = await procesarAlertasTareasPausadas(payload)
    logger.info({ resultado }, '[ordenes-scheduler] alerta directa completada')
    return
  }

  const connection = await createRedisConnection(REDIS_URL)
  const queue = new Queue(ORDENES_QUEUE_NAME, { connection })

  await queue.add(ORDENES_JOB_TAREAS_ALERTA, payload, {
    removeOnComplete: true,
    jobId: ORDENES_JOB_TAREAS_ALERTA,
    repeat: { cron: CRON_TAREAS },
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
  })

  logger.info({ cron: CRON_TAREAS }, '[ordenes-scheduler] job registrado')

  await queue.close()
  if (typeof connection?.disconnect === 'function') {
    connection.disconnect()
  } else if (typeof connection?.quit === 'function') {
    await connection.quit()
  }
}

main().catch((err) => {
  logger.error({ err }, '[ordenes-scheduler] error fatal')
  process.exit(1)
})
