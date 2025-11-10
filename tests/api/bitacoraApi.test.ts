/// <reference types="jest" />

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/bitacora/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bitacora: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}))

jest.mock('@/lib/permisos/guards', () => {
  const actual = jest.requireActual('@/lib/permisos/guards')
  return {
    ...actual,
    asegurarPermiso: jest.fn()
  }
})

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

describe('API /api/bitacora', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const getSessionMock = () => getServerSession as jest.Mock
  const getPermisoMock = () => asegurarPermiso as jest.Mock

  it('GET responde 401 cuando no hay sesión válida', async () => {
    getSessionMock().mockResolvedValue(null)
    getPermisoMock().mockRejectedValue(new SesionInvalidaError())

    const request = new NextRequest('http://localhost/api/bitacora')
    const response = ensureResponse(await GET(request as any))

    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.error).toMatch(/no autorizado/i)
  })

  it('GET responde 403 cuando falta permiso', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '3' } })
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('bitacora.ver'))

    const request = new NextRequest('http://localhost/api/bitacora')
    const response = ensureResponse(await GET(request as any))

    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload.error).toMatch(/bitácora/i)
  })

  it('GET retorna eventos y paginación cuando el permiso es válido', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '3' } })
    getPermisoMock().mockResolvedValue(undefined)

    ;(prisma.bitacora.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id_bitacora: 1,
        id_usuario: 2,
        accion: 'LOGIN',
        descripcion: 'ok',
        fecha_hora: '2025-10-01T00:00:00.000Z',
        tabla: 'usuario',
        ip_publica: '1.2.3.4',
        usuario: {
          id_usuario: 2,
          nombre_usuario: 'admin',
          persona: {
            id_persona: 55,
            nombre: 'Ada',
            apellido_paterno: 'Lovelace',
            apellido_materno: null,
            correo: 'ada@example.com'
          }
        }
      }
    ])
    ;(prisma.bitacora.count as jest.Mock).mockResolvedValueOnce(1)

    const request = new NextRequest('http://localhost/api/bitacora?page=1&perPage=10')
    const response = ensureResponse(await GET(request as any))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.eventos).toHaveLength(1)
    expect(payload.eventos[0].usuario).toEqual(
      expect.objectContaining({ username: 'admin', persona: expect.objectContaining({ nombreCompleto: 'Ada Lovelace' }) })
    )
    expect(payload.total).toBe(1)
  })

  it('GET export CSV responde con text/csv', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '3' } })
    getPermisoMock().mockResolvedValue(undefined)

    ;(prisma.bitacora.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id_bitacora: 1,
        id_usuario: 2,
        accion: 'LOGIN',
        descripcion: 'ok',
        fecha_hora: '2025-10-01T00:00:00.000Z',
        tabla: 'usuario',
        ip_publica: '1.2.3.4',
        usuario: {
          id_usuario: 2,
          nombre_usuario: 'admin',
          persona: {
            id_persona: 55,
            nombre: 'Ada',
            apellido_paterno: 'Lovelace',
            apellido_materno: null,
            correo: 'ada@example.com'
          }
        }
      }
    ])
    ;(prisma.bitacora.count as jest.Mock).mockResolvedValueOnce(1)

    const request = new NextRequest('http://localhost/api/bitacora?export=csv')
    const response = ensureResponse(await GET(request as any))

    expect(response.status).toBe(200)
    const ct = response.headers.get('content-type')
    expect(ct).toContain('text/csv')
    const text = await response.text()
  expect(text).toMatch(/usuario_username/)
  expect(text).toMatch(/admin/)
  })
})
