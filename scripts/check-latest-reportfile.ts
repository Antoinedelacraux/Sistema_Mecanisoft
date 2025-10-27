import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function fetchLatest(limit = 10) {
  return (prisma as any).reportFile.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function main() {
  const maxWaitSec = Number(process.env.WAIT_SEC || 0)
  let files = await fetchLatest(10)
  let waited = 0
  while (files.length === 0 && waited < maxWaitSec) {
    await sleep(1000)
    waited += 1
    files = await fetchLatest(10)
  }

  console.log('Latest ReportFile entries:')
  console.log(JSON.stringify(files, null, 2))
  if (!files.length) {
    console.error('No ReportFile rows found')
    process.exit(1)
  }

  // If latest path looks like a local path, assert the file exists on disk
  const latest = files[0] as any
  const p: string = latest?.path || ''
  const looksLikeS3 = p.startsWith('reportes/') || p.startsWith('s3://')
  if (!looksLikeS3) {
    const exists = fs.existsSync(p)
    console.log('Latest file path:', p, 'exists?', exists)
    if (!exists) {
      console.error('Expected local file to exist but not found at path:', p)
      process.exit(1)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
