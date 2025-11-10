import { Queue } from 'bullmq'

import { createRedisConnection } from '@/lib/redisClient'
import { prisma } from '@/lib/prisma'
import { processReportJob } from '@/lib/reportes/processor'
import { inc as incMetric } from '@/lib/reportes/metrics'
import { verifyReportInfraPrerequisites } from '@/lib/reportes/dependencies'
import { logger } from '@/lib/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const QUEUE_NAME = 'reportes'

async function main() {
  await verifyReportInfraPrerequisites('scheduler')
  const connection = await createRedisConnection(REDIS_URL)
  const queue = new Queue(QUEUE_NAME, { connection })

  logger.info('[report-scheduler] loading active schedules...')
  const schedules = await prisma.reportSchedule.findMany({
    where: { active: true },
    include: { template: true }
  })

  for (const schedule of schedules) {
    try {
      const tpl = schedule.template
      if (!tpl) {
        logger.warn({ scheduleId: schedule.id }, '[report-scheduler] template not found for schedule')
        continue
      }
      const data = {
        key: tpl.key,
        params: schedule.params ?? null,
        format: 'pdf',
        requestedBy: schedule.createdById,
        recipients: schedule.recipients,
      }
      const jobId = `report_schedule_${schedule.id}`
      if (process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true') {
        // No real Redis available — execute once directly so module can function in constrained envs
        logger.warn({ scheduleId: schedule.id }, '[report-scheduler] no Redis - executing schedule directly')
        try {
          await processReportJob(data as any)
          logger.info({ scheduleId: schedule.id }, '[report-scheduler] executed schedule directly')
        } catch (e) {
          logger.error({ scheduleId: schedule.id, err: e }, '[report-scheduler] direct execution failed')
        }
      } else {
        // include attempts/backoff for scheduled jobs too
        await queue.add(jobId, data, {
          jobId,
          removeOnComplete: true,
          repeat: { cron: schedule.cron },
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 }
        })
        try { incMetric('jobsEnqueued') } catch {}
        logger.info({ scheduleId: schedule.id, cron: schedule.cron }, '[report-scheduler] registered repeatable job')
      }
    } catch (err) {
      logger.error({ scheduleId: schedule.id, err }, '[report-scheduler] error registering schedule')
    }
  }

  logger.info('[report-scheduler] done. Worker will process according to cron.')
  // Keep process alive to allow bull to keep repeatable jobs registered
  // Optional: register a purge job if PURGE_CRON is set (default daily at 03:00)
  const purgeCron = process.env.PURGE_CRON || '0 3 * * *'
  if (process.env.ENABLE_PURGE_SCHEDULE === 'true') {
    const purgeJobId = 'reportes_purge_job'
    const payload = { action: 'purge', maxAgeDays: Number(process.env.PURGE_DAYS || 30) }
    if (process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true') {
      // In fallback mode, execute purge immediately once on startup
      try {
        const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/reportes/purge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxAgeDays: payload.maxAgeDays }),
        })
        logger.info({ status: res.status }, '[report-scheduler] executed immediate purge in fallback mode')
      } catch (e) {
        logger.warn({ err: e }, '[report-scheduler] purge immediate failed')
      }
    } else {
      await queue.add(purgeJobId, payload as any, { jobId: purgeJobId, removeOnComplete: true, repeat: { cron: purgeCron } })
      try { incMetric('jobsEnqueued') } catch {}
      logger.info({ cron: purgeCron }, '[report-scheduler] registered purge repeatable job')
    }
  }
}

main().catch((err) => {
  logger.error({ err }, '[report-scheduler] fatal error')
  process.exit(1)
})
