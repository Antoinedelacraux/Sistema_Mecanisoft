/// <reference types="jest" />

import { GET } from '@/app/api/productos/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

type MockFn = jest.Mock<any, any>

type PrismaMock = {
  producto: {
    findMany: MockFn
    count: MockFn
  }
}

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    producto: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  }

  return { prisma: prismaMock }
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
