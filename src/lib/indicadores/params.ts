import { z } from 'zod'

import type { SlaMapping } from './mantenimientos'

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date()
})

const onScheduleSchema = rangeSchema.extend({
  windowDays: z
    .coerce
    .number()
    .int()
    .min(0)
    .max(30)
    .default(2)
})

const technicianSchema = rangeSchema

const onTimeCloseSchema = rangeSchema

const booleanLike = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = value.toLowerCase()
    if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) {
      return true
    }
    if (['0', 'false', 'no'].includes(normalized)) {
      return false
    }
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe ser un booleano (true/false/1/0)' })
    return z.NEVER
  })

const ttlHoursSchema = z
  .string()
  .trim()
  .min(1, { message: 'ttlHours no puede estar vacío' })
  .transform((value, ctx) => {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ttlHours debe ser un entero mayor o igual a 0' })
      return z.NEVER
    }
    return parsed
  })

const cacheControlSchema = z.object({
  force: booleanLike.optional(),
  ttlHours: ttlHoursSchema.optional()
})

const slaMappingSchema = z
  .string()
  .trim()
  .min(1, { message: 'sla no puede estar vacío' })
  .transform((value, ctx): SlaMapping => {
    const entries = value
      .split(',')
      .map((piece) => piece.trim())
      .filter(Boolean)

    if (entries.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sla requiere al menos un par prioridad:horas' })
      return z.NEVER
    }

    const mapping: Record<string, number> = {}

    for (const entry of entries) {
      const [priorityRaw, hoursRaw] = entry.split(':').map((segment) => segment.trim())
      if (!priorityRaw || !hoursRaw) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Formato inválido para SLA '${entry}'. Usa prioridad:horas` })
        return z.NEVER
      }

      const hours = Number.parseFloat(hoursRaw)
      if (Number.isNaN(hours) || hours <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Horas inválidas en SLA '${entry}'. Debe ser un número mayor que 0` })
        return z.NEVER
      }

      mapping[priorityRaw.toLowerCase()] = hours
    }

    return mapping
  })

export type ParsedRange = z.infer<typeof rangeSchema>
export type ParsedOnSchedule = z.infer<typeof onScheduleSchema>
export type ParsedCacheControl = z.infer<typeof cacheControlSchema>
export type ParsedRangeWithLimit = ParsedRange & { limit: number }

const rangeWithLimitSchema = (defaultLimit: number, maxLimit: number) =>
  rangeSchema.extend({
    limit: z.preprocess((value) => {
      if (value === undefined || value === null) {
        return defaultLimit
      }
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) {
          return defaultLimit
        }
        const parsed = Number.parseInt(trimmed, 10)
        if (Number.isNaN(parsed)) {
          return trimmed
        }
        return parsed
      }
      return value
    }, z
      .number()
      .int({ message: 'limit debe ser un entero' })
      .min(1, { message: 'limit debe ser mayor a 0' })
      .max(maxLimit, { message: `limit no puede superar ${maxLimit}` })
    )
  })

export const parseRangeParams = (params: URLSearchParams): ParsedRange => {
  return rangeSchema.parse({
    from: params.get('from'),
    to: params.get('to')
  })
}

export const parseOnScheduleParams = (params: URLSearchParams): ParsedOnSchedule => {
  return onScheduleSchema.parse({
    from: params.get('from'),
    to: params.get('to'),
    windowDays: params.get('windowDays')
  })
}

export const parseTechnicianParams = (params: URLSearchParams): ParsedRange => {
  return technicianSchema.parse({
    from: params.get('from'),
    to: params.get('to')
  })
}

export const parseOnTimeCloseParams = (params: URLSearchParams): ParsedRange => {
  return onTimeCloseSchema.parse({
    from: params.get('from'),
    to: params.get('to')
  })
}

export const parseRangeWithLimitParams = (
  params: URLSearchParams,
  defaultLimit = 5,
  maxLimit = 25
): ParsedRangeWithLimit => {
  return rangeWithLimitSchema(defaultLimit, maxLimit).parse({
    from: params.get('from'),
    to: params.get('to'),
    limit: params.get('limit') ?? undefined
  })
}

export const parseCacheControlParams = (params: URLSearchParams): ParsedCacheControl => {
  return cacheControlSchema.parse({
    force: params.get('force') ?? undefined,
    ttlHours: params.get('ttlHours') ?? params.get('ttl-hours') ?? undefined
  })
}

export const parseSlaMappingParam = (params: URLSearchParams): SlaMapping | undefined => {
  const raw = params.get('sla')
  if (!raw) {
    return undefined
  }
  return slaMappingSchema.parse(raw)
}

export const parseSlaMappingString = (value: string): SlaMapping => slaMappingSchema.parse(value)
