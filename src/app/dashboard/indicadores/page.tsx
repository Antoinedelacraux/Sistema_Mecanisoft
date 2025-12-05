import { ShieldAlert } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { unstable_cache } from 'next/cache'

import { format } from 'date-fns'

import { IndicadoresFilterBar } from '@/components/indicadores/filter-bar'
import { KpiCard } from '@/components/indicadores/kpi-card'
import { IndicatorDonutChart } from '@/components/indicadores/donut-chart'
import { IndicatorHeatmap } from '@/components/indicadores/heatmap'
import { IndicatorLineChart } from '@/components/indicadores/line-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { authOptions } from '@/lib/auth'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import {
  getAvgTimePerJob,
  getCoverage,
  getCsat,
  getOnSchedule,
  getOnTimeClose,
  getReworkRate,
  getRescheduleRate,
  getStockCritical,
  getTechnicianUtilization
} from '@/lib/indicadores/mantenimientos'
import { prisma } from '@/lib/prisma'

import type { CsatKpi, OnTimeCloseKpi, TechnicianUtilizationItem } from '@/types/indicadores'
const parseDateParam = (value: string | string[] | undefined, fallback: Date): Date => {
  if (!value) return fallback
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.isNaN(Date.parse(raw)) ? null : new Date(raw)
  return parsed ?? fallback
}

const parseWindowDays = (value: string | string[] | undefined, fallback = 2): number => {
  if (!value) return fallback
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback
  }
  return Math.min(parsed, 30)
}

const formatHours = (minutes: number) => {
  const hours = minutes / 60
  if (hours >= 1) {
    return `${hours.toFixed(1)} h`
  }
  return `${minutes.toFixed(0)} min`
}

const buildTechnicianHeatmap = (items: TechnicianUtilizationItem[]) =>
  items.map((item) => ({
    label: item.nombre,
    values: [
      {
        label: 'Utilización',
        value: item.utilization,
        helper: `${formatHours(item.minutosAsignados)} / ${formatHours(item.minutosDisponibles)}`
      },
      {
        label: 'Horas asignadas',
        value: item.minutosAsignados / 60,
        helper: `${item.tareas} tareas`
      },
      {
        label: 'Horas disponibles',
        value: item.minutosDisponibles / 60
      }
    ]
  }))

const buildOnTimeLine = (data: OnTimeCloseKpi) =>
  Object.entries(data.breakdown).map(([prioridad, info]) => ({
    label: prioridad.toUpperCase(),
    value: info.tasa * 100
  }))

const safeDivision = (numerador: number, denominador: number) => (denominador > 0 ? numerador / denominador : 0)

const buildCsatSlices = (csat: CsatKpi) => {
  if (csat.totalRespuestas === 0) {
    return []
  }
  return csat.breakdown
    .filter((item) => item.total > 0)
    .map((item) => ({
      label: `Score ${item.score}`,
      value: item.total / csat.totalRespuestas
    }))
}

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleDateString()
}

const formatDecimal = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1))

const getIndicadoresSnapshot = unstable_cache(
  async (fromISO: string, toISO: string, windowDays: number) => {
    const from = new Date(fromISO)
    const to = new Date(toISO)

    const [
      coverage,
      onSchedule,
      technicianUtilization,
      onTimeClose,
      reschedule,
      avgTime,
      stockCritical,
      reworkRate,
      csat
    ] = await Promise.all([
      getCoverage(from, to),
      getOnSchedule(from, to, windowDays),
      getTechnicianUtilization(from, to),
      getOnTimeClose(from, to),
      getRescheduleRate(from, to),
      getAvgTimePerJob(from, to, { limit: 6 }),
      getStockCritical(from, to, { limit: 6 }),
      getReworkRate(from, to, { limit: 6 }),
      getCsat(from, to)
    ])

    return {
      coverage,
      onSchedule,
      technicianUtilization,
      onTimeClose,
      reschedule,
      avgTime,
      stockCritical,
      reworkRate,
      csat
    }
  },
  ['dashboard-indicadores'],
  { revalidate: 90, tags: ['indicadores-dashboard'] }
)

