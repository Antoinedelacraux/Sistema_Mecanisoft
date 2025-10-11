import path from 'path'
import { buildPdfStoragePaths } from '@/lib/facturacion/pdf'
import { TipoComprobante } from '@prisma/client'

describe('buildPdfStoragePaths', () => {
  const fecha = new Date('2025-10-09T12:34:56Z')
  const publicRoot = path.join(process.cwd(), '__tests__', 'public')

  it('genera rutas dentro de la carpeta pública organizadas por año y mes', () => {
    const info = buildPdfStoragePaths({
      fechaEmision: fecha,
      tipo: TipoComprobante.FACTURA,
      serie: 'F001',
      numero: 123,
      timestamp: 170,
      publicRoot
    })

    const expectedDirectory = path.join('uploads', 'comprobantes', '2025', '10')

    expect(info.yearFolder).toBe('2025')
    expect(info.monthFolder).toBe('10')
    expect(info.relativeDirectory.replace(/\\/g, '/')).toBe(expectedDirectory.replace(/\\/g, '/'))
    expect(info.fileName).toBe('comprobante_factura_F001_00000123_170.pdf')
    expect(info.normalizedRelative).toBe('/uploads/comprobantes/2025/10/comprobante_factura_F001_00000123_170.pdf')
    expect(info.absoluteDirectory.replace(/\\/g, '/')).toContain(expectedDirectory.replace(/\\/g, '/'))
    expect(info.absolutePath.replace(/\\/g, '/')).toContain('comprobante_factura_F001_00000123_170.pdf')
  })

  it('usa la fecha actual cuando no se proporciona timestamp', () => {
    const info = buildPdfStoragePaths({
      fechaEmision: fecha,
      tipo: TipoComprobante.BOLETA,
      serie: 'B001',
      numero: 1,
      publicRoot
    })

    expect(info.fileName.startsWith('comprobante_boleta_B001_00000001_')).toBe(true)
  })
})
