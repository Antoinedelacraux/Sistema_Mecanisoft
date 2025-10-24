import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await asegurarPermiso(session, 'bitacora.ver')
    } catch (error) {
      if (error instanceof SesionInvalidaError) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      if (error instanceof PermisoDenegadoError) return NextResponse.json({ error: 'No tienes permiso para ver la bitácora' }, { status: 403 })
      throw error
    }

    const url = request.nextUrl
    const page = Number(url.searchParams.get('page') ?? '1')
    const perPage = Math.min(Number(url.searchParams.get('perPage') ?? '25'), 200)
    const skip = (Math.max(page, 1) - 1) * perPage

    const where: any = {}
    const usuarioId = url.searchParams.get('usuarioId')
    const tabla = url.searchParams.get('tabla')
    const accion = url.searchParams.get('accion')
    const desde = url.searchParams.get('desde')
    const hasta = url.searchParams.get('hasta')

    if (usuarioId) where.id_usuario = Number(usuarioId)
    if (tabla) where.tabla = tabla
    if (accion) where.accion = accion
    if (desde || hasta) {
      where.fecha_hora = {}
      if (desde) where.fecha_hora.gte = new Date(desde)
      if (hasta) where.fecha_hora.lte = new Date(hasta)
    }

    const [total, eventos] = await Promise.all([
      prisma.bitacora.count({ where }),
      prisma.bitacora.findMany({ where, orderBy: { fecha_hora: 'desc' }, skip, take: perPage })
    ])

    // Export CSV if requested
    if (url.searchParams.get('export') === 'csv') {
      const headers = ['id_bitacora', 'fecha_hora', 'id_usuario', 'accion', 'tabla', 'descripcion', 'ip_publica']
      const rows = eventos.map((ev: any) => headers.map(h => {
        const v = ev[h]
        if (v === null || v === undefined) return ''
        // escape simple CSV
        const s = String(v).replace(/"/g, '""')
        return `"${s}"`
      }).join(','))
      const csv = [headers.join(','), ...rows].join('\n')
      return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bitacora_${Date.now()}.csv"` } })
    }

    return NextResponse.json({ total, page, perPage, eventos })
  } catch (error) {
    console.error('[bitacora] error listando', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
