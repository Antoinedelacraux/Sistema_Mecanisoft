import fs from 'fs'
import path from 'path'

import { processReportJob } from '@/lib/reportes/processor'

jest.mock('@/lib/prisma', () => {
  const reportFileCreate = jest.fn().mockResolvedValue({ id: 1 })
  const bitacoraCreate = jest.fn().mockResolvedValue(undefined)
  return {
    prisma: {
      reportFile: { create: reportFileCreate },
      bitacora: { create: bitacoraCreate },
    },
    __mock: {
      reportFileCreate,
      bitacoraCreate,
    },
  }
})

const {
  __mock: { reportFileCreate, bitacoraCreate },
} = jest.requireMock('@/lib/prisma') as any

jest.mock('@/lib/reportes/ventasResumen', () => ({
  getVentasResumen: jest.fn().mockResolvedValue([
    { periodo: '2025-01-01', cantidad_ventas: 1, total_neto: 100, total_descuentos: 0, total_impuestos: 0 },
  ]),
}))

describe('reportes processor', () => {
  beforeEach(() => {
    reportFileCreate.mockClear()
    bitacoraCreate.mockClear()
  })

  it('generates a CSV, stores metadata, and writes file', async () => {
    const res = await processReportJob({ key: 'ventas_resumen', params: { desde: null, hasta: null }, format: 'csv' })
    expect(res).toBeDefined()
    expect(reportFileCreate).toHaveBeenCalledTimes(1)
    // Local file exists when S3 is not configured
    const generatedPath = res.outPath
    expect(typeof generatedPath).toBe('string')
    if (generatedPath && generatedPath.startsWith(path.join(process.cwd(), 'public'))) {
      expect(fs.existsSync(generatedPath)).toBe(true)
    }
  })
})
