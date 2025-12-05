import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'

import { prisma } from '@/lib/prisma'
import { processReportJob } from '@/lib/reportes/processor'
import { resolveReportFilePath } from '@/lib/reportes/storagePaths'

const DAY_MS = 1000 * 60 * 60 * 24

async function ensureAdminId() {
  const admin = await prisma.usuario.findFirst({ where: { estado: true }, orderBy: { id_usuario: 'asc' } })
  if (!admin) {
    throw new Error('No hay usuarios activos para asociar la verificación de reportes.')
  }
  return admin.id_usuario
}

async function generateVentasResumenSamples(adminId: number) {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * DAY_MS)

  const formats: Array<'csv' | 'xlsx' | 'pdf'> = ['csv', 'xlsx', 'pdf']
  const results: Array<{ format: string; outPath: string; size: number; elapsedMs: number }> = []

  for (const format of formats) {
    const t0 = performance.now()
    const { outPath } = await processReportJob({
      key: 'ventas_resumen',
      format,
      requestedBy: adminId,
      params: {
        fechaInicio: start.toISOString(),
        fechaFin: now.toISOString(),
        agruparPor: 'dia'
      }
    })
    const elapsedMs = performance.now() - t0
    const diskPath = outPath.startsWith('reportes/') ? path.join(process.cwd(), 'public', outPath) : outPath
    const normalized = fs.existsSync(diskPath) ? diskPath : resolveReportFilePath(outPath)
    const size = fs.existsSync(normalized) ? fs.statSync(normalized).size : 0
    results.push({ format, outPath: normalized, size, elapsedMs })
  }

  return results
}

async function validateDownloadables(limit = 10) {
  const files = await prisma.reportFile.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
  return files.map((file) => {
    let exists = false
    let normalized = ''
    try {
      normalized = resolveReportFilePath(file.path)
      exists = fs.existsSync(normalized)
    } catch (error) {
      normalized = `ERROR: ${(error as Error).message}`
    }
    return {
      id: file.id,
      file: file.filename,
      mime: file.mime,
      size: file.size,
      exists,
      path: normalized
    }
  })
}

async function main() {
  const adminId = await ensureAdminId()
  const generationResults = await generateVentasResumenSamples(adminId)
  const downloadables = await validateDownloadables(15)

  console.log('✅ Ventas - Resumen generado en los tres formatos:')
  console.table(
    generationResults.map((result) => ({
      formato: result.format,
      archivo: path.basename(result.outPath),
      tamañoKB: Math.round(result.size / 1024),
      duracionMs: Math.round(result.elapsedMs)
    }))
  )

  console.log('\n📂 Últimos archivos registrados en reportes.reportFile:')
  console.table(
    downloadables.map((item) => ({
      id: item.id,
      archivo: item.file,
      mime: item.mime,
      existe: item.exists,
      ruta: item.path.startsWith('ERROR') ? item.path : path.relative(process.cwd(), item.path)
    }))
  )
}

main()
  .catch((error) => {
    console.error('❌ Verificación de reportes falló:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
