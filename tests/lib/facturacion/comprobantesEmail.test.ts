import { TipoComprobante, EstadoComprobante } from '@prisma/client'
import { enviarComprobantePorCorreo } from '@/lib/facturacion/comprobantes'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { generarPdfComprobante } from '@/lib/facturacion/pdf'

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    comprobante: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    comprobanteBitacora: {
      create: jest.fn()
    }
  }

  return { prisma: prismaMock }
})

jest.mock('@/lib/mailer', () => ({
  sendMail: jest.fn()
}))

jest.mock('@/lib/facturacion/pdf', () => {
  const actual = jest.requireActual('@/lib/facturacion/pdf') as typeof import('@/lib/facturacion/pdf')
  return {
    ...actual,
    generarPdfComprobante: jest.fn()
  }
})

type AsyncMock<TValue = unknown> = jest.Mock<Promise<TValue>, [unknown]>

const prismaMock = prisma as unknown as {
  comprobante: {
    findUnique: AsyncMock
    update: AsyncMock
  }
  comprobanteBitacora: {
    create: AsyncMock
  }
}

const sendMailMock = sendMail as unknown as AsyncMock<void>
const generarPdfMock = generarPdfComprobante as unknown as AsyncMock<string | null>

describe('enviarComprobantePorCorreo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('envía el correo usando el PDF generado y registra la bitácora', async () => {
    const comprobanteId = 99
    const fecha = new Date('2025-10-09T12:00:00Z')

    const baseComprobante = {
      id_comprobante: comprobanteId,
      estado: EstadoComprobante.EMITIDO,
      tipo: TipoComprobante.FACTURA,
      serie: 'F001',
      numero: 7,
      total: 150,
      subtotal: 127.12,
      igv: 22.88,
      moneda: 'PEN',
      precios_incluyen_igv: true,
      receptor_nombre: 'Carlos Cliente',
      receptor_documento: '12345678',
      receptor_direccion: 'Av. Siempre Viva 742',
      descripcion: 'Servicio completo',
      notas: 'Gracias por su preferencia',
      fecha_emision: fecha,
      pdf_url: null,
      persona: {
        correo: 'cliente@example.com'
      },
      creado_por_usuario: {
        persona: {
          nombre: 'Admin',
          apellido_paterno: 'Lopez',
          apellido_materno: 'Ramirez',
          nombre_comercial: null
        }
      },
      empresa: {
        razon_social: 'Taller SAC',
        ruc: '12345678901',
        direccion_fiscal: 'Av. Principal 123'
      },
      detalles: [],
      bitacoras: [],
      serie_rel: null,
      cliente: {
        persona: {
          empresa_persona: []
        }
      },
      cotizacion: null,
      transaccion: null,
      creado_por: 1,
      actualizado_por: 1,
      actualizado_por_usuario: {
        persona: null
      }
    }

    const serializedComprobante = {
      ...baseComprobante,
      pdf_url: 'https://example.com/comprobante.pdf'
    }

    prismaMock.comprobante.findUnique
      .mockResolvedValueOnce({ ...baseComprobante })
      .mockResolvedValueOnce({ ...serializedComprobante, detalles: [], bitacoras: [] })

    prismaMock.comprobante.update.mockResolvedValue(undefined)
    prismaMock.comprobanteBitacora.create.mockResolvedValue(undefined)

    generarPdfMock.mockResolvedValue('https://example.com/comprobante.pdf')
    sendMailMock.mockResolvedValue(undefined)

    const result = await enviarComprobantePorCorreo({
      comprobanteId,
      usuarioId: 55,
      destinatario: undefined,
      mensaje: undefined
    })

    expect(generarPdfMock).toHaveBeenCalledWith(expect.objectContaining({ id_comprobante: comprobanteId }))
    expect(prismaMock.comprobante.update).toHaveBeenCalledWith({
      where: { id_comprobante: comprobanteId },
      data: { pdf_url: 'https://example.com/comprobante.pdf' }
    })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@example.com',
        subject: expect.stringContaining('F001-00000007'),
        attachments: []
      })
    )

    expect(prismaMock.comprobanteBitacora.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id_comprobante: comprobanteId,
          accion: 'ENVIAR_CORREO',
          metadata: expect.objectContaining({ destinatario: 'cliente@example.com' })
        })
      })
    )

    expect(result.pdf_url).toBe('https://example.com/comprobante.pdf')
  })
})
