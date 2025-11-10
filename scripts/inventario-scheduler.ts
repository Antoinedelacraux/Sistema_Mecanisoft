import { Queue } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { logger } from '@/lib/logger'
import {
  INVENTARIO_JOB_ALERTAS_STOCK,
  INVENTARIO_JOB_LIBERAR_RESERVAS,
  INVENTARIO_QUEUE_NAME,
  procesarAlertasStock,
  procesarLiberarReservas,
  type AlertasStockJobPayload,
  type LiberarReservasJobPayload,
} from '@/lib/inventario/cron-jobs'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const CRON_RESERVAS = process.env.INVENTARIO_RESERVA_CRON || '*/30 * * * *'
const CRON_ALERTAS = process.env.INVENTARIO_ALERT_CRON || '0 8 * * *'

const shouldUseFallback = () => process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true'

const buildReservasPayload = (): LiberarReservasJobPayload => ({
  limit: process.env.INVENTARIO_RESERVA_RELEASE_LIMIT ? Number(process.env.INVENTARIO_RESERVA_RELEASE_LIMIT) : undefined,
  ttlHours: process.env.INVENTARIO_RESERVA_TTL_HOURS ? Number(process.env.INVENTARIO_RESERVA_TTL_HOURS) : undefined,
  motivo: process.env.INVENTARIO_RESERVA_MOTIVO || undefined,
  triggeredBy: process.env.SYSTEM_USER_ID ? Number(process.env.SYSTEM_USER_ID) : undefined,
})

const buildAlertasPayload = (): AlertasStockJobPayload => ({
  triggeredBy: process.env.SYSTEM_USER_ID ? Number(process.env.SYSTEM_USER_ID) : undefined,
  recipients: process.env.INVENTARIO_ALERT_RECIPIENTS,
  force: process.env.INVENTARIO_ALERT_FORCE === 'true',
})

async function main() {
  const reservasPayload = buildReservasPayload()
  const alertasPayload = buildAlertasPayload()

  if (shouldUseFallback()) {
    logger.warn('[inventario-scheduler] REDIS en fallback. Ejecutando jobs directamente')
    const reservas = await procesarLiberarReservas(reservasPayload)
    logger.info({ reservas }, '[inventario-scheduler] liberación directa completada')
    const alertas = await procesarAlertasStock(alertasPayload)
    logger.info({ alertas }, '[inventario-scheduler] alerta directa completada')
    return
  }

  const connection = await createRedisConnection(REDIS_URL)
  const queue = new Queue(INVENTARIO_QUEUE_NAME, { connection })

  await queue.add(INVENTARIO_JOB_LIBERAR_RESERVAS, reservasPayload, {
    removeOnComplete: true,
    jobId: INVENTARIO_JOB_LIBERAR_RESERVAS,
    repeat: { cron: CRON_RESERVAS },
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
  })

  await queue.add(INVENTARIO_JOB_ALERTAS_STOCK, alertasPayload, {
    removeOnComplete: true,
    jobId: INVENTARIO_JOB_ALERTAS_STOCK,
    repeat: { cron: CRON_ALERTAS },
    attempts: 3,
    backoff: { type: 'exponential', delay: 120_000 },
  })

  logger.info({ cronReservas: CRON_RESERVAS, cronAlertas: CRON_ALERTAS }, '[inventario-scheduler] jobs registrados')

  await queue.close()
  if (typeof connection?.disconnect === 'function') {
    connection.disconnect()
  } else if (typeof connection?.quit === 'function') {
    await connection.quit()
  }
}

main().catch((err) => {
  logger.error({ err }, '[inventario-scheduler] error fatal')
  process.exit(1)
})
