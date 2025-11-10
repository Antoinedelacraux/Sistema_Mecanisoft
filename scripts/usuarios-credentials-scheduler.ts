import { Queue } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { enqueueReprocesarPendientes, procesarCredencialesPendientes, USUARIOS_QUEUE_NAME, JOB_REENVIAR_PENDIENTES } from '@/lib/usuarios/credenciales-queue'
import { logger } from '@/lib/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const CRON = process.env.USUARIOS_CREDENCIALES_CRON || '0 * * * *'

async function main() {
  const connection = await createRedisConnection(REDIS_URL)
  const queue = new Queue(USUARIOS_QUEUE_NAME, { connection })

  const payload = {
    limit: process.env.USUARIOS_CREDENCIALES_LIMIT ? Number(process.env.USUARIOS_CREDENCIALES_LIMIT) : undefined,
    triggeredBy: process.env.USUARIOS_SYSTEM_USER_ID ? Number(process.env.USUARIOS_SYSTEM_USER_ID) : undefined,
    asunto: process.env.USUARIOS_CREDENCIALES_ASUNTO,
    mensaje_adicional: process.env.USUARIOS_CREDENCIALES_MENSAJE_AUTO
  }

  if (process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true') {
    logger.warn('[usuarios-scheduler] Redis en modo fallback: ejecutando reproceso inmediato')
    const resultado = await procesarCredencialesPendientes(payload)
    logger.info({ resultado }, '[usuarios-scheduler] reproceso manual completado')
    await queue.close()
    if (typeof connection?.disconnect === 'function') {
      connection.disconnect()
    } else if (typeof connection?.quit === 'function') {
      await connection.quit()
    }
    return
  }

  await queue.add(JOB_REENVIAR_PENDIENTES, payload, {
    jobId: JOB_REENVIAR_PENDIENTES,
    removeOnComplete: true,
    repeat: { cron: CRON },
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 }
  })

  logger.info({ cron: CRON, queue: USUARIOS_QUEUE_NAME }, '[usuarios-scheduler] job recurrente registrado')

  await queue.close()
  if (typeof connection?.disconnect === 'function') {
    connection.disconnect()
  } else if (typeof connection?.quit === 'function') {
    await connection.quit()
  }
}

main().catch((err) => {
  logger.error({ err }, '[usuarios-scheduler] error fatal')
  process.exit(1)
})
