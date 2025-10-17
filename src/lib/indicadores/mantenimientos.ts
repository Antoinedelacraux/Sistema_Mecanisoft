import { Prisma } from '@prisma/client'
import { differenceInCalendarDays, differenceInMinutes, endOfDay, formatISO, startOfDay } from 'date-fns'

import { withIndicatorCache } from '@/lib/indicadores/cache'
import { prisma } from '@/lib/prisma'
import type {
  AvgTimePerJobKpi,
  CoverageKpi,
  CsatKpi,
  OnScheduleKpi,
  OnTimeCloseKpi,
  ReworkRateKpi,
  RescheduleKpi,
  StockCriticalKpi,
  TechnicianUtilizationItem,
  TechnicianUtilizationKpi
} from '@/types/indicadores'

const CANCELLED_STATUS = ['cancelado']
const COMPLETED_STATUS = 'completado'
const DEFAULT_TECHNICIAN_HOURS = 8
const MINUTES_PER_HOUR = 60
const DEFAULT_WINDOW_DAYS = 2

const DEFAULT_SLA_HOURS: Record<string, number> = {
  urgente: 12,
  alta: 24,
  media: 48,
  baja: 72
}

const REOPENED_STATUSES = new Set(['pendiente', 'por_hacer', 'en_proceso', 'pausado', 'reabierto', 'reabierta'])
const DEFAULT_LIST_LIMIT = 5
const MAX_LIST_LIMIT = 25
const MAX_REASON_ITEMS = 5

type CacheControl = {
  force?: boolean
  ttlHours?: number
}

type OnScheduleOptions = CacheControl & {
  windowDays?: number
}

type TechnicianOptions = CacheControl

type OnTimeCloseOptions = CacheControl & {
  slaMapping?: SlaMapping
}

type RankingOptions = CacheControl & {
  limit?: number
}

const pickCacheOptions = (options?: CacheControl) =>
  options
    ? {
        force: options.force,
        ttlHours: options.ttlHours
      }
    : undefined

const normalizeLimit = (value: number | undefined, defaultValue: number, maxValue: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return defaultValue
  }
  const normalized = Math.floor(value)
  if (normalized < 1) {
    return 1
  }
  if (normalized > maxValue) {
    return maxValue
  }
  return normalized
}

const normalizeRange = (from: Date, to: Date) => {
  const safeFrom = startOfDay(from)
  const safeTo = endOfDay(to)
  if (safeFrom > safeTo) {
    return {
      from: safeTo,
      to: safeFrom
    }
  }
  return { from: safeFrom, to: safeTo }
}

const formatRange = (range: { from: Date; to: Date }) => ({
  from: formatISO(range.from),
  to: formatISO(range.to)
})

