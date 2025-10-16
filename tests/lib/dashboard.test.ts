import { Prisma } from '@prisma/client'
import { formatISO } from 'date-fns'

import { getDashboardSummary, getTopProductos, getVentasPorMetodoPago, getVentasSeries } from '@/lib/dashboard'
import type { DashboardFilters } from '@/types/dashboard'

jest.mock('@/lib/prisma', () => {
  const aggregate = jest.fn()
  const transaccionFindMany = jest.fn()
  const transaccionCount = jest.fn()
  const queryRaw = jest.fn()
  const cotizacionFindMany = jest.fn()
  const cotizacionCount = jest.fn()
  const ventaFindMany = jest.fn()
  const ventaCount = jest.fn()

  return {
    prisma: {
      comprobante: {
        aggregate
      },
      transaccion: {
        findMany: transaccionFindMany,
        count: transaccionCount
      },
      $queryRaw: queryRaw,
      cotizacion: {
        findMany: cotizacionFindMany,
        count: cotizacionCount
      },
      venta: {
        findMany: ventaFindMany,
        count: ventaCount
      }
    }
  }
})

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    comprobante: { aggregate: jest.Mock }
    transaccion: { findMany: jest.Mock; count: jest.Mock }
    $queryRaw: jest.Mock
    cotizacion: { findMany: jest.Mock; count: jest.Mock }
    venta: { findMany: jest.Mock; count: jest.Mock }
  }
}

describe('Dashboard services', () => {
  const filters: DashboardFilters = {
    from: new Date('2025-01-01T00:00:00Z'),
    to: new Date('2025-01-31T23:59:59Z')
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds dashboard summary with alerts and aggregates', async () => {
    prisma.comprobante.aggregate
      .mockResolvedValueOnce({ _count: { _all: 2 }, _sum: { total: new Prisma.Decimal('1500') } })
      .mockResolvedValueOnce({ _count: { _all: 10 }, _sum: { total: new Prisma.Decimal('32000') } })
      .mockResolvedValueOnce({ _count: { _all: 8 }, _sum: { total: new Prisma.Decimal('28000') } })
      .mockResolvedValueOnce({ _count: { _all: 12 }, _sum: { total: new Prisma.Decimal('36000') } })

    prisma.transaccion.findMany.mockResolvedValueOnce([
      {
        id_transaccion: 1,
        codigo_transaccion: 'ORD-001',
        estado_orden: 'en_proceso',
        prioridad: 'alta',
        fecha: new Date('2025-01-15T10:00:00Z'),
        fecha_fin_estimada: new Date('2025-01-18T18:00:00Z'),
        persona: {
          nombre: 'Juan',
          apellido_paterno: 'Pérez',
          apellido_materno: 'Lopez'
        }
      }
    ])
    prisma.transaccion.count.mockResolvedValueOnce(3)

    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id_inventario_producto: 10,
          id_producto: 5,
          producto_nombre: 'Aceite 5W-30',
          almacen_nombre: 'Almacén Central',
          stock_disponible: new Prisma.Decimal('2'),
          stock_minimo: new Prisma.Decimal('5')
        }
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }])

    prisma.cotizacion.findMany.mockResolvedValueOnce([
      {
        id_cotizacion: 9,
        codigo_cotizacion: 'COT-009',
        vigencia_hasta: new Date('2025-01-20T00:00:00Z'),
        estado: 'pendiente',
        cliente: {
          persona: {
            nombre: 'Ana',
            apellido_paterno: 'Rojas',
            apellido_materno: 'Diaz'
          }
        }
      }
    ])
    prisma.cotizacion.count.mockResolvedValueOnce(2)

    prisma.venta.findMany.mockResolvedValueOnce([
      {
        id_venta: 4,
        fecha: new Date('2024-12-28T15:00:00Z'),
        total: new Prisma.Decimal('1800'),
        saldo: new Prisma.Decimal('900'),
        estado_pago: 'pendiente',
        comprobante: {
          serie: 'F001',
          numero: '000123'
        }
      }
    ])
    prisma.venta.count.mockResolvedValueOnce(2)

    const summary = await getDashboardSummary(filters)

    expect(summary.ventasHoy).toEqual({ total: 1500, comprobantes: 2 })
    expect(summary.ventasMes.total).toBe(32000)
    expect(summary.ventasMes.deltaPorcentaje).toBeCloseTo(((32000 - 28000) / 28000) * 100)
    expect(summary.ticketPromedio).toBeCloseTo(36000 / 12)
    expect(summary.ordenesPendientes.total).toBe(3)
    expect(summary.stockBajo.items).toHaveLength(1)
    expect(summary.cotizacionesVencidas.total).toBe(2)
    expect(summary.pagosPendientes.total).toBe(2)
    expect(summary.alerts).toHaveLength(4)
  })

  it('returns ventas series grouped by day', async () => {
    const rawRows = [
      {
        periodo: new Date('2025-01-01T00:00:00Z'),
        total: new Prisma.Decimal('1500')
      },
      {
        periodo: new Date('2025-01-02T00:00:00Z'),
        total: new Prisma.Decimal('1800')
      }
    ]

    prisma.$queryRaw.mockResolvedValueOnce(rawRows)

    const series = await getVentasSeries(filters, 'day')

    const expected = rawRows.map((row) => ({
      label: formatISO(row.periodo, { representation: 'date' }),
      date: expect.any(String),
      total: Number(row.total.toString())
    }))

    expect(series).toEqual(expected)
  })

  it('returns top productos respecting limit', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id_producto: 1,
        nombre_producto: 'Filtro de aceite',
        cantidad_total: new Prisma.Decimal('12'),
        total_vendido: new Prisma.Decimal('600')
      },
      {
        id_producto: 2,
        nombre_producto: 'Pastillas de freno',
        cantidad_total: new Prisma.Decimal('8'),
        total_vendido: new Prisma.Decimal('720')
      }
    ])

    const top = await getTopProductos(filters, 5)

    expect(top).toEqual([
      {
        idProducto: 1,
        nombreProducto: 'Filtro de aceite',
        cantidad: 12,
        total: 600
      },
      {
        idProducto: 2,
        nombreProducto: 'Pastillas de freno',
        cantidad: 8,
        total: 720
      }
    ])
  })

  it('returns ventas agrupadas por método de pago', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        metodo: 'EFECTIVO',
        total: new Prisma.Decimal('2500')
      },
      {
        metodo: 'TARJETA',
        total: new Prisma.Decimal('1750')
      }
    ])

    const metodos = await getVentasPorMetodoPago(filters)

    expect(metodos).toEqual([
      {
        metodo: 'EFECTIVO',
        total: 2500
      },
      {
        metodo: 'TARJETA',
        total: 1750
      }
    ])
  })
})
