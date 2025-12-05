import fs from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { resolveReportFilePath } from '@/lib/reportes/storagePaths'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'reportes.descargar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para descargar reportes' }, { status: 403 })
      }
      throw error
    }

    const { id: idRaw } = await context.params
    const id = Number(idRaw)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const file = await prisma.reportFile.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

    // If S3 configured, return presigned URL
    if (process.env.S3_BUCKET) {
      try {
        const { getPresignedUrlForKey } = await import('@/lib/storage/s3')
        const key = file.path // when using S3, worker should store S3 key in path
        const url = await getPresignedUrlForKey(key, 60 * 60)
        return NextResponse.redirect(url)
      } catch (err) {
        console.error('[download/report-file] s3 presign error', err)
      }
    }

    // Fallback: stream local file if it exists under /public/exports
    let normalizedPath: string
    try {
      normalizedPath = resolveReportFilePath(file.path)
    } catch (err) {
      console.warn('[download/report-file] ruta inválida', err)
      return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
    }

    const stats = await fs.stat(normalizedPath).catch(() => null)
    if (!stats || !stats.isFile()) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const buffer = await fs.readFile(normalizedPath)
    const dispositionName = encodeURIComponent(file.filename || path.basename(normalizedPath))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.mime || 'application/octet-stream',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${dispositionName}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (err) {
    console.error('[GET /api/reportes/files/:id/download] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
