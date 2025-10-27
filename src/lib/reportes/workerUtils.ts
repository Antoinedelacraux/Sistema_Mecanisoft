import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import nodemailer from 'nodemailer'

const EXPORT_PATH = process.env.EXPORT_PATH || path.join(process.cwd(), 'public', 'exports')

export async function renderPdf(rows: any[], filename: string) {
  const outPath = path.join(EXPORT_PATH, filename)
  if (!fs.existsSync(EXPORT_PATH)) fs.mkdirSync(EXPORT_PATH, { recursive: true })

  // Try to use Puppeteer (preferred for HTML->PDF). If not available, fallback to pdfkit.
  try {
  // @ts-ignore - puppeteer is optional and may not be installed in all environments
  const puppeteer: any = await import('puppeteer')
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()

    // Build a simple HTML table
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Reporte</h2>
          ${rows.length === 0 ? '<p>No hay datos</p>' : `
            <table>
              <thead>
                <tr>${Object.keys(rows[0]).map(k => `<th>${String(k).toUpperCase()}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${rows.map(r => `<tr>${Object.keys(rows[0]).map(k => `<td>${String(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          `}
        </body>
      </html>`

    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } })
    await browser.close()
    return outPath
  } catch (err: any) {
    console.warn('[workerUtils] Puppeteer not available or failed, falling back to pdfkit:', err?.message ?? err)
    // fallback to pdfkit
    return new Promise<string>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' })
      const stream = fs.createWriteStream(outPath)
      doc.pipe(stream)

      doc.fontSize(16).text('Reporte', { align: 'center' })
      doc.moveDown()

      if (rows.length === 0) {
        doc.fontSize(12).text('No hay datos')
        doc.end()
        stream.on('finish', () => resolve(outPath))
        stream.on('error', reject)
        return
      }

      const keys = Object.keys(rows[0])
      doc.fontSize(10)
      doc.text(keys.map((k) => String(k).toUpperCase()).join(' | '))
      doc.moveDown()

      for (const r of rows) {
        const line = keys.map((k) => (r[k] == null ? '' : String(r[k]).replace(/\n/g, ' '))).join(' | ')
        doc.fontSize(9).text(line)
      }

      doc.end()
      stream.on('finish', () => resolve(outPath))
      stream.on('error', reject)
    })
  }
}

export async function sendEmailWithAttachment(options: { to: string; subject: string; text?: string; attachments?: { filename: string; path: string }[] }) {
  const { to, subject, text = '', attachments = [] } = options

  let transporter: nodemailer.Transporter
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Boolean(process.env.SMTP_SECURE === 'true'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  } else {
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    })
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@example.com',
    to,
    subject,
    text,
    attachments: attachments.map((a) => ({ filename: a.filename, path: a.path })),
  })

  if ((nodemailer as any).getTestMessageUrl && info) {
    const url = (nodemailer as any).getTestMessageUrl(info)
    if (url) console.log('[report-worker] email preview URL:', url)
  }

  return info
}

export default { renderPdf, sendEmailWithAttachment }
