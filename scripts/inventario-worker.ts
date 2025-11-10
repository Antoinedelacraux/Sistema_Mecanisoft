import { Worker } from 'bullmq'

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

async function main() {
  const connection = await createRedisConnection(REDIS_URL)

  const worker = new Worker(
    INVENTARIO_QUEUE_NAME,
    async (job: { id?: string | number; name: string; data: LiberarReservasJobPayload | AlertasStockJobPayload }) => {
      logger.info({ jobId: job.id, name: job.name }, '[inventario-worker] procesando job')
      if (job.name === INVENTARIO_JOB_LIBERAR_RESERVAS) {
        return procesarLiberarReservas(job.data as LiberarReservasJobPayload)
      }
      if (job.name === INVENTARIO_JOB_ALERTAS_STOCK) {
        return procesarAlertasStock(job.data as AlertasStockJobPayload)
      }
      throw new Error(`Job no soportado: ${job.name}`)
    },
    { connection }
  )

  worker.on('completed', (job: { id?: string | number }, result: unknown) => {
    logger.info({ jobId: job.id, result }, '[inventario-worker] job completado')
  })

  worker.on('failed', (job: { id?: string | number } | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err }, '[inventario-worker] job falló')
  })

  logger.info({ queue: INVENTARIO_QUEUE_NAME }, '[inventario-worker] iniciado')

  const shutdown = async () => {
    logger.info('[inventario-worker] finalizando...')
    await worker.close()
    if (typeof connection?.disconnect === 'function') {
      connection.disconnect()
    } else if (typeof connection?.quit === 'function') {
      await connection.quit()
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.error({ err }, '[inventario-worker] error fatal')
  process.exit(1)
})
