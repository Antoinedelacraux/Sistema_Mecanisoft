import { jest } from '@jest/globals'

jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 2 } })) }))

jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: (body: any, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        json: async () => body
      })
    },
    NextRequest: class NextRequestStub {}
  }
})

jest.mock('fs/promises', () => ({ writeFile: jest.fn(), mkdir: jest.fn() }))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: { update: jest.fn(async (args: any) => ({ id_usuario: args.where.id_usuario, imagen_usuario: args.data.imagen_usuario })) }
  }
}))

jest.mock('@/lib/bitacora/log-event', () => ({ logEvent: jest.fn() }))

import { POST as uploadAvatar } from '@/app/api/usuarios/me/avatar/route'

function makeFile() {
  return {
    name: 'avatar.png',
    type: 'image/png',
    size: 1024,
    async arrayBuffer() { return new Uint8Array([1,2,3]).buffer }
  }
}

describe('POST /api/usuarios/me/avatar', () => {
  it('accepts an avatar and returns imageUrl', async () => {
    const req = {
      async formData() { return { get: (_: string) => makeFile() } }
    } as any

    const res = await uploadAvatar(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('imageUrl')
  })
})
