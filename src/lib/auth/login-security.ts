import type { Usuario } from '@prisma/client'
import type { Redis } from 'ioredis'

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import createRedisConnection from '@/lib/redisClient'

const DEFAULT_IP_LIMIT = Number.parseInt(process.env.AUTH_RATE_LIMIT_IP_MAX ?? '50', 10)
const DEFAULT_IP_WINDOW = Number.parseInt(process.env.AUTH_RATE_LIMIT_IP_WINDOW_SECONDS ?? `${15 * 60}`, 10)
const DEFAULT_USER_LIMIT = Number.parseInt(process.env.AUTH_RATE_LIMIT_USER_MAX ?? '10', 10)
const DEFAULT_USER_WINDOW = Number.parseInt(process.env.AUTH_RATE_LIMIT_USER_WINDOW_SECONDS ?? `${15 * 60}`, 10)

const DEFAULT_MAX_FAILED_ATTEMPTS = Number.parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS ?? '5', 10)
const DEFAULT_LOCKOUT_MINUTES = Number.parseInt(process.env.AUTH_LOCKOUT_MINUTES ?? '15', 10)

export const MAX_FAILED_ATTEMPTS = DEFAULT_MAX_FAILED_ATTEMPTS
export const LOCKOUT_MINUTES = DEFAULT_LOCKOUT_MINUTES

const redisUrl = process.env.REDIS_URL

let redisPromise: Promise<Redis> | null = null
let redisUnavailableLogged = false
let redisMissingConfigLogged = false

async function getRedis(): Promise<Redis | null> {
  if (process.env.AUTH_DISABLE_RATE_LIMIT === 'true') {
    return null
  }

  if (!redisUrl) {
    if (!redisMissingConfigLogged) {
      logger.warn('Redis URL not configured; login rate limiting disabled')
      redisMissingConfigLogged = true
    }
    return null
  }

  if (!redisPromise) {
    redisPromise = createRedisConnection(redisUrl)
      .then((client) => {
        client.on('error', (error: unknown) => {
          logger.error({ error }, 'Redis connection error for login limiter')
        })
        return client as Redis
      })
      .catch((error) => {
        if (!redisUnavailableLogged) {
          logger.warn({ error }, 'Redis unavailable, login rate limiting disabled')
          redisUnavailableLogged = true
        }
        return null
      })
  }

  return redisPromise
}

async function incrementWithTTL(client: Redis, key: string, ttlSeconds: number) {
  const count = await client.incr(key)
  if (count === 1) {
    await client.expire(key, ttlSeconds)
  }
  return count
}

function buildIpKey(ip: string) {
  return `auth:rate:ip:${ip}`
}

function buildUserKey(username: string) {
  return `auth:rate:user:${username}`
}

export type RateLimitScope = 'ip' | 'user'

export type RateLimitResult = {
  allowed: true
  scope?: undefined
  count?: number
} | {
  allowed: false
  scope: RateLimitScope
  count: number
}

export async function registerLoginAttempt(username: string, ip?: string | null): Promise<RateLimitResult> {
  const client = await getRedis()
  if (!client) {
    return { allowed: true }
  }

  const tasks: Array<Promise<number>> = []
  const scopes: RateLimitScope[] = []

  if (ip) {
    tasks.push(incrementWithTTL(client, buildIpKey(ip), DEFAULT_IP_WINDOW))
    scopes.push('ip')
  }

  tasks.push(incrementWithTTL(client, buildUserKey(username), DEFAULT_USER_WINDOW))
  scopes.push('user')

  const counts = await Promise.all(tasks)

  for (let index = 0; index < counts.length; index += 1) {
    const scope = scopes[index]
    const count = counts[index]
    if (scope === 'ip' && count > DEFAULT_IP_LIMIT) {
      return { allowed: false, scope, count }
    }
    if (scope === 'user' && count > DEFAULT_USER_LIMIT) {
      return { allowed: false, scope, count }
    }
  }

  return { allowed: true }
}

export async function resetLoginAttempts(username: string, ip?: string | null): Promise<void> {
  const client = await getRedis()
  if (!client) {
    return
  }

  const keys: string[] = [buildUserKey(username)]
  if (ip) {
    keys.push(buildIpKey(ip))
  }

  try {
    await client.del(...keys)
  } catch (error) {
    logger.warn({ error }, 'Failed to reset login rate limit counters')
  }
}

export function isUserTemporarilyBlocked(usuario: Pick<Usuario, 'intentos_fallidos_login' | 'ultimo_intento_fallido'>): boolean {
  if (!usuario.ultimo_intento_fallido) {
    return false
  }
  if (usuario.intentos_fallidos_login < DEFAULT_MAX_FAILED_ATTEMPTS) {
    return false
  }

  const lockoutWindowMs = DEFAULT_LOCKOUT_MINUTES * 60 * 1000
  const lastAttemptTime = usuario.ultimo_intento_fallido.getTime()
  return (Date.now() - lastAttemptTime) < lockoutWindowMs
}

export async function recordFailedLogin(usuarioId: number): Promise<number | null> {
  try {
    const updated = await prisma.usuario.update({
      where: { id_usuario: usuarioId },
      data: {
        intentos_fallidos_login: { increment: 1 },
        ultimo_intento_fallido: new Date()
      },
      select: { intentos_fallidos_login: true }
    })

    return updated.intentos_fallidos_login
  } catch (error) {
    logger.error({ error, usuarioId }, 'Failed to record failed login attempt')
    return null
  }
}

export async function resetFailedLogin(usuarioId: number): Promise<void> {
  try {
    await prisma.usuario.update({
      where: { id_usuario: usuarioId },
      data: {
        intentos_fallidos_login: 0,
        ultimo_intento_fallido: null
      }
    })
  } catch (error) {
    logger.warn({ error, usuarioId }, 'Failed to reset failed login counter')
  }
}

export function extractClientIp(req: unknown): string | null {
  if (!req || typeof req !== 'object') {
    return null
  }

  const headers = (req as { headers?: Record<string, string> | Headers }).headers
  if (!headers) {
    return null
  }

  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      const value = headers.get(name)
      return value ?? undefined
    }
    const lowerCaseKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase())
    if (!lowerCaseKey) {
      return undefined
    }
    return headers[lowerCaseKey]
  }

  const forwarded = getHeader('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null
  }

  const realIp = getHeader('x-real-ip')
  if (realIp) {
    return realIp.trim() || null
  }

  return null
}
