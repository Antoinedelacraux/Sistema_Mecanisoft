import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function POST(_request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await asegurarPermiso(session, 'reportes.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para purgar archivos de reportes' }, { status: 403 })
      }
      throw error
    }

    // run purge script logic inline to avoid spawning processes
    const retentionDays = Number(process.env.REPORTS_RETENTION_DAYS ?? 30)
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    const old = await (prisma as any).reportFile.findMany({ where: { createdAt: { lt: cutoff } } })

    for (const r of old) {
      try {
        if (!r.path) {
          await (prisma as any).reportFile.delete({ where: { id: r.id } })
          continue
        }

        if (process.env.S3_BUCKET && !r.path.startsWith(process.cwd())) {
          try {
            const { deleteFileFromS3 } = await import('@/lib/storage/s3')
            await deleteFileFromS3(r.path)
          } catch (e) { console.warn('purge api: s3 delete failed', e) }
        } else {
          try { const fs = await import('fs'); if (fs.existsSync(r.path)) fs.unlinkSync(r.path) } catch (e) { console.warn('purge api: file delete failed', e) }
        }

        try { await (prisma as any).reportFile.delete({ where: { id: r.id } }) } catch (e) { console.warn('purge api: db delete failed', e) }
      } catch (err) { console.error('purge api: entry error', err) }
    }

    return NextResponse.json({ success: true, deleted: old.length })
  } catch (err) {
    console.error('[reportes/purge] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
