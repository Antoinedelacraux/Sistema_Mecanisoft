import { endOfDay, formatISO, startOfDay, subDays } from 'date-fns'
import { ZodError } from 'zod'

import {
  getAvgTimePerJob,
  getCoverage,
  getCsat,
  getOnSchedule,
  getOnTimeClose,
  getRescheduleRate,
  getReworkRate,
  getStockCritical,
  getTechnicianUtilization,
  type SlaMapping
} from '../src/lib/indicadores/mantenimientos'
import { parseSlaMappingString } from '../src/lib/indicadores/params'
import { prisma } from '../src/lib/prisma'

type CliOptions = {
  from?: Date
  to?: Date
  windowDays?: number
  ttlHours?: number
  indicators?: Set<string>
  force?: boolean
  slaMapping?: SlaMapping
}

type ParsedArg = {
  key: string
  value: string | true
}

const SUPPORTED_INDICATORS = new Map<string, string>([
  ['coverage', 'Cobertura de mantenimientos'],
  ['on-schedule', 'Mantenimientos dentro de la ventana'],
  ['technician-utilization', 'Utilización de técnicos'],
  ['on-time-close', 'Órdenes cerradas dentro de SLA'],
  ['reschedule', 'Tasa de reprogramación'],
  ['avg-time-per-job', 'Tiempo promedio por servicio'],
  ['stock-critical', 'Disponibilidad de repuestos críticos'],
  ['rework-rate', 'Tasa de retrabajo'],
  ['csat', 'Satisfacción del cliente']
])

const parseArgs = (): CliOptions => {
  const rawArgs = process.argv.slice(2)
  if (rawArgs.length === 0) {
    return {}
  }

  const options: CliOptions = {}

  const parsed: ParsedArg[] = rawArgs.map((entry) => {
    const [key, ...rest] = entry.split('=')
    return {
      key: key.replace(/^--/, ''),
      value: rest.length === 0 ? true : rest.join('=')
    }
  })

  parsed.forEach(({ key, value }) => {
    switch (key) {
      case 'from': {
        if (typeof value === 'string') {
          const candidate = new Date(value)
          if (Number.isNaN(candidate.valueOf())) {
            throw new Error(`Valor inválido para --from: ${value}`)
          }
          options.from = startOfDay(candidate)
        }
        break
      }
      case 'to': {
        if (typeof value === 'string') {
          const candidate = new Date(value)
          if (Number.isNaN(candidate.valueOf())) {
            throw new Error(`Valor inválido para --to: ${value}`)
          }
          options.to = endOfDay(candidate)
        }
        break
      }
      case 'window-days':
      case 'windowDays': {
        if (typeof value === 'string') {
          const parsedWindow = Number.parseInt(value, 10)
          if (Number.isNaN(parsedWindow) || parsedWindow < 0) {
            throw new Error(`Valor inválido para --window-days: ${value}`)
          }
          options.windowDays = parsedWindow
        }
        break
      }
      case 'ttl-hours':
      case 'ttlHours': {
        if (typeof value === 'string') {
          const parsedTtl = Number.parseInt(value, 10)
          if (Number.isNaN(parsedTtl) || parsedTtl < 0) {
            throw new Error(`Valor inválido para --ttl-hours: ${value}`)
          }
          options.ttlHours = parsedTtl
        }
        break
      }
      case 'indicators': {
        if (typeof value === 'string') {
          const entries = value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
          options.indicators = new Set(entries)
        }
        break
      }
      case 'force': {
        options.force = parseBooleanFlag(value)
        break
      }
      case 'sla':
      case 'sla-mapping': {
        if (typeof value === 'string') {
          try {
            options.slaMapping = parseSlaMappingString(value)
          } catch (error) {
            if (error instanceof ZodError) {
              const messages = error.issues.map((issue) => issue.message).join('; ')
              throw new Error(`Valor inválido para --sla: ${messages}`)
            }
            throw error
          }
        }
        break
      }
      default: {
        console.warn(`Argumento desconocido ignorado: --${key}`)
      }
    }
  })

  return options
}

const parseBooleanFlag = (value: string | true): boolean => {
  if (value === true) {
    return true
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no'].includes(normalized)) {
    return false
  }

  throw new Error(`Valor inválido para --force: ${value}`)
}

const buildRange = (options: CliOptions) => {
  const now = new Date()
  const defaultTo = endOfDay(now)
  const defaultFrom = startOfDay(subDays(now, 29))

  const from = options.from ?? defaultFrom
  const to = options.to ?? defaultTo

  if (from > to) {
    return {
      from: startOfDay(to),
      to: endOfDay(from)
    }
  }

  return { from, to }
}

