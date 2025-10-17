import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'

const repoRoot = path.resolve(__dirname, '..')
const manualDir = path.join(repoRoot, 'manuales')
const outDir = path.join(repoRoot, 'docs')
const outFile = path.join(outDir, 'manuales_combined.pdf')

const files = [
  path.join(manualDir, 'manual_instalacion.md'),
  path.join(manualDir, 'manual_docker.md')
]

const AUTHOR = 'Chumbes Espinoza Marco Antonio'

function ensureOutDir() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
}

function renderMarkdownToPDF(doc: PDFKit.PDFDocument, markdown: string) {
  const lines = markdown.split(/\r?\n/)
  let inCode = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('```')) {
      inCode = !inCode
      if (inCode) {
        doc.moveDown(0.5)
        doc.font('Courier').fontSize(9)
      } else {
        doc.font('Helvetica').fontSize(11)
        doc.moveDown(0.5)
      }
      continue
    }

    if (inCode) {
      doc.text(line, { continued: false })
      continue
    }

    if (/^#{1}\s+/.test(line)) {
      const text = line.replace(/^#{1}\s+/, '')
      doc.addPage()
      doc.font('Helvetica-Bold').fontSize(20).text(text)
      doc.moveDown(0.5)
      continue
    }

    if (/^#{2}\s+/.test(line)) {
      const text = line.replace(/^#{2}\s+/, '')
      doc.font('Helvetica-Bold').fontSize(14).text(text)
      doc.moveDown(0.3)
      continue
    }

    if (/^#{3,}\s+/.test(line)) {
      const text = line.replace(/^#{3,}\s+/, '')
      doc.font('Helvetica-Bold').fontSize(12).text(text)
      doc.moveDown(0.2)
      continue
    }

    if (/^>\s+/.test(line)) {
      const text = line.replace(/^>\s+/, '')
      doc.fillColor('gray').font('Helvetica-Oblique').fontSize(11).text(text, { indent: 10 })
      doc.fillColor('black').font('Helvetica')
      doc.moveDown(0.2)
      continue
    }

    if (line.trim() === '') {
      doc.moveDown(0.5)
      continue
    }

    // Regular paragraph
    doc.font('Helvetica').fontSize(11).text(line, {
      width: 480,
      align: 'left'
    })
  }
}

async function main() {
  ensureOutDir()

  const doc = new PDFDocument({ autoFirstPage: false, margin: 50 })
  const stream = fs.createWriteStream(outFile)
  doc.pipe(stream)

  // Title page
  doc.addPage()
  doc.font('Helvetica-Bold').fontSize(26).text('MecaniSoft - Manuales', { align: 'center' })
  doc.moveDown(1)
  doc.font('Helvetica').fontSize(14).text(`Autor: ${AUTHOR}`, { align: 'center' })
  doc.moveDown(2)
  doc.fontSize(12).text('Contenidos:', { underline: true })
  files.forEach((f) => {
    const name = path.basename(f)
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(11).text(`- ${name}`)
  })

  // Render each file
  for (const filePath of files) {
    const baseName = path.basename(filePath)
    const content = fs.readFileSync(filePath, 'utf8')

    // Insert a page header for the file
    doc.addPage()
    doc.font('Helvetica-Bold').fontSize(18).text(baseName)
    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(10).text(`Autor: ${AUTHOR}`)
    doc.moveDown(0.8)

    renderMarkdownToPDF(doc, content)
  }

  doc.end()

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', (e) => reject(e))
  })

  console.log('PDF generado en:', outFile)
}

main().catch((err) => {
  console.error('Error generando PDF:', err)
  process.exit(1)
})
