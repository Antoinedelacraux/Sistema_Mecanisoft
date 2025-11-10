import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { subDays } from 'date-fns'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
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
} from '@/lib/indicadores/mantenimientos'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { logger } from '@/lib/logger'

const REQUIRED_PERMISSIONS = ['indicadores.ver', 'mantenimientos.ver'] as const

const asegurarPermisosIndicadores = async (session: Awaited<ReturnType<typeof getServerSession>>) => {
  for (const permiso of REQUIRED_PERMISSIONS) {
    try {
      await asegurarPermiso(session, permiso)
      return
    } catch (error) {
      if (error instanceof PermisoDenegadoError) {
        continue
      }
      throw error
    }
  }
  throw new PermisoDenegadoError('No cuentas con permisos para indicadores')
}

const bodySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  indicadores: z.array(z.string()).optional(),
})

type Range = { from: Date; to: Date }

type Registro = {
  indicador: string
  run: (range: Range) => Promise<unknown>
}

const registros: Registro[] = [
  { indicador: 'mantenimientos.coverage', run: (range) => getCoverage(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.on-schedule', run: (range) => getOnSchedule(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.technician-utilization', run: (range) => getTechnicianUtilization(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.on-time-close', run: (range) => getOnTimeClose(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.reschedule-rate', run: (range) => getRescheduleRate(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.avg-time-per-job', run: (range) => getAvgTimePerJob(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.stock-critical', run: (range) => getStockCritical(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.rework-rate', run: (range) => getReworkRate(range.from, range.to, { force: true }) },
  { indicador: 'mantenimientos.csat', run: (range) => getCsat(range.from, range.to, { force: true }) },
]

const registryMap = new Map(registros.map((entry) => [entry.indicador, entry]))

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermisosIndicadores(session)
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
    }
    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: 'No cuentas con permisos para recalcular indicadores.' }, { status: 403 })
    }
    logger.error({ err: error }, '[indicadores] error validando permisos para recalculo')
    return NextResponse.json({ error: 'No se pudo validar tus permisos.' }, { status: 500 })
  }

  let parsedBody
  try {
    const json = await request.json()
    parsedBody = bodySchema.parse(json)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 400 })
    }
    logger.error({ err: error }, '[indicadores] error leyendo body de recalculo')
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const to = parsedBody.to ?? new Date()
  const from = parsedBody.from ?? subDays(to, 30)
  const range: Range = { from, to }

  const requested = parsedBody.indicadores && parsedBody.indicadores.length > 0
    ? parsedBody.indicadores
    : registros.map((entry) => entry.indicador)

  const results: Array<{ indicador: string; status: 'ok' | 'error' | 'unknown'; durationMs?: number; error?: string }> = []

  for (const indicador of requested) {
    const entry = registryMap.get(indicador)
    if (!entry) {
      results.push({ indicador, status: 'unknown' })
      continue
    }
    const started = Date.now()
    try {
      await entry.run(range)
      results.push({ indicador, status: 'ok', durationMs: Date.now() - started })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error({ indicador, err: message }, '[indicadores] error recalculando indicador')
      results.push({ indicador, status: 'error', durationMs: Date.now() - started, error: message })
    }
  }

  return NextResponse.json({
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    indicadores: results,
    recalculatedAt: new Date().toISOString(),
  })
}
