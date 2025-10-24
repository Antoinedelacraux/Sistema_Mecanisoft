/// <reference types="jest" />

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/usuarios/buscar/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: { findMany: jest.fn() }
  }
}))

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

describe('API /api/usuarios/buscar', () => {
  beforeEach(() => jest.clearAllMocks())
  const getSessionMock = () => getServerSession as jest.Mock

  it('GET returns empty array when no q', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '1' } })
    const request = new NextRequest('http://localhost/api/usuarios/buscar')
    const response = ensureResponse(await GET(request as any))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.usuarios).toHaveLength(0)
  })

  it('GET searches and returns mapped users', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '1' } })
    ;(prisma.usuario.findMany as jest.Mock).mockResolvedValueOnce([
      { id_usuario: 2, nombre_usuario: 'user2', persona: { nombre: 'Juan', apellido_paterno: 'Perez' } }
    ])
    const request = new NextRequest('http://localhost/api/usuarios/buscar?q=Ju&take=5')
    const response = ensureResponse(await GET(request as any))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.usuarios)).toBe(true)
    expect(body.usuarios[0].label).toMatch(/Juan/)
  })
})
