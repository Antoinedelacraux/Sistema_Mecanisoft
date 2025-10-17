import { createHash } from 'crypto'
import { addHours, isAfter } from 'date-fns'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type CacheMeta = {
  indicador: string
  from: Date
  to: Date
  parametros?: Record<string, unknown>
}

type CacheOptions = {
  ttlHours?: number
  force?: boolean
}

const DEFAULT_TTL_HOURS = 12

const buildHash = ({ indicador, from, to, parametros }: CacheMeta) => {
  const payload = JSON.stringify({ indicador, from: from.toISOString(), to: to.toISOString(), parametros: parametros ?? null })
  return createHash('md5').update(payload).digest('hex')
}

export async function withIndicatorCache<T>(meta: CacheMeta, compute: () => Promise<T>, options?: CacheOptions): Promise<T> {
  const ttlHours = options?.ttlHours ?? DEFAULT_TTL_HOURS
  const hash = buildHash(meta)
  const now = new Date()

  if (!options?.force) {
    const cached = await prisma.indicadorCache.findUnique({ where: { hash } })
    if (cached && (!cached.expires_at || isAfter(cached.expires_at, now))) {
      return cached.payload as T
    }
  }

  const payload = await compute()

  try {
    const persistedPayload = payload as Prisma.InputJsonValue
    const persistedParams = meta.parametros ? (meta.parametros as Prisma.InputJsonValue) : undefined
    await prisma.indicadorCache.upsert({
      where: { hash },
      update: {
        payload: persistedPayload,
        computed_at: now,
        expires_at: ttlHours > 0 ? addHours(now, ttlHours) : null
      },
      create: {
        indicador: meta.indicador,
        hash,
        rango_desde: meta.from,
        rango_hasta: meta.to,
        parametros: persistedParams,
        payload: persistedPayload,
        computed_at: now,
        expires_at: ttlHours > 0 ? addHours(now, ttlHours) : null
      }
    })
  } catch (error) {
    console.error('No se pudo persistir cache de indicador', meta.indicador, error)
  }

  return payload
}
