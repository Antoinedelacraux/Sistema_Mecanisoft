/// <reference types="jest" />

import { POST } from '../../src/app/api/cotizaciones/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    cotizacion: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn()
    },
    cliente: {
      findUnique: jest.fn()
    },
    vehiculo: {
      findUnique: jest.fn()
    },
    producto: {
      findMany: jest.fn()
    },
    servicio: {
      findMany: jest.fn()
    },
    detalleCotizacion: {
      create: jest.fn()
    },
    bitacora: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  }

  return { prisma: prismaMock }
})

type MockFn = jest.Mock<any, any>

type PrismaMock = {
  cotizacion: {
    findMany: MockFn
    count: MockFn
    findFirst: MockFn
    findUnique: MockFn
    create: MockFn
  }
  cliente: { findUnique: MockFn }
  vehiculo: { findUnique: MockFn }
  producto: { findMany: MockFn }
  servicio: { findMany: MockFn }
  detalleCotizacion: { create: MockFn }
  bitacora: { create: MockFn }
  $transaction: jest.Mock
}

const prismaMock = prisma as unknown as PrismaMock
const mockedGetServerSession = getServerSession as jest.Mock

function buildRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/cotizaciones', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetServerSession.mockReset()

    prismaMock.$transaction.mockImplementation(async (cb: (tx: { cotizacion: { create: MockFn }; detalleCotizacion: { create: MockFn } }) => Promise<any>) => {
      return cb({
        cotizacion: { create: prismaMock.cotizacion.create },
        detalleCotizacion: { create: prismaMock.detalleCotizacion.create }
      })
    })
  })

  it('returns 401 when session is missing', async () => {
    mockedGetServerSession.mockResolvedValueOnce(null)

    const res = await POST(buildRequest({}))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'No autorizado' })
  })

  it('rejects product associated to a service that is not included', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: '12' } })

    prismaMock.cliente.findUnique.mockResolvedValue({
      estatus: true,
      persona: { nombre: 'Juan', apellido_paterno: 'Pérez' }
    })

    prismaMock.vehiculo.findUnique.mockResolvedValue({ id_cliente: 3 })

    prismaMock.producto.findMany.mockResolvedValue([
      { id_producto: 10, estatus: true }
    ])

    prismaMock.servicio.findMany.mockResolvedValue([
      { id_servicio: 20, estatus: true }
    ])

    const res = await POST(buildRequest({
      id_cliente: 3,
      id_vehiculo: 5,
      modo_cotizacion: 'servicios_y_productos',
      items: [
        {
          id_producto: 10,
          cantidad: 1,
          precio_unitario: 100,
          descuento: 0,
          servicio_ref: 20,
          tipo: 'producto'
        }
      ]
    }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'El servicio asociado a un producto debe estar incluido en la cotización.'
    })
    expect(prismaMock.cotizacion.create).not.toHaveBeenCalled()
  })

  it('rejects when more than one product references the same service', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: '44' } })

    prismaMock.cliente.findUnique.mockResolvedValue({
      estatus: true,
      persona: { nombre: 'Ana', apellido_paterno: 'Ruiz' }
    })

    prismaMock.vehiculo.findUnique.mockResolvedValue({ id_cliente: 8 })

    prismaMock.producto.findMany.mockResolvedValue([
      { id_producto: 10, estatus: true },
      { id_producto: 11, estatus: true }
    ])

    prismaMock.servicio.findMany.mockResolvedValue([
      { id_servicio: 20, estatus: true }
    ])

    const res = await POST(buildRequest({
      id_cliente: 8,
      id_vehiculo: 9,
      modo_cotizacion: 'servicios_y_productos',
      items: [
        {
          id_producto: 10,
          cantidad: 1,
          precio_unitario: 50,
          descuento: 0,
          servicio_ref: 20,
          tipo: 'producto'
        },
        {
          id_producto: 11,
          cantidad: 1,
          precio_unitario: 30,
          descuento: 0,
          servicio_ref: 20,
          tipo: 'producto'
        },
        {
          id_producto: 20,
          cantidad: 1,
          precio_unitario: 20,
          descuento: 0,
          tipo: 'servicio'
        }
      ]
    }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Cada servicio solo puede tener un producto asociado.'
    })
    expect(prismaMock.cotizacion.create).not.toHaveBeenCalled()
  })

  it('creates the cotizacion with product-service association when data is valid', async () => {
    mockedGetServerSession.mockResolvedValue({ user: { id: '100' } })

    prismaMock.cliente.findUnique.mockResolvedValue({
      estatus: true,
      persona: { nombre: 'Mario', apellido_paterno: 'Lopez' }
    })

    prismaMock.vehiculo.findUnique.mockResolvedValue({ id_cliente: 15 })

    prismaMock.producto.findMany.mockResolvedValue([
      { id_producto: 10, estatus: true }
    ])

    prismaMock.servicio.findMany.mockResolvedValue([
      { id_servicio: 20, estatus: true }
    ])

    prismaMock.cotizacion.findFirst.mockResolvedValue(null)

    prismaMock.detalleCotizacion.create.mockResolvedValue({})
    prismaMock.cotizacion.create.mockResolvedValue({ id_cotizacion: 1, codigo_cotizacion: 'COT-2024-001' })
    prismaMock.bitacora.create.mockResolvedValue({})

    prismaMock.cotizacion.findUnique.mockResolvedValue({
      id_cotizacion: 1,
      codigo_cotizacion: 'COT-2024-001',
      detalle_cotizacion: []
    })

    const res = await POST(buildRequest({
      id_cliente: 15,
      id_vehiculo: 7,
      modo_cotizacion: 'servicios_y_productos',
      items: [
        {
          id_producto: 20,
          cantidad: 1,
          precio_unitario: 200,
          descuento: 0,
          tipo: 'servicio'
        },
        {
          id_producto: 10,
          cantidad: 2,
          precio_unitario: 50,
          descuento: 0,
          servicio_ref: 20,
          tipo: 'producto'
        }
      ]
    }))

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({
      id_cotizacion: 1,
      codigo_cotizacion: 'COT-2024-001',
      detalle_cotizacion: []
    })

    const calls = (prismaMock.detalleCotizacion.create as jest.Mock).mock.calls
    const productCall = calls.find(([args]) => args.data.id_producto === 10)
    expect(productCall).toBeDefined()
    expect(productCall?.[0].data.servicio_ref).toBe(20)

    const serviceCall = calls.find(([args]) => args.data.id_servicio === 20)
    expect(serviceCall).toBeDefined()
    expect(serviceCall?.[0].data.servicio_ref).toBeNull()
  })
})
