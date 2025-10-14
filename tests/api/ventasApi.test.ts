import type { NextRequest } from 'next/server'
import { GET as getVentas } from '@/app/api/ventas/route'
import { GET as getResumen } from '@/app/api/ventas/resumen/route'
import { POST as postPago } from '@/app/api/ventas/pagos/route'
import { getServerSession } from 'next-auth/next'
import { asegurarPermiso } from '@/lib/permisos/guards'
import { listarVentas } from '@/app/api/ventas/controllers/listar-ventas'
import { obtenerResumenVentas } from '@/app/api/ventas/controllers/resumen-ventas'
import { registrarPagoVenta } from '@/app/api/ventas/controllers/registrar-pago'
import type { VentasResponse, ResumenVentas } from '@/types/ventas'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      async json() {
        return body
      }
    })
  }
}))

jest.mock('@/lib/permisos/guards', () => {
  const actual = jest.requireActual('@/lib/permisos/guards')
  return {
    ...actual,
    asegurarPermiso: jest.fn()
  }
})

jest.mock('@/lib/prisma', () => ({
  prisma: {}
}))

jest.mock('@/app/api/ventas/controllers/listar-ventas', () => ({
  listarVentas: jest.fn()
}))

jest.mock('@/app/api/ventas/controllers/resumen-ventas', () => ({
  obtenerResumenVentas: jest.fn()
}))

jest.mock('@/app/api/ventas/controllers/registrar-pago', () => ({
  registrarPagoVenta: jest.fn()
}))

describe('API Ventas', () => {
  const mockedSession = { user: { id: '10', permisos: ['facturacion.ver', 'ventas.conciliar'] } }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  const createRequest = (url: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }) => {
    const parsedUrl = new URL(url)
    const body = init?.body
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers ?? {})

    return {
      nextUrl: parsedUrl,
      method,
      headers,
      async json() {
        return typeof body === 'string' ? JSON.parse(body) : body ?? {}
      }
    } as unknown as NextRequest
  }

  describe('GET /api/ventas', () => {
    it('retorna listado paginado', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockedSession)
      ;(asegurarPermiso as jest.Mock).mockResolvedValue(undefined)

      const listado: VentasResponse = {
        ventas: [
          {
            id_venta: 1,
            fecha: '2025-10-01T10:00:00.000Z',
            total: 1500,
            total_pagado: 500,
            saldo: 1000,
            estado_pago: 'parcial',
            metodo_principal: 'EFECTIVO',
            comprobante: {
              id_comprobante: 20,
              serie: 'F001',
              numero: 123,
              codigo: 'OT-2025-001',
              estado: 'EMITIDO',
              tipo: 'FACTURA',
              receptor_nombre: 'Cliente Demo',
              receptor_documento: '20123456789',
              origen_tipo: 'ORDEN',
              origen_id: 5,
              fecha_emision: '2025-10-01T10:00:00.000Z',
              total: 1500,
              estado_pago: 'parcial',
              descripcion: 'Servicio general'
            },
            pagos: [],
            items: 3
          }
        ],
        pagination: {
          total: 1,
          pages: 1,
          current: 1,
          limit: 10
        }
      }

      ;(listarVentas as jest.Mock).mockResolvedValue(listado)

  const request = createRequest('http://localhost/api/ventas?page=1&limit=10')
      const response = await getVentas(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.ventas).toHaveLength(1)
      expect(json.pagination.total).toBe(1)
      expect(listarVentas).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 }),
        expect.anything()
      )
    })
  })

  describe('GET /api/ventas/resumen', () => {
    it('devuelve métricas agregadas', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockedSession)
      ;(asegurarPermiso as jest.Mock).mockResolvedValue(undefined)

      const resumen: ResumenVentas = {
        totalVentas: 2500,
        numeroComprobantes: 4,
        promedio: 625,
        porMetodo: {
          EFECTIVO: 1000,
          TARJETA: 800,
          APP_MOVIL: 400,
          TRANSFERENCIA: 200,
          OTRO: 100,
          SIN_REGISTRO: 0
        },
        porEstadoPago: {
          pendiente: 1,
          parcial: 2,
          pagado: 1
        }
      }

      ;(obtenerResumenVentas as jest.Mock).mockResolvedValue(resumen)

  const request = createRequest('http://localhost/api/ventas/resumen?fecha_desde=2025-10-01&fecha_hasta=2025-10-31')
      const response = await getResumen(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.totalVentas).toBe(2500)
      expect(json.numeroComprobantes).toBe(4)
      expect(obtenerResumenVentas).toHaveBeenCalledWith(
        expect.objectContaining({ fechaDesde: expect.any(Date), fechaHasta: expect.any(Date) }),
        expect.anything()
      )
    })
  })

  describe('POST /api/ventas/pagos', () => {
    it('registra un pago válido', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockedSession)
      ;(asegurarPermiso as jest.Mock).mockResolvedValue(undefined)

      ;(registrarPagoVenta as jest.Mock).mockResolvedValue({
        venta: {
          id_venta: 1,
          total: 1500,
          total_pagado: 1500,
          saldo: 0,
          estado_pago: 'pagado',
          metodo_principal: 'EFECTIVO',
          pagos: []
        },
        comprobante_estado_pago: 'pagado'
      })

      const body = {
        id_comprobante: 20,
        metodo: 'EFECTIVO',
        monto: 1500,
        fecha_pago: '2025-10-14T10:00:00.000Z'
      }

      const request = createRequest('http://localhost/api/ventas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const response = await postPago(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.venta.estado_pago).toBe('pagado')
      expect(registrarPagoVenta).toHaveBeenCalledWith(
        expect.objectContaining({ id_comprobante: 20, metodo: 'EFECTIVO' }),
        10,
        expect.anything()
      )
    })

    it('responde 400 con datos inválidos', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockedSession)
      ;(asegurarPermiso as jest.Mock).mockResolvedValue(undefined)

      const request = createRequest('http://localhost/api/ventas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const response = await postPago(request)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe('Datos inválidos')
      expect(registrarPagoVenta).not.toHaveBeenCalled()
    })
  })
})
