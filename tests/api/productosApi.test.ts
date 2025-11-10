/// <reference types="jest" />

import { GET, POST } from '@/app/api/productos/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

type MockFn = jest.Mock<any, any>

type PrismaMock = {
  producto: {
    findMany: MockFn
    count: MockFn
    findFirst: MockFn
    create: MockFn
    findUnique: MockFn
  }
  categoria: {
    findUnique: MockFn
  }
  fabricante: {
    findUnique: MockFn
  }
  unidadMedida: {
    findUnique: MockFn
  }
  bitacora: {
    create: MockFn
  }
  correlativoCodigo: {
    upsert: MockFn
  }
  $transaction: jest.Mock
}

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    producto: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn()
    },
    categoria: {
      findUnique: jest.fn()
    },
    fabricante: {
      findUnique: jest.fn()
    },
    unidadMedida: {
      findUnique: jest.fn()
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

const prismaMock = prisma as unknown as PrismaMock
const mockedGetServerSession = getServerSession as jest.Mock

const buildRequest = (query = ''): NextRequest => ({
  url: `http://localhost/api/productos${query}`
} as unknown as NextRequest)

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      async json() {
        return body
      }
    })
  }
}))

describe('GET /api/productos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } })
    prismaMock.producto.findMany.mockResolvedValue([])
    prismaMock.producto.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(async (cb: (client: PrismaMock) => any) => cb(prismaMock))
  })

  it('devuelve solo productos activos por defecto', async () => {
    const response = await GET(buildRequest())

    expect(response.status).toBe(200)
    const findArgs = prismaMock.producto.findMany.mock.calls[0]?.[0]
    expect(findArgs?.where).toMatchObject({ tipo: 'producto', estatus: true })
  })

  it('devuelve todos los productos cuando include_inactive=true', async () => {
    const response = await GET(buildRequest('?include_inactive=true'))

    expect(response.status).toBe(200)
    const findArgs = prismaMock.producto.findMany.mock.calls[0]?.[0]
    expect(findArgs?.where).toEqual({ tipo: 'producto' })
  })

  it('filtra productos inactivos cuando estatus=inactivos', async () => {
    const response = await GET(buildRequest('?estatus=inactivos'))

    expect(response.status).toBe(200)
    const findArgs = prismaMock.producto.findMany.mock.calls[0]?.[0]
    expect(findArgs?.where).toMatchObject({ tipo: 'producto', estatus: false })
  })
})

describe('POST /api/productos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } })
    prismaMock.producto.findFirst.mockResolvedValue(null)
    prismaMock.producto.create.mockResolvedValue({
      id_producto: 1,
      codigo_producto: 'PROD-2024-001',
      nombre: 'Producto de prueba',
      tipo: 'producto',
      estatus: true
    })
    prismaMock.categoria.findUnique.mockResolvedValue({ id_categoria: 1, nombre: 'Categoria 1' })
    prismaMock.fabricante.findUnique.mockResolvedValue({ id_fabricante: 1, nombre_fabricante: 'Fabricante 1' })
    prismaMock.unidadMedida.findUnique.mockResolvedValue({ id_unidad: 1, nombre: 'Unidad 1' })
    prismaMock.bitacora.create.mockResolvedValue({})
    prismaMock.correlativoCodigo.upsert.mockResolvedValue({
      id_correlativo_codigo: 1,
      tipo: 'producto',
      anio: new Date().getFullYear(),
      ultimo_valor: 1,
      created_at: new Date(),
      updated_at: new Date()
    })
    prismaMock.$transaction.mockImplementation(async (cb: (client: PrismaMock) => any) => cb(prismaMock))
  })

  it('genera código automáticamente cuando no se proporciona', async () => {
    const request = {
      json: jest.fn().mockResolvedValue({
        id_categoria: 1,
        id_fabricante: 1,
        id_unidad: 1,
        tipo: 'producto',
        nombre: 'Producto de prueba',
        precio_compra: 100,
        precio_venta: 150
      })
    } as unknown as NextRequest

    const response = await POST(request)
    const result = await response.json()

    expect(response.status).toBe(201)
    expect(result.codigo_producto).toMatch(/^PROD-\d{4}-\d{3}$/)
    expect(prismaMock.correlativoCodigo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tipo_anio: { tipo: 'producto', anio: new Date().getFullYear() } }
    }))
  })
})
