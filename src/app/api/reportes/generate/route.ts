import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { Queue } from 'bullmq'

import { authOptions } from '@/lib/auth'
import { getVentasResumen } from '@/lib/reportes/ventasResumen'
import { logEvent } from '@/lib/bitacora/log-event'
import { inc as incMetric } from '@/lib/reportes/metrics'
import { createRedisConnection } from '@/lib/redisClient'
import { processReportJob } from '@/lib/reportes/processor'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

const bodySchema = z.object({
  key: z.string(),
  params: z.record(z.string(), z.any()).optional(),
  preview: z.boolean().optional().default(false),
  format: z.enum(['pdf', 'xlsx', 'csv']).optional(),
  recipients: z.union([z.string(), z.array(z.string())]).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.format() }, { status: 400 })

    const { key, params = {}, preview, format, recipients } = parsed.data

    const requiredPermission = preview ? 'reportes.ver' : 'reportes.descargar'
    try {
      await asegurarPermiso(session, requiredPermission, { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        const message = preview
          ? 'No cuentas con permisos para previsualizar reportes'
          : 'No cuentas con permisos para generar reportes'
        return NextResponse.json({ error: message }, { status: 403 })
      }
      throw error
    }

    const usuarioId = Number(session.user.id)

    // simple routing for now
    if (key === 'ventas_resumen') {
      // expect fechaInicio / fechaFin
      const fechaInicio = params.fechaInicio ?? params.fecha_inicio
      const fechaFin = params.fechaFin ?? params.fecha_fin
      if (!fechaInicio || !fechaFin) return NextResponse.json({ error: 'fechaInicio y fechaFin son requeridos' }, { status: 400 })

      // map optional fields
      const toNumberOrNull = (v: any) => (v == null || v === '') ? null : Number(v)
      const svcParams = {
        fechaInicio: String(fechaInicio),
        fechaFin: String(fechaFin),
        sucursalId: toNumberOrNull(params.sucursalId ?? params.sucursal_id ?? null),
        vendedorId: toNumberOrNull(params.vendedorId ?? params.vendedor_id ?? null),
        agruparPor: (params.agrupar_por ?? params.agruparPor ?? 'dia') as any
      }

      const normalizedRecipients = Array.isArray(recipients)
        ? recipients
        : typeof recipients === 'string'
          ? recipients.split(',').map((r) => r.trim()).filter(Boolean)
          : []

      // generate preview
      if (preview) {
        const data = await getVentasResumen(svcParams)
        // log audit
        try {
          await logEvent({ usuarioId, accion: 'GENERAR_REPORTE', descripcion: `Preview ${key}`, tabla: 'reportes' })
        } catch {}
        return NextResponse.json({ success: true, data })
      }

      const queuePayload = {
        key,
        params: svcParams,
        format: format ?? 'csv',
        requestedBy: usuarioId,
        recipients: normalizedRecipients
      }

      const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
      const shouldFallback = process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true'

      if (shouldFallback) {
        setImmediate(async () => {
          try {
            await processReportJob(queuePayload)
            try { incMetric('fallbackRuns') } catch {}
          } catch (err) {
            console.error('[reportes/generate] fallback processing failed', err)
          }
        })
        return NextResponse.json({ success: true, queued: true, fallback: true })
      }

      let connection: any | undefined
      try {
        connection = await createRedisConnection(redisUrl)
      } catch (err) {
        console.warn('[reportes/generate] Redis connection failed, falling back to direct processing', err)
        setImmediate(async () => {
          try {
            await processReportJob(queuePayload)
            try { incMetric('fallbackRuns') } catch {}
          } catch (err2) {
            console.error('[reportes/generate] redis-fallback processing failed', err2)
          }
        })
        return NextResponse.json({ success: true, queued: true, fallback: true })
      }

      const queue = new Queue('reportes', { connection })
      try {
        const job = await queue.add('generate', queuePayload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: true
        })
        try { incMetric('jobsEnqueued') } catch {}
        return NextResponse.json({ success: true, jobId: job.id, queued: true })
      } finally {
        await queue.close()
        if (typeof connection?.disconnect === 'function') {
          connection.disconnect()
        }
      }
    }

    return NextResponse.json({ error: 'Reporte no soportado' }, { status: 400 })
  } catch (error) {
    console.error('[reportes/generate] error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
