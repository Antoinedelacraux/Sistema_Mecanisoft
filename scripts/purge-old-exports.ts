import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

const retentionDays = Number(process.env.REPORTS_RETENTION_DAYS ?? 30)
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

async function main() {
  console.log('[purge] retentionDays', retentionDays, 'cutoff', cutoff.toISOString())
  const old = await (prisma as any).reportFile.findMany({ where: { createdAt: { lt: cutoff } } })
  console.log('[purge] found', old.length, 'old reportFile rows')

  for (const r of old) {
    try {
      if (!r.path) {
        await (prisma as any).reportFile.delete({ where: { id: r.id } })
        continue
      }

      if (process.env.S3_BUCKET && !r.path.startsWith(process.cwd())) {
        // treat as S3 key
        try {
          const { deleteFileFromS3 } = await import('@/lib/storage/s3')
          await deleteFileFromS3(r.path)
          console.log('[purge] deleted s3 key', r.path)
        } catch (e) {
          console.warn('[purge] could not delete s3 key', r.path, e)
        }
      } else {
        // local file
        try {
          if (fs.existsSync(r.path)) {
            fs.unlinkSync(r.path)
            console.log('[purge] deleted local file', r.path)
          }
        } catch (e) {
          console.warn('[purge] could not delete local file', r.path, e)
        }
      }

      try {
        await (prisma as any).reportFile.delete({ where: { id: r.id } })
        console.log('[purge] deleted DB row', r.id)
      } catch (e) {
        console.warn('[purge] could not delete DB row', r.id, e)
      }
    } catch (err) {
      console.error('[purge] error handling', r.id, err)
    }
  }

  console.log('[purge] done')
}

main().catch((e) => { console.error(e); process.exit(1) })
