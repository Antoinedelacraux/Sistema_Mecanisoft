import { TipoComprobante, Prisma } from '@prisma/client'
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js'
import path from 'path'
import { promises as fs, createWriteStream } from 'fs'

export const PDF_RELATIVE_DIR = path.join('uploads', 'comprobantes')
export const PDF_HEADER_COLOR = '#0f172a'
export const PDF_HEADER_TEXT = '#f9fafb'
export const PDF_BODY_TEXT = '#111827'
export const PDF_MUTED_TEXT = '#6b7280'

export type PdfStoragePathInfo = {
  yearFolder: string
  monthFolder: string
  relativeDirectory: string
  absoluteDirectory: string
  fileName: string
  relativePath: string
  normalizedRelative: string
  absolutePath: string
}

type BuildPdfStoragePathsParams = {
  fechaEmision: Date
  tipo: TipoComprobante
  serie: string
  numero: number
  timestamp?: number
  publicRoot?: string
}

export const padNumero = (numero: number) => String(numero ?? 0).padStart(8, '0')

export const normalizeStoredPath = (storedPath: string) => {
  const prefixed = storedPath.startsWith('/') ? storedPath : `/${storedPath}`
  return prefixed.replace(/\\/g, '/')
}

export const toFsRelativePath = (storedPath: string) => {
  const normalized = storedPath.startsWith('/') ? storedPath.slice(1) : storedPath
  return normalized.replace(/\\/g, '/')
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value ?? 0)

export const formatQuantity = (value: number) =>
  new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(value ?? 0)

export const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  return Number(value)
}

const ensureDirectoryExists = async (directory: string) => {
  await fs.mkdir(directory, { recursive: true })
}

export const buildPdfStoragePaths = ({
  fechaEmision,
  tipo,
  serie,
  numero,
  timestamp = Date.now(),
  publicRoot
}: BuildPdfStoragePathsParams): PdfStoragePathInfo => {
  const yearFolder = String(fechaEmision.getFullYear())
  const monthFolder = String(fechaEmision.getMonth() + 1).padStart(2, '0')
  const relativeDirectory = path.join(PDF_RELATIVE_DIR, yearFolder, monthFolder)

  const fileName = `comprobante_${tipo.toLowerCase()}_${serie}_${padNumero(numero)}_${timestamp}.pdf`
  const relativePath = path.join(relativeDirectory, fileName)
  const normalizedRelative = normalizeStoredPath(relativePath)

  const effectivePublicRoot = publicRoot ?? path.resolve(process.cwd(), 'public')
  const absoluteDirectory = path.resolve(effectivePublicRoot, toFsRelativePath(relativeDirectory))
  const absolutePath = path.resolve(effectivePublicRoot, toFsRelativePath(relativePath))

  return {
    yearFolder,
    monthFolder,
    relativeDirectory,
    absoluteDirectory,
    fileName,
    relativePath,
    normalizedRelative,
    absolutePath
  }
}

export type PdfDetalleSource = {
  descripcion?: string | null
  producto?: { nombre?: string | null } | null
  servicio?: { nombre?: string | null } | null
  cantidad: Prisma.Decimal | number | null
  precio_unitario: Prisma.Decimal | number | null
  total: Prisma.Decimal | number | null
}

export type PdfComprobanteSource = {
  tipo: TipoComprobante
  serie: string
  numero: number
  fecha_emision: Date | null
  empresa?: { razon_social?: string | null; ruc?: string | null; direccion_fiscal?: string | null } | null
  creado_por_usuario: {
    persona?: {
      nombre?: string | null
      apellido_paterno?: string | null
      apellido_materno?: string | null
      nombre_comercial?: string | null
    } | null
  }
  receptor_nombre: string
  receptor_documento: string
  receptor_direccion?: string | null
  descripcion?: string | null
  notas?: string | null
  detalles: PdfDetalleSource[]
  subtotal: Prisma.Decimal | number | null
  igv: Prisma.Decimal | number | null
  total: Prisma.Decimal | number | null
  moneda: string
  precios_incluyen_igv: boolean
  pdf_url?: string | null
}