const shouldWarm = (indicator: string, options: CliOptions) => {
  if (!options.indicators || options.indicators.size === 0) {
    return true
  }
  return options.indicators.has(indicator)
}

const logResult = (indicator: string, metadata: Record<string, unknown>) => {
  const label = SUPPORTED_INDICATORS.get(indicator) ?? indicator
  const summary = Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ')
  console.log(`✔ ${label} -> ${summary}`)
}

async function warmIndicators(range: { from: Date; to: Date }, options: CliOptions) {
  const ttlHours = options.ttlHours
  const force = options.force !== false

  if (shouldWarm('coverage', options)) {
    const result = await getCoverage(range.from, range.to, { ttlHours, force })
    logResult('coverage', {
      coverage: `${result.coverageRate.toFixed(2)}%`,
      vehiculos: result.totalVehiculos,
      programados: result.vehiculosProgramados
    })
  }

  if (shouldWarm('on-schedule', options)) {
    const windowDays = options.windowDays ?? 2
    const result = await getOnSchedule(range.from, range.to, { windowDays, ttlHours, force })
    logResult('on-schedule', {
      tasa: `${result.onScheduleRate.toFixed(2)}%`,
      completados: result.totalCompletados,
      dentroVentana: result.completadosDentroVentana,
      reprogramados: result.reprogramados
    })
  }

  if (shouldWarm('technician-utilization', options)) {
    const result = await getTechnicianUtilization(range.from, range.to, { ttlHours, force })
    logResult('technician-utilization', {
      promedio: (result.promedioUtilizacion * 100).toFixed(2) + '%',
      tecnicos: result.items.length
    })
  }

  if (shouldWarm('on-time-close', options)) {
    const result = await getOnTimeClose(range.from, range.to, {
      slaMapping: options.slaMapping,
      ttlHours,
      force
    })
    logResult('on-time-close', {
      tasa: `${result.onTimeRate.toFixed(2)}%`,
      cerradas: result.totalCerradas,
      dentroSla: result.cerradasDentroSla
    })
  }

  if (shouldWarm('reschedule', options)) {
    const result = await getRescheduleRate(range.from, range.to, { ttlHours, force })
    logResult('reschedule', {
      tasa: `${result.rescheduleRate.toFixed(2)}%`,
      programados: result.totalProgramados,
      reprogramados: result.reprogramados
    })
  }

  if (shouldWarm('avg-time-per-job', options)) {
    const result = await getAvgTimePerJob(range.from, range.to, { ttlHours, force })
    logResult('avg-time-per-job', {
      promedio: `${result.promedioGlobal.toFixed(1)} min`,
      servicios: result.items.length
    })
  }

  if (shouldWarm('stock-critical', options)) {
    const result = await getStockCritical(range.from, range.to, { ttlHours, force })
    logResult('stock-critical', {
      cumplimiento: `${result.cumplimientoRate.toFixed(2)}%`,
      criticos: result.totalCriticos,
      bajo: result.bajoNivel
    })
  }

  if (shouldWarm('rework-rate', options)) {
    const result = await getReworkRate(range.from, range.to, { ttlHours, force })
    logResult('rework-rate', {
      tasa: `${result.reworkRate.toFixed(2)}%`,
      reabiertas: result.reabiertas,
      cerradas: result.totalCerradas
    })
  }

  if (shouldWarm('csat', options)) {
    const result = await getCsat(range.from, range.to, { ttlHours, force })
    logResult('csat', {
      promedio: result.promedio.toFixed(2),
      respuestas: result.totalRespuestas
    })
  }
}

async function main() {
  const options = parseArgs()
  const range = buildRange(options)

  console.log('Precargando cache de indicadores de mantenimientos...')
  console.log(`Rango: ${formatISO(range.from)} -> ${formatISO(range.to)}`)
  if (options.ttlHours !== undefined) {
    console.log(`TTL overwrite: ${options.ttlHours} horas`)
  }
  if (options.windowDays !== undefined) {
    console.log(`Ventana on-schedule: ${options.windowDays} días`)
  }
  if (options.indicators && options.indicators.size > 0) {
    console.log(`Indicadores solicitados: ${Array.from(options.indicators).join(', ')}`)
  }
  if (options.slaMapping) {
    console.log(`SLA personalizado: ${JSON.stringify(options.slaMapping)}`)
  }

  await warmIndicators(range, options)

  console.log('Cache de indicadores actualizado correctamente.')
}

main()
  .catch((error) => {
    console.error('Error al precargar el cache de indicadores:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
