import { Worker } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { logger } from '@/lib/logger'
import {
  ORDENES_JOB_TAREAS_ALERTA,
  ORDENES_QUEUE_NAME,
  procesarAlertasTareasPausadas,
  type TareasAlertJobPayload,
} from '@/lib/ordenes/tareas-alerts'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

type OrdenesJob = {
  id?: string | number
  name: string
  data: TareasAlertJobPayload
}

async function main() {
  const connection = await createRedisConnection(REDIS_URL)

  const worker = new Worker(
    ORDENES_QUEUE_NAME,
    async (job: OrdenesJob) => {
      logger.info({ jobId: job.id, name: job.name }, '[ordenes-worker] procesando job')
      if (job.name === ORDENES_JOB_TAREAS_ALERTA) {
        return procesarAlertasTareasPausadas(job.data)
      }
      throw new Error(`Job no soportado: ${job.name}`)
    },
    { connection }
  )

  worker.on('completed', (job: { id?: string | number }, result: unknown) => {
    logger.info({ jobId: job.id, result }, '[ordenes-worker] job completado')
  })

  worker.on('failed', (job: { id?: string | number } | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err }, '[ordenes-worker] job falló')
  })

  logger.info({ queue: ORDENES_QUEUE_NAME }, '[ordenes-worker] iniciado')

  const shutdown = async () => {
    logger.info('[ordenes-worker] finalizando...')
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
  logger.error({ err }, '[ordenes-worker] error fatal')
  process.exit(1)
})