export async function generarPdfComprobante(comprobante: PdfComprobanteSource): Promise<string | null> {
  try {
    if (comprobante.pdf_url) {
      const normalizedExisting = normalizeStoredPath(comprobante.pdf_url)
      const existingAbsolute = path.resolve(process.cwd(), 'public', toFsRelativePath(normalizedExisting))
      try {
        await fs.access(existingAbsolute)
        return normalizedExisting
      } catch {
        // El archivo anterior no existe, continuamos para regenerarlo.
      }
    }

    const numeroFormateado = `${comprobante.serie}-${padNumero(comprobante.numero)}`
    const tipoLegible = comprobante.tipo === 'FACTURA' ? 'Factura' : 'Boleta'
    const fechaEmision = comprobante.fecha_emision ?? new Date()

    const { absoluteDirectory, normalizedRelative, absolutePath } = buildPdfStoragePaths({
      fechaEmision,
      tipo: comprobante.tipo,
      serie: comprobante.serie,
      numero: comprobante.numero
    })

    await ensureDirectoryExists(absoluteDirectory)

    const emisorNombre =
      (
        comprobante.empresa?.razon_social ??
        comprobante.creado_por_usuario.persona?.nombre_comercial ??
        [
          comprobante.creado_por_usuario.persona?.nombre,
          comprobante.creado_por_usuario.persona?.apellido_paterno,
          comprobante.creado_por_usuario.persona?.apellido_materno
        ]
          .filter(Boolean)
          .join(' ')
      ) || 'Taller mecánico'

    const emisorRuc = comprobante.empresa?.ruc
    const emisorDireccion = comprobante.empresa?.direccion_fiscal

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
    doc.info.Title = `${tipoLegible} ${numeroFormateado}`
    doc.info.Author = emisorNombre

    const renderHeader = () => {
      const { width, margins } = doc.page
      const headerHeight = 80

      doc.save()
      doc.rect(0, 0, doc.page.width, headerHeight).fill(PDF_HEADER_COLOR)
      doc.fillColor(PDF_HEADER_TEXT).font('Helvetica-Bold').fontSize(16)
      doc.text(emisorNombre, margins.left, 24, {
        width: width - margins.left - margins.right,
        align: 'left'
      })

      doc.font('Helvetica').fontSize(10)
      if (emisorRuc) {
        doc.text(`RUC: ${emisorRuc}`, { width: width - margins.left - margins.right })
      }
      if (emisorDireccion) {
        doc.text(emisorDireccion, {
          width: width - margins.left - margins.right
        })
      }

      doc.font('Helvetica-Bold').fontSize(14)
      doc.text(`${tipoLegible.toUpperCase()} ${numeroFormateado}`, margins.left, 24, {
        width: width - margins.left - margins.right,
        align: 'right'
      })
      doc.font('Helvetica').fontSize(10)
      doc.text(`Fecha de emisión: ${formatDateTime(fechaEmision)}`, {
        width: width - margins.left - margins.right,
        align: 'right'
      })
      doc.restore()

      doc.y = Math.max(doc.y, headerHeight + 24)
      doc.moveDown(0.5)
      doc.font('Helvetica').fontSize(11).fillColor(PDF_BODY_TEXT)
    }

    const renderFooterForPage = (pageIndex: number) => {
      const range = doc.bufferedPageRange()
      const absoluteIndex = range.start + pageIndex
      doc.switchToPage(absoluteIndex)
      const { width, height, margins } = doc.page
      const footerY = height - margins.bottom + 15
      doc.save()
      doc.font('Helvetica').fontSize(9).fillColor(PDF_MUTED_TEXT)
      doc.text(`Página ${pageIndex + 1}`, margins.left, footerY, {
        width: width - margins.left - margins.right,
        align: 'right'
      })
      doc.restore()
    }

    doc.on('pageAdded', () => {
      renderHeader()
    })

    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(absolutePath)
      stream.on('finish', () => resolve())
      stream.on('error', reject)
      doc.on('error', reject)

      doc.pipe(stream)

      renderHeader()

      doc.font('Helvetica-Bold').fontSize(18).text(`${tipoLegible.toUpperCase()} ${numeroFormateado}`, {
        align: 'center'
      })
      doc.moveDown(1.5)

      doc.font('Helvetica-Bold').fontSize(12).text('Emisor', { underline: true })
      doc.font('Helvetica').fontSize(11).fillColor('black')
      doc.text(emisorNombre)
      if (emisorRuc) {
        doc.text(`RUC: ${emisorRuc}`)
      }
      if (emisorDireccion) {
        doc.text(emisorDireccion)
      }
      doc.text(`Fecha de emisión: ${formatDateTime(fechaEmision)}`)
      doc.moveDown()

      doc.font('Helvetica-Bold').fontSize(12).text('Cliente', { underline: true })
      doc.font('Helvetica').fontSize(11)
      doc.text(comprobante.receptor_nombre)
      doc.text(`Documento: ${comprobante.receptor_documento}`)
      if (comprobante.receptor_direccion) {
        doc.text(comprobante.receptor_direccion)
      }
      doc.moveDown()

      if (comprobante.descripcion) {
        doc.font('Helvetica-Bold').fontSize(12).text('Descripción')
        doc.font('Helvetica').fontSize(11).text(comprobante.descripcion)
        doc.moveDown()
      }

      doc.font('Helvetica-Bold').fontSize(12).text('Detalle del comprobante', {
        underline: true
      })
      doc.moveDown(0.5)

      doc.font('Helvetica-Bold').fontSize(10)
      const headerY = doc.y
      doc.text('Descripción', 50, headerY, { width: 250 })
      doc.text('Cant.', 310, headerY, { width: 60, align: 'right' })
      doc.text('P. Unit', 370, headerY, { width: 80, align: 'right' })
      doc.text('Total', 460, headerY, { width: 80, align: 'right' })
      doc.moveDown(0.4)
      doc.moveTo(50, doc.y).lineTo(540, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke()
      doc.moveDown(0.4)

      doc.font('Helvetica').fontSize(10).fillColor('black')

      if (comprobante.detalles.length === 0) {
        doc.text('No hay detalles registrados para este comprobante.', 50, doc.y)
        doc.moveDown()
      } else {
        for (const detalle of comprobante.detalles) {
          const descripcion =
            detalle.descripcion ??
            detalle.producto?.nombre ??
            detalle.servicio?.nombre ??
            'Ítem'
          const cantidad = decimalToNumber(detalle.cantidad)
          const precioUnitario = decimalToNumber(detalle.precio_unitario)
          const totalLinea = decimalToNumber(detalle.total)

          const y = doc.y
          doc.text(descripcion, 50, y, { width: 250 })
          doc.text(formatQuantity(cantidad), 310, y, { width: 60, align: 'right' })
          doc.text(formatCurrency(precioUnitario), 370, y, { width: 80, align: 'right' })
          doc.text(formatCurrency(totalLinea), 460, y, { width: 80, align: 'right' })
          doc.moveDown(0.6)
        }
      }

      doc.moveDown(0.5)
      doc.moveTo(340, doc.y).lineTo(540, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke()
      doc.moveDown(0.6)

      const subtotal = decimalToNumber(comprobante.subtotal)
      const igv = decimalToNumber(comprobante.igv)
      const total = decimalToNumber(comprobante.total)
      const igvRate = subtotal > 0 ? (igv / subtotal) * 100 : 0

      const resumenY = doc.y
      doc.font('Helvetica-Bold').fontSize(11)
      doc.text('Subtotal:', 340, resumenY, { width: 80, align: 'right' })
      doc.font('Helvetica').fontSize(11).text(formatCurrency(subtotal), 420, resumenY, {
        width: 120,
        align: 'right'
      })

      const igvY = doc.y + 8
      doc.font('Helvetica-Bold').fontSize(11).text('IGV:', 340, igvY, { width: 80, align: 'right' })
      doc.font('Helvetica').fontSize(11).text(formatCurrency(igv), 420, igvY, {
        width: 120,
        align: 'right'
      })

      const totalY = igvY + 16
      doc.font('Helvetica-Bold').fontSize(12).text('Total:', 340, totalY, { width: 80, align: 'right' })
      doc.font('Helvetica').fontSize(12).text(formatCurrency(total), 420, totalY, {
        width: 120,
        align: 'right'
      })

      doc.font('Helvetica').fontSize(10).fillColor(PDF_MUTED_TEXT)
      doc.text(
        `Moneda: ${comprobante.moneda} • IGV ${igvRate.toFixed(1)}% • ${
          comprobante.precios_incluyen_igv ? 'Precios incluyen IGV' : 'Precios no incluyen IGV'
        }`,
        50,
        totalY + 24,
        {
          width: 300
        }
      )
      doc.fillColor(PDF_BODY_TEXT)

      if (comprobante.notas) {
        doc.moveDown(2)
        doc.font('Helvetica-Bold').fontSize(12).text('Notas')
        doc.font('Helvetica').fontSize(11).text(comprobante.notas)
      }

      doc.moveDown(2)
      doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text(
        'Documento generado automáticamente por el sistema del taller mecánico.',
        {
          width: 500,
          align: 'left'
        }
      )

      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        renderFooterForPage(i)
      }
      doc.switchToPage(range.start + range.count - 1)

      doc.end()
    })

    return normalizedRelative
  } catch (error) {
    console.error('Error generando PDF del comprobante:', error)
    return null
  }
}
