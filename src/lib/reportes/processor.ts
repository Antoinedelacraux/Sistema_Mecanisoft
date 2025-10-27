import path from 'path'
import fs from 'fs'
import ExcelJS from 'exceljs'

import { prisma } from '@/lib/prisma'
import { getVentasResumen } from '@/lib/reportes/ventasResumen'
import { renderPdf, sendEmailWithAttachment } from '@/lib/reportes/workerUtils'

const EXPORT_PATH = process.env.EXPORT_PATH || path.join(process.cwd(), 'public', 'exports')
if (!fs.existsSync(EXPORT_PATH)) fs.mkdirSync(EXPORT_PATH, { recursive: true })

async function renderXlsx(rows: any[], filename: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Reporte')
  if (rows.length === 0) {
    sheet.addRow(['No hay datos'])
  } else {
    const keys = Object.keys(rows[0])
    sheet.addRow(keys)
    for (const r of rows) {
      sheet.addRow(keys.map((k) => r[k]))
    }
  }
  const outPath = path.join(EXPORT_PATH, filename)
  await workbook.xlsx.writeFile(outPath)
  return outPath
}

async function renderCsv(rows: any[], filename: string) {
  const outPath = path.join(EXPORT_PATH, filename)
  const stream = fs.createWriteStream(outPath, { encoding: 'utf8' })
  if (!rows || rows.length === 0) {
    stream.write('No hay datos\n')
    stream.end()
    return outPath
  }
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
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', (e) => reject(e))
  })
  return outPath
}

type JobPayload = {
  key: string
  params?: any
  format?: 'csv' | 'xlsx' | 'pdf'
  requestedBy?: number | string
  recipients?: string[] | string
}

export async function processReportJob(payload: JobPayload) {
  const t0 = Date.now()
  const { key, params = {}, format = 'csv', requestedBy } = payload
  if (key === 'ventas_resumen') {
    // normalize params expected by getVentasResumen
    const now = new Date()
    const defaultDesde = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30) // 30 days ago
    const fechaInicio = params?.fechaInicio ?? params?.desde ?? defaultDesde.toISOString()
    const fechaFin = params?.fechaFin ?? params?.hasta ?? now.toISOString()
    const gqlParams = { fechaInicio, fechaFin, sucursalId: params?.sucursalId ?? null, vendedorId: params?.vendedorId ?? null, agruparPor: params?.agruparPor ?? 'dia' }
    const rows = (await getVentasResumen(gqlParams as any)) as any[]
    const timestamp = Date.now()
    const filenameBase = `ventas_resumen_${requestedBy || 'anon'}_${timestamp}`
    let outPath = ''
    if (format === 'xlsx') {
      outPath = await renderXlsx(rows, filenameBase + '.xlsx')
    } else if (format === 'csv') {
      outPath = await renderCsv(rows, filenameBase + '.csv')
    } else if (format === 'pdf') {
      outPath = await renderPdf(rows, filenameBase + '.pdf')
    } else {
      outPath = await renderCsv(rows, filenameBase + '.csv')
    }

    // Storage: upload to S3 if configured otherwise keep local path
    let storedPath = outPath
    let fileSize = 0
    const mime = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : (format === 'pdf' ? 'application/pdf' : 'text/csv')
  const createdByUser = requestedBy != null ? Number(requestedBy) : null

    try {
      if (process.env.S3_BUCKET) {
        try {
          const buffer = fs.readFileSync(outPath)
          fileSize = buffer.length
          const keyName = `reportes/${path.basename(outPath)}`
          const { uploadFileToS3 } = await import('@/lib/storage/s3')
          await uploadFileToS3(keyName, buffer, mime)
          storedPath = keyName
          if (process.env.DELETE_LOCAL_AFTER_S3_UPLOAD === 'true') {
            try { fs.unlinkSync(outPath) } catch (e) { /* ignore */ }
          }
        } catch (err) {
          console.warn('[processor] S3 upload failed, falling back to local file', err)
          if (!fileSize) {
            try { fileSize = fs.statSync(outPath).size } catch (e) { fileSize = 0 }
          }
          storedPath = outPath
        }
      } else {
        fileSize = fs.statSync(outPath).size
        storedPath = outPath
      }

      try {
        await prisma.reportFile.create({
          data: {
            templateKey: key,
            path: storedPath,
            filename: path.basename(storedPath),
            mime,
            size: Number(fileSize),
            createdBy: createdByUser
          }
        })
      } catch (err) {
        console.warn('[processor] could not persist ReportFile metadata', err)
      }
    } catch (err) {
      console.warn('[processor] storage/persist error', err)
    }

    if (createdByUser != null) {
      try {
        await prisma.bitacora.create({
          data: {
            id_usuario: createdByUser,
            accion: 'GENERAR_REPORTE_PROCESSOR',
            descripcion: `Generado ${key}`,
            tabla: 'reportes'
          }
        })
      } catch (err) {
        console.warn('[processor] could not write bitacora', err)
      }
    }

    // send email
    try {
      const recipientsRaw = payload.recipients
      const recipientList = Array.isArray(recipientsRaw)
        ? recipientsRaw
        : typeof recipientsRaw === 'string'
          ? recipientsRaw.split(',').map((r) => r.trim()).filter(Boolean)
          : []
      if (recipientList.length > 0) {
        const to = recipientList.join(',')
        const subject = `Reporte ${key}`
        const text = `Se adjunta el reporte ${key}`
        await sendEmailWithAttachment({ to, subject, text, attachments: [{ filename: path.basename(outPath), path: outPath }] })
      }
    } catch (err) {
      console.warn('[processor] error sending email', err)
    }

    const elapsed = Date.now() - t0
    try {
      const { inc } = await import('./metrics')
      inc('processingRuns', 1)
      inc('processingMsTotal', elapsed)
    } catch {}
    return { outPath: storedPath, elapsedMs: elapsed }
  }

  throw new Error('Reporte no soportado por processor')
}

export default processReportJob
