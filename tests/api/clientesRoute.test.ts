import { NextRequest } from 'next/server'
import { GET } from '@/app/api/clientes/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => {
  const cliente = {
    findMany: jest.fn(),
    count: jest.fn()
  }

  return {
    prisma: {
      cliente
    }
  }
})

describe('GET /api/clientes', () => {
  it('returns clients', async () => {
    const mockedGetServerSession = getServerSession as jest.Mock
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } })

    const mockedClienteFindMany = prisma.cliente.findMany as jest.Mock
    const mockedClienteCount = prisma.cliente.count as jest.Mock

    mockedClienteFindMany.mockResolvedValueOnce([
      {
        id_cliente: 1,
        persona: {
          id_persona: 2,
          nombre: 'Juan',
          apellido_paterno: 'Pérez',
          apellido_materno: 'García',
          numero_documento: '12345678',
          correo: 'juan@example.com',
          empresa_persona: null
        },
        _count: {
          vehiculos: 0
        }
      }
    ])
    mockedClienteCount.mockResolvedValueOnce(1)

    const request = new NextRequest('http://localhost/api/clientes')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.clientes).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })
})
