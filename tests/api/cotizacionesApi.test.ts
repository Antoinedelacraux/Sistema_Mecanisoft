/// <reference types="jest" />

type CotizacionesRouteModule = typeof import('../../src/app/api/cotizaciones/route')
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'
import { asegurarPermiso } from '@/lib/permisos/guards'

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
    correlativoCodigo: {
      upsert: jest.fn()
    },
    $transaction: jest.fn()
  }

  return { prisma: prismaMock }
})

jest.mock('@/lib/logger', () => {
  const loggerMock: any = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn()
  }
  loggerMock.child.mockReturnValue(loggerMock)
  return { logger: loggerMock, default: loggerMock }
})

jest.mock('@/lib/redisClient', () => {
  const createRedisConnection = jest.fn(async () => ({
    on: jest.fn(),
    quit: jest.fn()
  }))
  return { createRedisConnection, default: createRedisConnection }
})

jest.mock('@/lib/permisos/guards', () => ({
  asegurarPermiso: jest.fn(),
  PermisoDenegadoError: class extends Error {},
  SesionInvalidaError: class extends Error {}
}))

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
  correlativoCodigo: { upsert: MockFn }
  $transaction: jest.Mock
}

const prismaMock = prisma as unknown as PrismaMock
const mockedGetServerSession = getServerSession as jest.Mock
const mockedAsegurarPermiso = asegurarPermiso as jest.Mock

let POST!: CotizacionesRouteModule['POST']
let GET!: CotizacionesRouteModule['GET']

jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: (body: any, init?: { status?: number; headers?: Record<string, string> }) => {
        const headers = new Map<string, string>()
        if (init?.headers) {
          Object.entries(init.headers).forEach(([key, value]) => {
            headers.set(key.toLowerCase(), value)
          })
        }

        return {
          status: init?.status ?? 200,
          headers: {
            get: (key: string) => headers.get(key.toLowerCase()) ?? null,
            set: (key: string, value: string) => headers.set(key.toLowerCase(), value)
          },
          body,
          async json() {
            return body
          }
        }
      }
    }
  }
})

beforeAll(async () => {
  const routeModule = await import('../../src/app/api/cotizaciones/route')
  POST = routeModule.POST
  GET = routeModule.GET
})

function buildRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/cotizaciones', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetServerSession.mockReset()
    mockedAsegurarPermiso.mockReset()

  prismaMock.$transaction.mockImplementation(async (cb: (tx: { cotizacion: { create: MockFn }; detalleCotizacion: { create: MockFn }; correlativoCodigo: { upsert: MockFn } }) => Promise<any>) => {
      return cb({
        cotizacion: { create: prismaMock.cotizacion.create },
        detalleCotizacion: { create: prismaMock.detalleCotizacion.create },
        correlativoCodigo: { upsert: prismaMock.correlativoCodigo.upsert }
      })
    })
    prismaMock.correlativoCodigo.upsert.mockResolvedValue({
      id_correlativo_codigo: 1,
      tipo: 'cotizacion',
      anio: new Date().getFullYear(),
      ultimo_valor: 1,
      created_at: new Date(),
      updated_at: new Date()
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

    expect(prismaMock.correlativoCodigo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tipo_anio: { tipo: 'cotizacion', anio: new Date().getFullYear() } }
    }))

    const calls = (prismaMock.detalleCotizacion.create as jest.Mock).mock.calls
    const productCall = calls.find(([args]) => args.data.id_producto === 10)
    expect(productCall).toBeDefined()
    expect(productCall?.[0].data.servicio_ref).toBe(20)

    const serviceCall = calls.find(([args]) => args.data.id_servicio === 20)
    expect(serviceCall).toBeDefined()
    expect(serviceCall?.[0].data.servicio_ref).toBeNull()
  })
})

describe('GET /api/cotizaciones', () => {
  const buildRequest = (query = ''): NextRequest => ({
    url: `http://localhost/api/cotizaciones${query}`
  } as unknown as NextRequest)

  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetServerSession.mockReset()
    mockedAsegurarPermiso.mockReset()
    mockedGetServerSession.mockResolvedValue({ user: { id: '99' } })
    mockedAsegurarPermiso.mockResolvedValue(true)
    prismaMock.cotizacion.findMany.mockResolvedValue([])
    prismaMock.cotizacion.count.mockResolvedValue(0)
  })

  it('filters solo servicios cotizaciones', async () => {
    const response = await GET(buildRequest('?modo=solo_servicios'))

    expect(response.status).toBe(200)
    const findManyArgs = prismaMock.cotizacion.findMany.mock.calls[0]?.[0]
    expect(findManyArgs?.where?.AND).toEqual([
      {
        detalle_cotizacion: {
          some: { servicio: { isNot: null } },
          every: { producto: { is: null } }
        }
      }
    ])
  })

  it('filters solo productos cotizaciones', async () => {
    const response = await GET(buildRequest('?modo=solo_productos'))

    expect(response.status).toBe(200)
    const findManyArgs = prismaMock.cotizacion.findMany.mock.calls[0]?.[0]
    expect(findManyArgs?.where?.AND).toEqual([
      {
        detalle_cotizacion: {
          some: { producto: { isNot: null } },
          every: { servicio: { is: null } }
        }
      }
    ])
  })

  it('filters mixed cotizaciones', async () => {
    const response = await GET(buildRequest('?modo=servicios_y_productos'))

    expect(response.status).toBe(200)
    const findManyArgs = prismaMock.cotizacion.findMany.mock.calls[0]?.[0]
    expect(findManyArgs?.where?.AND).toEqual([
      {
        detalle_cotizacion: {
          some: { servicio: { isNot: null } }
        }
      },
      {
        detalle_cotizacion: {
          some: { producto: { isNot: null } }
        }
      }
    ])
  })
})
