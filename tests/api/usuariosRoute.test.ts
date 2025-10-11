/// <reference types="jest" />

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/usuarios/route'
import { getServerSession } from 'next-auth/next'
import { listUsuarios } from '@/app/api/usuarios/controllers/list-controller'
import { createUsuario } from '@/app/api/usuarios/controllers/create-controller'
import { ApiError } from '@/app/api/usuarios/controllers/errors'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/list-controller', () => ({
  listUsuarios: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/create-controller', () => ({
  createUsuario: jest.fn()
}))

describe('API /api/usuarios', () => {
  const getSessionMock = () => getServerSession as jest.Mock
  const getListUsuariosMock = () => listUsuarios as jest.Mock
  const getCreateUsuarioMock = () => createUsuario as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('responde 401 cuando no hay sesión', async () => {
      getSessionMock().mockResolvedValue(null)

  const response = await GET({ url: 'http://localhost/api/usuarios' } as unknown as NextRequest)

      expect(response.status).toBe(401)
      expect(getListUsuariosMock()).not.toHaveBeenCalled()
    })

    it('retorna la lista de usuarios con filtros parseados', async () => {
      const fechaDesde = '2025-01-10T10:00:00.000Z'
      const fechaHasta = '2025-01-15T18:00:00.000Z'

      const resultado = {
        usuarios: [{ id_usuario: 1, nombre_usuario: 'jdoe' }],
        pagination: { total: 1, limit: 10, current: 2, pages: 1 }
      }

      getSessionMock().mockResolvedValue({ user: { id: '77' } })
      getListUsuariosMock().mockResolvedValue(resultado)

      const requestUrl = [
        'http://localhost/api/usuarios?search=Carla',
        'rol=Administrador',
        'estado=INACTIVOS',
        'requiere_cambio=false',
        'pendientes_envio=true',
        `fecha_desde=${fechaDesde}`,
        `fecha_hasta=${fechaHasta}`,
        'page=2',
        'limit=10'
      ].join('&')

  const response = await GET({ url: requestUrl } as unknown as NextRequest)

      expect(response.status).toBe(200)
      expect(getListUsuariosMock()).toHaveBeenCalledWith({
        search: 'Carla',
        rol: 'Administrador',
        estado: 'inactivos',
        requiereCambio: false,
        pendientesEnvio: true,
        fechaDesde: new Date(fechaDesde),
        fechaHasta: new Date(fechaHasta),
        page: 2,
        limit: 10
      })

      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('propaga errores de negocio', async () => {
      getSessionMock().mockResolvedValue({ user: { id: '5' } })
      getListUsuariosMock().mockRejectedValue(new ApiError(422, 'Filtros inválidos'))

  const response = await GET({ url: 'http://localhost/api/usuarios' } as unknown as NextRequest)

      expect(response.status).toBe(422)
      const json = await response.json()
      expect(json).toEqual({ error: 'Filtros inválidos' })
    })

    it('maneja errores inesperados', async () => {
      getSessionMock().mockResolvedValue({ user: { id: '5' } })
      getListUsuariosMock().mockRejectedValue(new Error('boom'))

  const response = await GET({ url: 'http://localhost/api/usuarios' } as unknown as NextRequest)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toEqual({ error: 'Error interno del servidor' })
    })
  })

  describe('POST', () => {
    const buildRequest = (payload: unknown) => ({
      url: 'http://localhost/api/usuarios',
      json: jest.fn().mockResolvedValue(payload)
    })

    it('responde 401 cuando no hay sesión', async () => {
      getSessionMock().mockResolvedValue(null)

  const response = await POST(buildRequest({ nombre_usuario: 'nuevo' }) as unknown as NextRequest)

      expect(response.status).toBe(401)
      expect(getCreateUsuarioMock()).not.toHaveBeenCalled()
    })

    it('crea un usuario con el payload recibido', async () => {
      const payload = { nombre_usuario: 'nuevo' }
      const resultado = { usuario: { id_usuario: 10 } }

      getSessionMock().mockResolvedValue({ user: { id: '9' } })
      getCreateUsuarioMock().mockResolvedValue(resultado)

  const response = await POST(buildRequest(payload) as unknown as NextRequest)

      expect(getCreateUsuarioMock()).toHaveBeenCalledWith(payload, 9)
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('propaga errores de negocio', async () => {
      const payload = { nombre_usuario: 'duplicado' }

      getSessionMock().mockResolvedValue({ user: { id: '12' } })
      getCreateUsuarioMock().mockRejectedValue(new ApiError(400, 'Ya existe'))

  const response = await POST(buildRequest(payload) as unknown as NextRequest)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({ error: 'Ya existe' })
    })

    it('maneja errores inesperados', async () => {
      const payload = { nombre_usuario: 'algo' }

      getSessionMock().mockResolvedValue({ user: { id: '12' } })
      getCreateUsuarioMock().mockRejectedValue(new Error('falló'))

  const response = await POST(buildRequest(payload) as unknown as NextRequest)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toEqual({ error: 'Error interno del servidor' })
    })
  })
})
