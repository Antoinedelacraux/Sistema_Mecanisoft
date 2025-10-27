import path from 'path'
import fs from 'fs'
import { Worker } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { processReportJob } from '@/lib/reportes/processor'
import { inc as incMetric } from '@/lib/reportes/metrics'
import { captureException } from '@/lib/sentry'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const EXPORT_PATH = process.env.EXPORT_PATH || path.join(process.cwd(), 'public', 'exports')
const QUEUE_NAME = 'reportes'

if (!fs.existsSync(EXPORT_PATH)) fs.mkdirSync(EXPORT_PATH, { recursive: true })

async function main() {
  const connection = await createRedisConnection(REDIS_URL)
  const worker = new Worker(
    QUEUE_NAME,
    async (job: any) => {
      console.log('[report-worker] processing job', job.id, job.name)
      incMetric('jobsStarted')
      const start = Date.now()
      try {
        const result = await processReportJob(job.data)
        incMetric('jobsCompleted')
        incMetric('filesGenerated', 1)
        console.log('[report-worker] processed in', Date.now() - start, 'ms')
        return result
      } catch (err) {
        incMetric('jobsFailed')
        console.error('[report-worker] error processing job', job.id, err)
        try { await captureException(err) } catch (_) {}
        throw err
      }
    },
    { connection }
  )

  worker.on('completed', (job: any) => {
    console.log('[report-worker] job completed', job.id)
  })

  worker.on('failed', (job: any, err: any) => {
    console.error('[report-worker] job failed', job?.id, err)
  })

  console.log('[report-worker] started, listening on queue', QUEUE_NAME)

  // Allow graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down worker...')
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
