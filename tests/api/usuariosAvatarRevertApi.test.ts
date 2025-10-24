/// <reference types="jest" />

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/usuarios/me/avatar/revert/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('fs/promises', () => ({ readFile: jest.fn(), writeFile: jest.fn() }))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: { update: jest.fn() }
  }
}))

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) throw new Error('La ruta devolvió una respuesta indefinida')
  return response
}

describe('POST /api/usuarios/me/avatar/revert', () => {
  beforeEach(() => jest.clearAllMocks())
  const getSessionMock = () => getServerSession as jest.Mock

  it('returns 400 when no versions file', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '2' } })
    const { readFile } = await import('fs/promises')
    ;(readFile as jest.Mock).mockRejectedValue(new Error('not found'))

    const request = new NextRequest('http://localhost/api/usuarios/me/avatar/revert')
    const response = ensureResponse(await POST(request as any))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('reverts avatar successfully when versions exist', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '2' } })
    const { readFile } = await import('fs/promises')
    ;(readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(['/uploads/avatars/old.png']))

    const request = new NextRequest('http://localhost/api/usuarios/me/avatar/revert')
    const response = ensureResponse(await POST(request as any))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.imageUrl).toBe('/uploads/avatars/old.png')
  })
})
