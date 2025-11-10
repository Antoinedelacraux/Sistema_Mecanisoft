import type Redis from 'ioredis'

import createRedisConnection from '@/lib/redisClient'
import { logger } from '@/lib/logger'

const DAILY_LIMIT = Number.parseInt(process.env.UPLOAD_DAILY_LIMIT ?? '25', 10)

let redisPromise: Promise<Redis> | null = null
let redisWarned = false

async function getRedis(): Promise<Redis | null> {
  if (!process.env.REDIS_URL) {
    if (!redisWarned) {
      logger.warn('Redis URL not configured; upload quota disabled')
      redisWarned = true
    }
    return null
  }

  if (!redisPromise) {
    redisPromise = createRedisConnection(process.env.REDIS_URL)
      .catch((error) => {
        logger.error({ error }, '[upload] Unable to connect to Redis for quota')
        return null
      }) as Promise<Redis | null>
  }

  return redisPromise
}

function buildDailyKey(usuarioId: number, now: Date) {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return `uploads:daily:${usuarioId}:${year}${month}${day}`
}

export type UploadQuotaResult = {
  allowed: boolean
  remaining?: number
  limit: number
  count: number
}

export async function checkAndIncrementDailyQuota(usuarioId: number): Promise<UploadQuotaResult> {
  if (DAILY_LIMIT <= 0) {
    return { allowed: true, limit: Number.POSITIVE_INFINITY, count: 0, remaining: Number.POSITIVE_INFINITY }
  }

  const client = await getRedis()
  if (!client) {
    return { allowed: true, limit: DAILY_LIMIT, count: 0, remaining: DAILY_LIMIT }
  }

  const key = buildDailyKey(usuarioId, new Date())
  const count = await client.incr(key)
  if (count === 1) {
    // expire at midnight UTC
    const now = new Date()
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
    const secondsRemaining = Math.max(1, Math.floor((tomorrow.getTime() - now.getTime()) / 1000))
    await client.expire(key, secondsRemaining)
  }

  const remaining = Math.max(0, DAILY_LIMIT - count)
  return {
    allowed: count <= DAILY_LIMIT,
    limit: DAILY_LIMIT,
    count,
    remaining
  }
}
