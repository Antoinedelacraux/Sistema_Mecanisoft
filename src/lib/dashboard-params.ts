import { endOfDay, parseISO, startOfDay, subDays } from 'date-fns'

import type { DashboardFilters, VentasSeriesGranularity } from '@/types/dashboard'

const DEFAULT_RANGE_DAYS = 30
const MAX_TOP_LIMIT = 50
const DEFAULT_TOP_LIMIT = 10

type SearchParamsRecord = Record<string, string | string[] | undefined>

type SearchParamsIterable = {
  get(name: string): string | null
  entries(): IterableIterator<[string, string]>
}

export type DashboardSearchParamsInput = SearchParamsRecord | URLSearchParams | SearchParamsIterable | null | undefined

const isValidGranularity = (value: string | null): value is VentasSeriesGranularity =>
  value === 'day' || value === 'week' || value === 'month'

const parseNumber = (value: string | null): number | undefined => {
  if (!value) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseDate = (value: string | null): Date | undefined => {
  if (!value) {
    return undefined
  }

  const parsed = parseISO(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed
}

const isIterableParams = (value: unknown): value is SearchParamsIterable => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return typeof candidate.entries === 'function' && typeof candidate.get === 'function'
}

const ensureURLSearchParams = (params: DashboardSearchParamsInput): URLSearchParams => {
  if (!params) {
    return new URLSearchParams()
  }

  if (params instanceof URLSearchParams) {
    return params
  }

  if (isIterableParams(params)) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of params.entries()) {
      if (typeof value === 'string') {
        searchParams.append(key, value)
      }
    }
    return searchParams
  }

  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          searchParams.append(key, item)
        }
      }
      continue
    }

    if (typeof value === 'string') {
      searchParams.set(key, value)
    }
  }

  return searchParams
}

export type ParsedDashboardParams = {
  filters: DashboardFilters
  granularity: VentasSeriesGranularity
  topLimit: number
}

export const parseDashboardParams = (params: DashboardSearchParamsInput): ParsedDashboardParams => {
  const searchParams = ensureURLSearchParams(params)
  const to = parseDate(searchParams.get('to')) ?? new Date()
  const from = parseDate(searchParams.get('from')) ?? subDays(to, DEFAULT_RANGE_DAYS - 1)

  const almacenId = parseNumber(searchParams.get('almacenId'))
  const usuarioId = parseNumber(searchParams.get('usuarioId'))
  const granularityParam = searchParams.get('granularity')
  const topLimitParam = parseNumber(searchParams.get('topLimit'))
  const alertPagosDias = parseNumber(searchParams.get('pagosPendientesDias'))
  const alertCotizacionesDias = parseNumber(searchParams.get('cotizacionesPorVencerDias'))

  const filters: DashboardFilters = {
    from: startOfDay(from),
    to: endOfDay(to),
    almacenId,
    usuarioId,
    alertThresholds:
      alertPagosDias || alertCotizacionesDias
        ? {
            pagosPendientesDias: alertPagosDias,
            cotizacionesPorVencerDias: alertCotizacionesDias
          }
        : undefined
  }

  const granularity: VentasSeriesGranularity = isValidGranularity(granularityParam) ? granularityParam : 'day'
  const topLimit = topLimitParam ? Math.min(Math.max(topLimitParam, 1), MAX_TOP_LIMIT) : DEFAULT_TOP_LIMIT

  return {
    filters,
    granularity,
    topLimit
  }
}
