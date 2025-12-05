import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'

import { prisma } from '@/lib/prisma'
import { renderPdf } from '@/lib/reportes/workerUtils'
import { resolveReportFilePath } from '@/lib/reportes/storagePaths'

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function buildSampleRows(templateKey: string) {
  return [
    { Indicador: 'Template', Valor: templateKey },
    { Indicador: 'Total registros', Valor: Math.floor(Math.random() * 50) + 10 }
  ]
}

async function writeCsv(filePath: string, rows: Record<string, any>[]) {
  const keys = rows.length > 0 ? Object.keys(rows[0]) : ['Indicador', 'Valor']
  const csvContent = [keys.join(','), ...rows.map((row) => keys.map((k) => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
  ensureDir(filePath)
  fs.writeFileSync(filePath, csvContent, 'utf8')
}

async function writeXlsx(filePath: string, rows: Record<string, any>[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Reporte')
  if (rows.length === 0) {
    sheet.addRow(['Sin datos'])
  } else {
    const keys = Object.keys(rows[0])
    sheet.addRow(keys)
    rows.forEach((row) => sheet.addRow(keys.map((k) => row[k] ?? '')))
  }
  ensureDir(filePath)
  await workbook.xlsx.writeFile(filePath)
}

async function materializeFile(file: { filename: string; path: string; mime: string | null; templateKey: string }) {
  const rows = buildSampleRows(file.templateKey)
  const absolutePath = resolveReportFilePath(file.path)
  if (file.mime?.includes('spreadsheetml')) {
    await writeXlsx(absolutePath, rows)
  } else if (file.mime?.includes('pdf')) {
    await renderPdf(rows, file.filename, { outPath: absolutePath })
  } else {
    await writeCsv(absolutePath, rows)
  }
  return absolutePath
}

async function main() {
  const files = await prisma.reportFile.findMany({ orderBy: { id: 'asc' } })
  let regenerated = 0
  for (const file of files) {
    try {
      const absolute = resolveReportFilePath(file.path)
      if (fs.existsSync(absolute)) continue
      await materializeFile(file)
      regenerated += 1
      console.log(`✅ Archivo regenerado: ${file.filename}`)
    } catch (error) {
      console.error(`❌ No se pudo regenerar ${file.filename}:`, error)
    }
  }

  console.log(`
Resumen: ${regenerated} archivo(s) faltantes regenerados.`)
}

main()
  .catch((error) => {
    console.error('❌ Error en backfill-report-files:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
