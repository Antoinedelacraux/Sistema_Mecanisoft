import { Queue } from 'bullmq'
import { createRedisConnection } from '@/lib/redisClient'
import { processReportJob } from '@/lib/reportes/processor'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const QUEUE_NAME = 'reportes'

async function main() {
  const connection = await createRedisConnection(REDIS_URL)
  const queue = new Queue(QUEUE_NAME, { connection })

  const payload = {
    key: 'ventas_resumen',
    params: { desde: null, hasta: null },
    format: 'csv',
    requestedBy: 1,
    recipients: []
  }

  if (process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true') {
    console.log('[enqueue-test-report] Redis not available, calling processor directly')
    const r = await processReportJob(payload as any)
    console.log('[enqueue-test-report] processor result', r)
  } else {
    const job = await queue.add('ventas_resumen', payload)
    console.log('Enqueued job id:', job.id)
  }

  await queue.close()
  connection.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
