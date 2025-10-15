/// <reference types="jest" />

import { getServerSession } from 'next-auth/next'

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))

jest.mock('@/lib/permisos/guards', () => ({
  asegurarPermiso: jest.fn(),
  PermisoDenegadoError: class extends Error { codigoPermiso = 'productos.gestionar' },
  SesionInvalidaError: class extends Error {},
}))

jest.mock('@/lib/prisma', () => {
  return {
    prisma: {
      inventario: { findUnique: jest.fn() },
      producto: { update: jest.fn() },
      bitacora: { create: jest.fn() },
    }
  }
})

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body, async json() { return body } }),
  }
}))

import { PATCH } from '../../src/app/api/productos/[id]/usar-costo-promedio/route'
import { asegurarPermiso } from '@/lib/permisos/guards'

const getSessionMock = () => getServerSession as jest.Mock
const getPermisoMock = () => asegurarPermiso as jest.Mock
const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as any).prisma

const buildReq = (id = 1) => ({ method: 'PATCH', nextUrl: new URL(`http://localhost/api/productos/${id}/usar-costo-promedio`), params: { id: String(id) } } as any)

describe('PATCH /api/productos/:id/usar-costo-promedio', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns 401 when no session', async () => {
    getSessionMock().mockResolvedValue(null)
    const res = await PATCH(buildReq(5) as any, { params: Promise.resolve({ id: '5' }) } as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 when permission denied', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '1' } })
    // Throw the mocked PermisoDenegadoError so the route maps it to a 403
    const { PermisoDenegadoError } = jest.requireMock('@/lib/permisos/guards')
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('Sin permiso'))
    const res = await PATCH(buildReq(5) as any, { params: Promise.resolve({ id: '5' }) } as any)
    expect(res.status).toBe(403)
  })

  it('updates product precio_compra from inventario costo_promedio', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '2' } })
    getPermisoMock().mockResolvedValue(undefined)

    const prisma = getPrismaMock()
    prisma.inventario.findUnique.mockResolvedValue({ id_inventario: 1, id_producto: 10, costo_promedio: { toString: () => '12.5' } })
    prisma.producto.update.mockResolvedValue({ id_producto: 10, precio_compra: { toString: () => '12.5' } })
    prisma.bitacora.create.mockResolvedValue({})

    const res = await PATCH(buildReq(10) as any, { params: Promise.resolve({ id: '10' }) } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.precio_compra).toBe('12.5')
    expect(prisma.producto.update).toHaveBeenCalled()
    expect(prisma.bitacora.create).toHaveBeenCalled()
  })
})