const IndicadoresPage = async ({
  searchParams
}: {
  searchParams:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>
}) => {
  const resolvedSearchParams = await searchParams
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermiso(session, 'indicadores.ver', { prismaClient: prisma })
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return (
        <Alert className="mt-6">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <AlertTitle>Sesión requerida</AlertTitle>
          <AlertDescription>Debes iniciar sesión nuevamente para acceder al módulo de indicadores.</AlertDescription>
        </Alert>
      )
    }

    if (error instanceof PermisoDenegadoError) {
      try {
        await asegurarPermiso(session, 'mantenimientos.ver', { prismaClient: prisma })
      } catch (permisoError) {
        if (permisoError instanceof PermisoDenegadoError || permisoError instanceof SesionInvalidaError) {
          return (
            <Alert className="mt-6">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              <AlertTitle>Acceso restringido</AlertTitle>
              <AlertDescription>No cuentas con permisos para visualizar el módulo de indicadores.</AlertDescription>
            </Alert>
          )
        }
        throw permisoError
      }
    } else {
      throw error
    }
  }

  const now = new Date()
  const defaultFrom = new Date(now)
  defaultFrom.setDate(now.getDate() - 29)

  const from = parseDateParam(resolvedSearchParams.from, defaultFrom)
  const to = parseDateParam(resolvedSearchParams.to, now)
  const windowDays = parseWindowDays(resolvedSearchParams.windowDays)

  const fromInputValue = format(from, 'yyyy-MM-dd')
  const toInputValue = format(to, 'yyyy-MM-dd')

  let snapshot: Awaited<ReturnType<typeof getIndicadoresSnapshot>> | null = null

  try {
    snapshot = await getIndicadoresSnapshot(from.toISOString(), to.toISOString(), windowDays)
  } catch (error) {
    console.error('Error cargando indicadores', error)
  }

  if (
    !snapshot ||
    !snapshot.coverage ||
    !snapshot.onSchedule ||
    !snapshot.technicianUtilization ||
    !snapshot.onTimeClose ||
    !snapshot.reschedule ||
    !snapshot.avgTime ||
    !snapshot.stockCritical ||
    !snapshot.reworkRate ||
    !snapshot.csat
  ) {
    return (
      <Alert className="mt-6">
        <ShieldAlert className="h-5 w-5 text-orange-500" />
        <AlertTitle>Error al cargar datos</AlertTitle>
        <AlertDescription>Ocurrió un problema al recuperar los indicadores. Intenta nuevamente en unos minutos.</AlertDescription>
      </Alert>
    )
  }

  const { coverage, onSchedule, technicianUtilization, onTimeClose, reschedule, avgTime, stockCritical, reworkRate, csat } = snapshot

  const kpis = [
    {
      title: 'Cobertura programada',
      value: `${coverage.coverageRate.toFixed(1)}%`,
      helper: `${coverage.vehiculosProgramados} vehículos programados de ${coverage.totalVehiculos}`
    },
    {
      title: `Cumplimiento (${windowDays} días)`,
      value: `${onSchedule.onScheduleRate.toFixed(1)}%`,
      helper: `${onSchedule.completadosDentroVentana}/${onSchedule.totalCompletados} mantenimientos completados`
    },
    {
      title: 'Utilización promedio técnicos',
      value: `${(technicianUtilization.promedioUtilizacion * 100).toFixed(1)}%`,
      helper: `${technicianUtilization.items.length} técnicos con tareas asignadas`
    },
    {
      title: 'Cierre a tiempo',
      value: `${onTimeClose.onTimeRate.toFixed(1)}%`,
      helper: `${onTimeClose.cerradasDentroSla}/${onTimeClose.totalCerradas} órdenes dentro de SLA`
    },
    {
      title: 'Reprogramación',
      value: `${reschedule.rescheduleRate.toFixed(1)}%`,
      helper: `${reschedule.reprogramados}/${reschedule.totalProgramados} mantenimientos reprogramados`
    },
    {
      title: 'Tiempo promedio servicio',
      value: formatHours(avgTime.promedioGlobal),
      helper: `${avgTime.totalServicios} servicios con tareas registradas`
    },
    {
      title: 'Stock crítico OK',
      value: `${stockCritical.cumplimientoRate.toFixed(1)}%`,
      helper: `${stockCritical.enNivel}/${stockCritical.totalCriticos} ítems en nivel`
    },
    {
      title: 'Retrabajo',
      value: `${reworkRate.reworkRate.toFixed(1)}%`,
      helper: `${reworkRate.reabiertas}/${reworkRate.totalCerradas} órdenes reabiertas`
    },
    {
      title: 'CSAT promedio',
      value: csat.promedio.toFixed(2),
      helper: `${csat.totalRespuestas} respuestas registradas`
    }
  ]

  const donutSlices = Object.entries(onTimeClose.breakdown).map(([prioridad, info]) => ({
    label: prioridad.toUpperCase(),
    value: info.total
  }))

  const donutTotal = donutSlices.reduce((acc, slice) => acc + slice.value, 0)
  const donutData = donutSlices.map((slice) => ({
    label: slice.label,
    value: donutTotal > 0 ? safeDivision(slice.value, donutTotal) : 0
  }))

  const topTechnicians = technicianUtilization.items.slice(0, 6)

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Indicadores de Mantenimientos</h1>
        <p className="text-sm text-muted-foreground">
          Evaluación del desempeño operativo entre {new Date(coverage.from).toLocaleDateString()} y {new Date(coverage.to).toLocaleDateString()}.
        </p>
      </header>

      <IndicadoresFilterBar initialFrom={fromInputValue} initialTo={toInputValue} initialWindowDays={windowDays} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => (
          <KpiCard key={item.title} title={item.title} value={item.value} helper={item.helper} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Cumplimiento por prioridad</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {donutData.length ? (
              <IndicatorDonutChart slices={donutData} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin datos disponibles.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Cumplimiento por prioridad (detalle)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {donutData.length ? (
              <IndicatorLineChart points={buildOnTimeLine(onTimeClose)} color="rgb(37, 99, 235)" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin datos disponibles.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Razones principales de reprogramación</CardTitle>
          </CardHeader>
          <CardContent>
            {reschedule.topReasons.length ? (
              <ul className="space-y-2 text-sm">
                {reschedule.topReasons.map((reason, index) => (
                  <li key={`${reason.reason}-${index}`} className="flex items-center justify-between">
                    <span>{reason.reason || 'Sin motivo registrado'}</span>
                    <span className="text-muted-foreground">{reason.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No se registraron reprogramaciones en el período.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Servicios con mayor duración promedio</CardTitle>
          </CardHeader>
          <CardContent>
            {avgTime.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2">Servicio</th>
                      <th className="pb-2">Promedio</th>
                      <th className="pb-2 text-right">Tareas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avgTime.items.map((item) => (
                      <tr key={item.servicioId} className="border-t border-border">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{item.servicioNombre}</span>
                        </td>
                        <td className="py-2 pr-3">{formatHours(item.promedioMinutos)}</td>
                        <td className="py-2 text-right text-muted-foreground">{item.tareas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No hay tareas registradas para el período.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Inventario crítico</CardTitle>
          </CardHeader>
          <CardContent>
            {stockCritical.items.length ? (
              <ul className="space-y-3 text-sm">
                {stockCritical.items.map((item) => (
                  <li key={item.inventarioId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium leading-tight">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">{item.codigo} · {item.almacen}</p>
                    </div>
                    <div className={`text-right ${item.nivel === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      <p className="text-sm font-semibold">{formatDecimal(item.stockDisponible)} / {formatDecimal(item.stockMinimo)}</p>
                      <p className="text-xs uppercase tracking-wide">{item.nivel === 'ok' ? 'En nivel' : 'Bajo mínimo'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No hay repuestos críticos configurados.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Órdenes con retrabajo</CardTitle>
          </CardHeader>
          <CardContent>
            {reworkRate.items.length ? (
              <ul className="space-y-3 text-sm">
                {reworkRate.items.map((item) => (
                  <li key={item.ordenId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium leading-tight">{item.codigo}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.prioridad ? item.prioridad.toUpperCase() : 'SIN PRIORIDAD'} · última {formatDateLabel(item.ultimaFecha)}
                      </p>
                    </div>
                    <span className="text-rose-600 font-semibold">x{item.reaperturas}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">No se registraron reaperturas para el período.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Satisfacción del cliente (CSAT)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {csat.totalRespuestas ? (
              <>
                <div className="h-56">
                  <IndicatorDonutChart slices={buildCsatSlices(csat)} />
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-muted-foreground">
                  {csat.breakdown.map((item) => (
                    <div key={item.score}>
                      <p className="font-semibold text-foreground">{item.score}</p>
                      <p>{item.total}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin feedback registrado.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Utilización de técnicos</CardTitle>
          </CardHeader>
          <CardContent>
            {topTechnicians.length ? (
              <IndicatorHeatmap
                rows={buildTechnicianHeatmap(topTechnicians)}
                valueFormatter={(value) => (value >= 1 ? `${value.toFixed(1)} h` : `${(value * 100).toFixed(0)}%`)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">No hay tareas asignadas para el período seleccionado.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default IndicadoresPage
