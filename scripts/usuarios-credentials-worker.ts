import { Worker } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { JOB_REENVIAR_PENDIENTES, USUARIOS_QUEUE_NAME, procesarCredencialesPendientes, type ReprocesarPendientesPayload } from '@/lib/usuarios/credenciales-queue'
import { logger } from '@/lib/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

type SimpleJob = {
  id?: string | number
  name: string
  data: ReprocesarPendientesPayload
}

async function main() {
  const connection = await createRedisConnection(REDIS_URL)

  const worker = new Worker(
    USUARIOS_QUEUE_NAME,
    async (job: SimpleJob) => {
      logger.info({ jobId: job.id, name: job.name }, '[usuarios-worker] procesando job')
      if (job.name === JOB_REENVIAR_PENDIENTES) {
        return procesarCredencialesPendientes(job.data)
      }
      throw new Error(`Job no soportado: ${job.name}`)
    },
    { connection }
  )

  worker.on('completed', (job: SimpleJob, result: unknown) => {
    logger.info({ jobId: job.id, result }, '[usuarios-worker] job completado')
  })

  worker.on('failed', (job: SimpleJob | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err }, '[usuarios-worker] job falló')
  })

  logger.info({ queue: USUARIOS_QUEUE_NAME }, '[usuarios-worker] iniciado')

  process.on('SIGINT', async () => {
    logger.info('[usuarios-worker] finalizando...')
    await worker.close()
    if (typeof connection?.disconnect === 'function') {
      connection.disconnect()
    } else if (typeof connection?.quit === 'function') {
      await connection.quit()
    }
    process.exit(0)
  })
}

main().catch((err) => {
  logger.error({ err }, '[usuarios-worker] error fatal')
  process.exit(1)
})
