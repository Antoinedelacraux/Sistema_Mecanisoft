import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { getVentasResumen } from '@/lib/reportes/ventasResumen'

const EXPORT_PATH = process.env.EXPORT_PATH || path.join(process.cwd(), 'public', 'exports')
if (!fs.existsSync(EXPORT_PATH)) fs.mkdirSync(EXPORT_PATH, { recursive: true })

async function run() {
  console.log('Running one-off ventas_resumen report...')
  // Use a sensible default range (last 30 days) to avoid passing nulls
  const now = new Date()
  const fechaFin = now.toISOString()
  const fechaInicio = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString()
  let rows: any[] = []
  try {
    rows = (await getVentasResumen({ fechaInicio, fechaFin })) as any[]
  } catch (err: any) {
    console.warn('getVentasResumen failed, falling back to sample data:', err)
    // sample fallback data
    rows = [
      { periodo: fechaInicio.split('T')[0], cantidad_ventas: 0, total_bruto: 0, total_descuentos: 0, total_impuestos: 0, total_neto: 0 },
      { periodo: fechaFin.split('T')[0], cantidad_ventas: 0, total_bruto: 0, total_descuentos: 0, total_impuestos: 0, total_neto: 0 },
    ]
  }
  const filename = `ventas_resumen_manual_${Date.now()}.csv`
  const outPath = path.join(EXPORT_PATH, filename)

  const stream = fs.createWriteStream(outPath, { encoding: 'utf8' })
  if (!rows || rows.length === 0) {
    stream.write('No hay datos\n')
    stream.end()
  } else {
    const keys = Object.keys(rows[0])
    stream.write(keys.join(',') + '\n')
    for (const r of rows) {
      const line = keys.map((k) => {
        const v = r[k]
        if (v == null) return ''
        return String(v).replace(/\n/g, ' ').replace(/,/g, '.')
      }).join(',')
      stream.write(line + '\n')
    }
    stream.end()
  }

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', (e) => reject(e))
  })

  console.log('Wrote file to', outPath)

    try {
      const stats = fs.statSync(outPath)
      try {
        const rf = (prisma as any).reportFile
        if (rf && typeof rf.create === 'function') {
          const rec = await rf.create({ data: {
            templateKey: 'ventas_resumen',
            path: outPath,
            filename,
            mime: 'text/csv',
            size: Number(stats.size),
            createdBy: 1
          }})
          console.log('Inserted reportFile record:', rec)
        } else {
          console.warn('Prisma model reportFile not available (migrations may not be applied). Skipping DB insert.')
        }
      } catch (err) {
        console.warn('Could not insert reportFile (maybe migrations not applied or DB not configured):', err)
      }
    } catch (err) {
      console.error('Could not stat output file', err)
    }
}

run().catch((e) => { console.error(e); process.exit(1) })
