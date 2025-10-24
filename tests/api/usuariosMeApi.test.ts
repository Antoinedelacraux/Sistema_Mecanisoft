import { jest } from '@jest/globals'

// Minimal mocks used across tests
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 1 } })) }))

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

jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(async () => ({ id_usuario: 1, id_persona: 10, nombre_usuario: 'admin', imagen_usuario: '/uploads/avatars/a.png', persona: { id_persona: 10, nombre: 'Admin', apellido_paterno: 'User', correo: 'admin@local' } }))
    },
    persona: {
      update: jest.fn(async (args: any) => ({ id_persona: args.where.id_persona, ...args.data }))
    },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        persona: { update: jest.fn(async (a: any) => ({ })) },
        usuario: {
          findUniqueOrThrow: jest.fn(async () => ({ id_usuario: 1, persona: { id_persona: 10 } })),
          findUnique: jest.fn(async () => ({ id_usuario: 1 }))
        }
      }
      return cb(tx)
    })
  }
}))

jest.mock('@/lib/bitacora/log-event', () => ({ logEvent: jest.fn() }))

import { GET as getMe, PATCH as patchMe } from '@/app/api/usuarios/me/route'
import { prisma } from '@/lib/prisma'

describe('GET /api/usuarios/me', () => {
  it('returns current user profile', async () => {
    const res = await getMe()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('usuario')
    expect(body.usuario.id_usuario).toBe(1)
  })
})

describe('PATCH /api/usuarios/me', () => {
  it('validates and updates persona fields', async () => {
    const req = {
      async json() { return { nombre: 'Nuevo', correo: 'nuevo@local.com' } }
    } as any

    const res = await patchMe(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('usuario')
  })
})
