import path from 'path'
import fs from 'fs'
import { Worker } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { processReportJob } from '@/lib/reportes/processor'
import { inc as incMetric } from '@/lib/reportes/metrics'
import { captureException } from '@/lib/sentry'
import { verifyReportInfraPrerequisites } from '@/lib/reportes/dependencies'
import { INVENTORY_ALERT_EMAIL_JOB, sendInventoryAlertEmailJob } from '@/lib/inventario/alertas-notifier'
import { logger } from '@/lib/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const EXPORT_PATH = process.env.EXPORT_PATH || path.join(process.cwd(), 'public', 'exports')
const QUEUE_NAME = 'reportes'

if (!fs.existsSync(EXPORT_PATH)) fs.mkdirSync(EXPORT_PATH, { recursive: true })

async function main() {
  await verifyReportInfraPrerequisites('worker')
  const connection = await createRedisConnection(REDIS_URL)
  const worker = new Worker(
    QUEUE_NAME,
  async (job: any) => {
      logger.info({ jobId: job.id, name: job.name }, '[report-worker] processing job')
      incMetric('jobsStarted')
      const start = Date.now()
      try {
        let result: unknown
        if (job.name === INVENTORY_ALERT_EMAIL_JOB) {
          result = await sendInventoryAlertEmailJob(job.data)
        } else {
          result = await processReportJob(job.data)
          incMetric('filesGenerated', 1)
        }
        incMetric('jobsCompleted')
        logger.info({ jobId: job.id, elapsedMs: Date.now() - start }, '[report-worker] job processed')
        return result
      } catch (err) {
        incMetric('jobsFailed')
        logger.error({ jobId: job.id, err }, '[report-worker] error processing job')
        try { await captureException(err) } catch (_) {}
        throw err
      }
    },
    { connection }
  )

  worker.on('completed', (job: any) => {
    logger.info({ jobId: job.id }, '[report-worker] job completed')
  })

  worker.on('failed', (job: any, err: any) => {
    logger.error({ jobId: job?.id, err }, '[report-worker] job failed')
  })

  logger.info({ queue: QUEUE_NAME }, '[report-worker] started')

  // Allow graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('[report-worker] Shutting down worker...')
    await worker.close()
    if (typeof connection?.disconnect === 'function') {
      connection.disconnect()
    }
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[report-worker] fatal error', err)
  process.exit(1)
})