const computeCoverage = async (range: { from: Date; to: Date }): Promise<CoverageKpi> => {
  const totalVehiculos = await prisma.vehiculo.count({ where: { estado: true } })
  if (totalVehiculos === 0) {
    return {
      coverageRate: 0,
      totalVehiculos: 0,
      vehiculosProgramados: 0,
      ...formatRange(range)
    }
  }

  const vehiculosProgramadosRows = (await prisma.$queryRaw<{ total: bigint }[]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT m.id_vehiculo)::bigint AS total
      FROM mantenimiento m
      WHERE m.fecha_programada BETWEEN ${range.from} AND ${range.to}
        AND COALESCE(m.estado, '') NOT IN (${Prisma.join(CANCELLED_STATUS)})
    `
  )) ?? []

  const rawProgramados = vehiculosProgramadosRows[0]?.total
  const vehiculosProgramados = typeof rawProgramados === 'bigint' ? Number(rawProgramados) : 0
  const coverageRate = totalVehiculos > 0 ? (vehiculosProgramados / totalVehiculos) * 100 : 0

  return {
    coverageRate,
    totalVehiculos,
    vehiculosProgramados,
    ...formatRange(range)
  }
}

const computeOnSchedule = async (range: { from: Date; to: Date }, windowDays: number): Promise<OnScheduleKpi> => {
  const completados = (await prisma.mantenimiento.findMany({
    where: {
      estado: COMPLETED_STATUS,
      fecha_realizada: {
        gte: range.from,
        lte: range.to
      }
    },
    select: {
      id_mantenimiento: true,
      fecha_programada: true,
      fecha_realizada: true
    }
  })) as Array<{ id_mantenimiento: number; fecha_programada: Date | null; fecha_realizada: Date | null }>

  const totalCompletados = completados.length

  const completadosDentroVentana = completados.filter((item) => {
    if (!item.fecha_realizada || !item.fecha_programada) {
      return false
    }
    const diff = Math.abs(differenceInCalendarDays(item.fecha_realizada, item.fecha_programada))
    return diff <= windowDays
  }).length

  const reprogramadosRaw = (await prisma.mantenimientoHistorial.findMany({
    where: {
      new_fecha: {
        not: null
      },
      created_at: {
        gte: range.from,
        lte: range.to
      }
    },
    select: {
      mantenimiento_id: true
    }
  })) as Array<{ mantenimiento_id: number }>

  const reprogramados = new Set(reprogramadosRaw.map((item) => item.mantenimiento_id)).size

  const onScheduleRate = totalCompletados > 0 ? (completadosDentroVentana / totalCompletados) * 100 : 0

  return {
    onScheduleRate,
    totalCompletados,
    completadosDentroVentana,
    windowDays,
    reprogramados,
    ...formatRange(range)
  }
}

const computeMinutes = (input: {
  fecha_inicio: Date | null
  fecha_fin: Date | null
  tiempo_estimado: number | null
  tiempo_real: number | null
}): number => {
  if (typeof input.tiempo_real === 'number' && !Number.isNaN(input.tiempo_real)) {
    return Math.max(input.tiempo_real, 0)
  }
  if (input.fecha_inicio && input.fecha_fin) {
    return Math.max(differenceInMinutes(input.fecha_fin, input.fecha_inicio), 0)
  }
  if (typeof input.tiempo_estimado === 'number') {
    return Math.max(input.tiempo_estimado, 0)
  }
  return 0
}

const formatNombre = (data?: { nombre: string; apellido_paterno: string; apellido_materno: string | null }): string => {
  if (!data) {
    return 'Sin asignar'
  }
  const partes = [data.nombre, data.apellido_paterno, data.apellido_materno?.trim()].filter(Boolean)
  return partes.join(' ')
}

const computeTechnicianUtilization = async (range: { from: Date; to: Date }): Promise<TechnicianUtilizationKpi> => {
  const tareas = await prisma.tarea.findMany({
    where: {
      id_trabajador: {
        not: null
      },
      OR: [
        {
          fecha_inicio: {
            lte: range.to
          },
          fecha_fin: {
            gte: range.from
          }
        },
        {
          fecha_inicio: null,
          detalle_transaccion: {
            transaccion: {
              fecha: {
                gte: range.from,
                lte: range.to
              }
            }
          }
        }
      ]
    },
    select: {
      id_trabajador: true,
      fecha_inicio: true,
      fecha_fin: true,
      tiempo_estimado: true,
      tiempo_real: true,
      trabajador: {
        select: {
          id_trabajador: true,
          persona: {
            select: {
              nombre: true,
              apellido_paterno: true,
              apellido_materno: true
            }
          }
        }
      }
    }
  })

  const dias = Math.max(differenceInCalendarDays(range.to, range.from) + 1, 1)
  const minutosDisponiblesPorTecnico = dias * DEFAULT_TECHNICIAN_HOURS * MINUTES_PER_HOUR
  const acumulado = new Map<number, TechnicianUtilizationItem>()

  tareas.forEach((tarea: {
    id_trabajador: number | null
    fecha_inicio: Date | null
    fecha_fin: Date | null
    tiempo_estimado: number | null
    tiempo_real: number | null
    trabajador: {
      persona: {
        nombre: string
        apellido_paterno: string
        apellido_materno: string | null
      } | null
    } | null
  }) => {
    if (!tarea.id_trabajador) {
      return
    }
    const minutos = computeMinutes(tarea)
    const existente = acumulado.get(tarea.id_trabajador)
    if (!existente) {
      acumulado.set(tarea.id_trabajador, {
        trabajadorId: tarea.id_trabajador,
        nombre: formatNombre(tarea.trabajador?.persona ?? undefined),
        minutosAsignados: minutos,
        minutosDisponibles: minutosDisponiblesPorTecnico,
        utilization: 0,
        tareas: 1
      })
      return
    }
    existente.minutosAsignados += minutos
    existente.tareas += 1
  })

  acumulado.forEach((value) => {
    value.utilization = value.minutosDisponibles > 0 ? value.minutosAsignados / value.minutosDisponibles : 0
  })

  const items = Array.from(acumulado.values()).sort((a, b) => b.utilization - a.utilization)
  const minutosTotalesAsignados = items.reduce((acc, item) => acc + item.minutosAsignados, 0)
  const minutosTotalesDisponibles = items.reduce((acc, item) => acc + item.minutosDisponibles, 0)
  const promedioUtilizacion = minutosTotalesDisponibles ? minutosTotalesAsignados / minutosTotalesDisponibles : 0

  return {
    ...formatRange(range),
    promedioUtilizacion,
    minutosTotalesAsignados,
    minutosTotalesDisponibles,
    items
  }
}

export type SlaMapping = Record<string, number>

const resolveSlaHours = (prioridad: string | null | undefined, slaMapping?: SlaMapping) => {
  const key = prioridad?.toLowerCase() ?? 'media'
  const custom = slaMapping?.[key]
  if (typeof custom === 'number' && custom > 0) {
    return custom
  }
  return DEFAULT_SLA_HOURS[key] ?? DEFAULT_SLA_HOURS.media
}

const computeOnTimeClose = async (range: { from: Date; to: Date }, slaMapping?: SlaMapping): Promise<OnTimeCloseKpi> => {
  const ordenes = await prisma.transaccion.findMany({
    where: {
      tipo_transaccion: 'orden',
      fecha_cierre: {
        not: null,
        gte: range.from,
        lte: range.to
      },
      estatus: 'activo'
    },
    select: {
      prioridad: true,
      fecha: true,
      fecha_cierre: true
    }
  })

  let totalCerradas = 0
  let cerradasDentroSla = 0
  const breakdown = new Map<string, { total: number; dentroSla: number }>()

  ordenes.forEach((orden: { prioridad: string | null; fecha: Date | null; fecha_cierre: Date | null }) => {
    if (!orden.fecha || !orden.fecha_cierre) {
      return
    }
    totalCerradas += 1
    const prioridad = orden.prioridad?.toLowerCase() ?? 'media'
    const slaHoras = resolveSlaHours(prioridad, slaMapping)
    const minutosTranscurridos = differenceInMinutes(orden.fecha_cierre, orden.fecha)
    const dentro = minutosTranscurridos <= slaHoras * MINUTES_PER_HOUR

    if (dentro) {
      cerradasDentroSla += 1
    }

    const data = breakdown.get(prioridad) ?? { total: 0, dentroSla: 0 }
    data.total += 1
    if (dentro) {
      data.dentroSla += 1
    }
    breakdown.set(prioridad, data)
  })

  const breakdownRecord: OnTimeCloseKpi['breakdown'] = {}
  breakdown.forEach((value, key) => {
    breakdownRecord[key] = {
      total: value.total,
      dentroSla: value.dentroSla,
      tasa: value.total > 0 ? value.dentroSla / value.total : 0
    }
  })

  return {
    ...formatRange(range),
    onTimeRate: totalCerradas > 0 ? (cerradasDentroSla / totalCerradas) * 100 : 0,
    totalCerradas,
    cerradasDentroSla,
    breakdown: breakdownRecord
  }
}

const computeRescheduleRate = async (range: { from: Date; to: Date }): Promise<RescheduleKpi> => {
  const programados = await prisma.mantenimiento.findMany({
    where: {
      fecha_programada: {
        gte: range.from,
        lte: range.to
      },
      estado: {
        notIn: CANCELLED_STATUS
      }
    },
    select: {
      id_mantenimiento: true
    }
  })

  const totalProgramados = programados.length
  if (totalProgramados === 0) {
    return {
      ...formatRange(range),
      totalProgramados: 0,
      reprogramados: 0,
      rescheduleRate: 0,
      topReasons: []
    }
  }

  const ids = programados.map((item) => item.id_mantenimiento)
  const historial = await prisma.mantenimientoHistorial.findMany({
    where: {
      mantenimiento_id: {
        in: ids
      }
    },
    select: {
      mantenimiento_id: true,
      reason: true
    }
  })

  if (historial.length === 0) {
    return {
      ...formatRange(range),
      totalProgramados,
      reprogramados: 0,
      rescheduleRate: 0,
      topReasons: []
    }
  }

  const reprogramadosSet = new Set<number>()
  const reasons = new Map<string, number>()

  historial.forEach((entry) => {
    reprogramadosSet.add(entry.mantenimiento_id)
    const reason = entry.reason?.trim()
    if (reason) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
  })

  const reprogramados = reprogramadosSet.size
  const rescheduleRate = totalProgramados > 0 ? (reprogramados / totalProgramados) * 100 : 0

  const topReasons = Array.from(reasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_REASON_ITEMS)
    .map(([reason, count]) => ({ reason, count }))

  return {
    ...formatRange(range),
    totalProgramados,
    reprogramados,
    rescheduleRate,
    topReasons
  }
}

const computeAvgTimePerJob = async (range: { from: Date; to: Date }, limit: number): Promise<AvgTimePerJobKpi> => {
  const tareas = await prisma.tarea.findMany({
    where: {
      detalle_transaccion: {
        id_servicio: {
          not: null
        },
        transaccion: {
          tipo_transaccion: 'orden',
          fecha: {
            gte: range.from,
            lte: range.to
          }
        }
      }
    },
    select: {
      fecha_inicio: true,
      fecha_fin: true,
      tiempo_estimado: true,
      tiempo_real: true,
      detalle_transaccion: {
        select: {
          id_servicio: true,
          servicio: {
            select: {
              id_servicio: true,
              nombre: true
            }
          }
        }
      }
    }
  })

  const aggregated = new Map<
    number,
    {
      servicioNombre: string
      totalMinutos: number
      tareas: number
    }
  >()

  tareas.forEach((tarea) => {
    const detalle = tarea.detalle_transaccion
    const servicioId = detalle?.id_servicio
    if (!servicioId || !detalle.servicio) {
      return
    }
    const minutos = computeMinutes(tarea)
    if (minutos <= 0) {
      return
    }
    const current = aggregated.get(servicioId)
    if (!current) {
      aggregated.set(servicioId, {
        servicioNombre: detalle.servicio.nombre,
        totalMinutos: minutos,
        tareas: 1
      })
      return
    }
    current.totalMinutos += minutos
    current.tareas += 1
  })

  const items = Array.from(aggregated.entries()).map(([servicioId, info]) => {
    const promedioMinutos = info.tareas > 0 ? info.totalMinutos / info.tareas : 0
    return {
      servicioId,
      servicioNombre: info.servicioNombre,
      promedioMinutos,
      tareas: info.tareas,
      totalMinutos: info.totalMinutos
    }
  })

  const totalMinutos = items.reduce((acc, item) => acc + item.totalMinutos, 0)
  const totalTareas = items.reduce((acc, item) => acc + item.tareas, 0)
  const promedioGlobal = totalTareas > 0 ? totalMinutos / totalTareas : 0
  const totalServicios = items.length

  const rankedItems = items
    .sort((a, b) => b.promedioMinutos - a.promedioMinutos || b.tareas - a.tareas)
    .slice(0, limit)

  return {
    ...formatRange(range),
    promedioGlobal,
    totalServicios,
    items: rankedItems
  }
}

const computeStockCritical = async (range: { from: Date; to: Date }, limit: number): Promise<StockCriticalKpi> => {
  const inventarios = await prisma.inventarioProducto.findMany({
    where: {
      es_critico: true
    },
    select: {
      id_inventario_producto: true,
      stock_disponible: true,
      stock_minimo: true,
      almacen: {
        select: {
          nombre: true
        }
      },
      producto: {
        select: {
          id_producto: true,
          codigo_producto: true,
          nombre: true
        }
      }
    }
  })

  const totalCriticos = inventarios.length
  if (totalCriticos === 0) {
    return {
      ...formatRange(range),
      totalCriticos: 0,
      enNivel: 0,
      bajoNivel: 0,
      cumplimientoRate: 0,
      items: []
    }
  }

  let enNivel = 0
  const mapped = inventarios.map((entry) => {
    const stockDisponible = Number(entry.stock_disponible)
    const stockMinimo = Number(entry.stock_minimo)
    const nivel: 'ok' | 'bajo' = stockDisponible >= stockMinimo ? 'ok' : 'bajo'
    if (nivel === 'ok') {
      enNivel += 1
    }
    const diff = stockDisponible - stockMinimo
    return {
      inventarioId: entry.id_inventario_producto,
      productoId: entry.producto.id_producto,
      codigo: entry.producto.codigo_producto,
      nombre: entry.producto.nombre,
      stockDisponible,
      stockMinimo,
      almacen: entry.almacen.nombre,
      nivel,
      diff
    }
  })

  const bajoNivel = totalCriticos - enNivel
  const cumplimientoRate = totalCriticos > 0 ? (enNivel / totalCriticos) * 100 : 0

  const rankedItems = mapped
    .sort((a, b) => a.diff - b.diff || a.stockDisponible - b.stockDisponible)
    .slice(0, limit)
    .map(({ diff, ...rest }) => rest)

  return {
    ...formatRange(range),
    totalCriticos,
    enNivel,
    bajoNivel,
    cumplimientoRate,
    items: rankedItems
  }
}

const computeReworkRate = async (range: { from: Date; to: Date }, limit: number): Promise<ReworkRateKpi> => {
  const ordenes = await prisma.transaccion.findMany({
    where: {
      tipo_transaccion: 'orden',
      fecha_cierre: {
        not: null,
        gte: range.from,
        lte: range.to
      },
      estatus: 'activo'
    },
    select: {
      id_transaccion: true,
      codigo_transaccion: true,
      prioridad: true,
      historial: {
        select: {
          new_status: true,
          created_at: true
        },
        orderBy: {
          created_at: 'asc'
        }
      }
    }
  })

  const totalCerradas = ordenes.length
  if (totalCerradas === 0) {
    return {
      ...formatRange(range),
      totalCerradas: 0,
      reabiertas: 0,
      reworkRate: 0,
      items: []
    }
  }

  const items: Array<{
    ordenId: number
    codigo: string
    prioridad: string | null
    reaperturas: number
    ultimaFecha: string | null
  }> = []
  let reabiertas = 0

  ordenes.forEach((orden) => {
    const historial = orden.historial ?? []
    if (!historial.length) {
      return
    }
    let lastStatus: string | null = null
    let reaperturas = 0

    historial.forEach((entry) => {
      const status = entry.new_status?.toLowerCase() ?? ''
      if (REOPENED_STATUSES.has(status) && lastStatus === 'completado') {
        reaperturas += 1
      }
      if (status) {
        lastStatus = status
      }
    })

    if (reaperturas > 0) {
      reabiertas += 1
      const ultima = historial[historial.length - 1]?.created_at ?? null
      items.push({
        ordenId: orden.id_transaccion,
        codigo: orden.codigo_transaccion,
        prioridad: orden.prioridad,
        reaperturas,
        ultimaFecha: ultima ? formatISO(ultima) : null
      })
    }
  })

  const reworkRate = totalCerradas > 0 ? (reabiertas / totalCerradas) * 100 : 0

  const rankedItems = items
    .sort((a, b) => b.reaperturas - a.reaperturas || (b.ultimaFecha ?? '').localeCompare(a.ultimaFecha ?? ''))
    .slice(0, limit)

  return {
    ...formatRange(range),
    totalCerradas,
    reabiertas,
    reworkRate,
    items: rankedItems
  }
}

const computeCsat = async (range: { from: Date; to: Date }): Promise<CsatKpi> => {
  const feedbacks = await prisma.feedback.findMany({
    where: {
      creado_en: {
        gte: range.from,
        lte: range.to
      }
    },
    select: {
      score: true
    }
  })

  const totalRespuestas = feedbacks.length
  if (totalRespuestas === 0) {
    const breakdown = [1, 2, 3, 4, 5].map((score) => ({
      score,
      total: 0,
      porcentaje: 0
    }))
    return {
      ...formatRange(range),
      promedio: 0,
      totalRespuestas: 0,
      breakdown
    }
  }

  const counts = new Map<number, number>()
  let sum = 0

  feedbacks.forEach((entry) => {
    const score = entry.score ?? 0
    if (score > 0) {
      sum += score
      counts.set(score, (counts.get(score) ?? 0) + 1)
    }
  })

  const promedio = totalRespuestas > 0 ? sum / totalRespuestas : 0
  const breakdown = [1, 2, 3, 4, 5].map((score) => {
    const total = counts.get(score) ?? 0
    return {
      score,
      total,
      porcentaje: totalRespuestas > 0 ? (total / totalRespuestas) * 100 : 0
    }
  })

  return {
    ...formatRange(range),
    promedio,
    totalRespuestas,
    breakdown
  }
}

const isOnTimeCloseOptions = (value: unknown): value is OnTimeCloseOptions => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return 'force' in value || 'ttlHours' in value || 'slaMapping' in value
}

export async function getCoverage(from: Date, to: Date, options?: CacheControl): Promise<CoverageKpi> {
  const range = normalizeRange(from, to)
  return withIndicatorCache(
    {
      indicador: 'mantenimientos.coverage',
      from: range.from,
      to: range.to
    },
    () => computeCoverage(range),
    pickCacheOptions(options)
  )
}

export async function getOnSchedule(from: Date, to: Date, input?: number | OnScheduleOptions): Promise<OnScheduleKpi> {
  const range = normalizeRange(from, to)
  let windowDays = DEFAULT_WINDOW_DAYS
  let cacheOptions: CacheControl | undefined

  if (typeof input === 'number') {
    windowDays = input
  } else if (input) {
    windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS
    cacheOptions = input
  }

  return withIndicatorCache(
    {
      indicador: 'mantenimientos.on-schedule',
      from: range.from,
      to: range.to,
      parametros: { windowDays }
    },
    () => computeOnSchedule(range, windowDays),
    pickCacheOptions(cacheOptions)
  )
}

export async function getTechnicianUtilization(from: Date, to: Date, options?: TechnicianOptions): Promise<TechnicianUtilizationKpi> {
  const range = normalizeRange(from, to)
  return withIndicatorCache(
    {
      indicador: 'mantenimientos.technician-utilization',
      from: range.from,
      to: range.to
    },
    () => computeTechnicianUtilization(range),
    pickCacheOptions(options)
  )
}

export async function getOnTimeClose(from: Date, to: Date, input?: SlaMapping | OnTimeCloseOptions): Promise<OnTimeCloseKpi> {
  const range = normalizeRange(from, to)
  let slaMapping: SlaMapping | undefined
  let cacheOptions: CacheControl | undefined

  if (input) {
    if (isOnTimeCloseOptions(input)) {
      slaMapping = input.slaMapping
      cacheOptions = input
    } else {
      slaMapping = input
    }
  }

  return withIndicatorCache(
    {
      indicador: 'mantenimientos.on-time-close',
      from: range.from,
      to: range.to,
      parametros: slaMapping ? { slaMapping } : undefined
    },
    () => computeOnTimeClose(range, slaMapping),
    pickCacheOptions(cacheOptions)
  )
}

export async function getRescheduleRate(from: Date, to: Date, options?: CacheControl): Promise<RescheduleKpi> {
  const range = normalizeRange(from, to)
  return withIndicatorCache(
    {
      indicador: 'mantenimientos.reschedule-rate',
      from: range.from,
      to: range.to
    },
    () => computeRescheduleRate(range),
    pickCacheOptions(options)
  )
}

export async function getAvgTimePerJob(from: Date, to: Date, input?: number | RankingOptions): Promise<AvgTimePerJobKpi> {
  const range = normalizeRange(from, to)
  let limit = DEFAULT_LIST_LIMIT
  let cacheOptions: CacheControl | undefined

  if (typeof input === 'number') {
    limit = normalizeLimit(input, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
  } else if (input) {
    limit = normalizeLimit(input.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
    cacheOptions = input
  }

  return withIndicatorCache(
    {
      indicador: 'mantenimientos.avg-time-per-job',
      from: range.from,
      to: range.to,
      parametros: { limit }
    },
    () => computeAvgTimePerJob(range, limit),
    pickCacheOptions(cacheOptions)
  )
}

export async function getStockCritical(from: Date, to: Date, input?: number | RankingOptions): Promise<StockCriticalKpi> {
  const range = normalizeRange(from, to)
  const defaultLimit = 8
  let limit = defaultLimit
  let cacheOptions: CacheControl | undefined

  if (typeof input === 'number') {
    limit = normalizeLimit(input, defaultLimit, MAX_LIST_LIMIT)
  } else if (input) {
    limit = normalizeLimit(input.limit, defaultLimit, MAX_LIST_LIMIT)
    cacheOptions = input
  }

  return withIndicatorCache(
    {
      indicador: 'mantenimientos.stock-critical',
      from: range.from,
      to: range.to,
      parametros: { limit }
    },
    () => computeStockCritical(range, limit),
    pickCacheOptions(cacheOptions)
  )
}

export async function getReworkRate(from: Date, to: Date, input?: number | RankingOptions): Promise<ReworkRateKpi> {
  const range = normalizeRange(from, to)
  let limit = DEFAULT_LIST_LIMIT
  let cacheOptions: CacheControl | undefined

  if (typeof input === 'number') {
    limit = normalizeLimit(input, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
  } else if (input) {
    limit = normalizeLimit(input.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
    cacheOptions = input
  }

  return withIndicatorCache(
    {
      indicador: 'mantenimientos.rework-rate',
      from: range.from,
      to: range.to,
      parametros: { limit }
    },
    () => computeReworkRate(range, limit),
    pickCacheOptions(cacheOptions)
  )
}

export async function getCsat(from: Date, to: Date, options?: CacheControl): Promise<CsatKpi> {
  const range = normalizeRange(from, to)
  return withIndicatorCache(
    {
      indicador: 'mantenimientos.csat',
      from: range.from,
      to: range.to
    },
    () => computeCsat(range),
    pickCacheOptions(options)
  )
}
