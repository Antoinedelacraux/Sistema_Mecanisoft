/// <reference types="jest" />

import { NextRequest } from 'next/server'

import { GET, PUT, PATCH } from '@/app/api/servicios/[id]/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    servicio: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    bitacora: {
      create: jest.fn()
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

describe('API /api/servicios/[id]', () => {
  const params = { params: { id: '12' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const getSessionMock = () => getServerSession as jest.Mock
  const getPermisoMock = () => asegurarPermiso as jest.Mock

  it('GET responde 401 cuando la sesión es inválida', async () => {
    getSessionMock().mockResolvedValue(null)
    getPermisoMock().mockRejectedValue(new SesionInvalidaError())

    const response = ensureResponse(await GET(new NextRequest('http://localhost/api/servicios/12'), params))

    expect(response.status).toBe(401)
  })

  it('GET responde 403 cuando falta permiso', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '9' } })
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('servicios.listar'))

    const response = ensureResponse(await GET(new NextRequest('http://localhost/api/servicios/12'), params))

    expect(response.status).toBe(403)
  })

  it('GET devuelve 404 cuando el servicio no existe', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '9' } })
    getPermisoMock().mockResolvedValue(undefined)
    ;(prisma.servicio.findUnique as jest.Mock).mockResolvedValue(null)

    const response = ensureResponse(await GET(new NextRequest('http://localhost/api/servicios/12'), params))

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error).toMatch(/no encontrado/i)
  })

  it('GET retorna el servicio cuando existe y el permiso es válido', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '9' } })
    getPermisoMock().mockResolvedValue(undefined)
    ;(prisma.servicio.findUnique as jest.Mock).mockResolvedValue({
      id_servicio: 12,
      codigo_servicio: 'SER-2025-010',
      nombre: 'Lavado',
      descripcion: null,
      es_general: true,
      id_marca: null,
      id_modelo: null,
      precio_base: 40,
      descuento: 0,
      oferta: false,
      tiempo_minimo: 30,
      tiempo_maximo: 45,
      unidad_tiempo: 'minutos',
      estatus: true,
      fecha_registro: '2025-01-05',
      marca: null,
      modelo: null
    })

    const response = ensureResponse(await GET(new NextRequest('http://localhost/api/servicios/12'), params))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.nombre).toBe('Lavado')
  })

  it('PUT responde 401 cuando no hay sesión válida', async () => {
    getSessionMock().mockResolvedValue(null)
    getPermisoMock().mockRejectedValue(new SesionInvalidaError())

    const request = new NextRequest('http://localhost/api/servicios/12', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Cambio de aceite' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await PUT(request, params))

    expect(response.status).toBe(401)
  })

  it('PUT responde 403 cuando falta permiso de gestión', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '2' } })
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('servicios.gestionar'))

    const request = new NextRequest('http://localhost/api/servicios/12', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Cambio de aceite' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await PUT(request, params))

    expect(response.status).toBe(403)
  })

  it('PATCH responde 401 cuando la sesión es inválida', async () => {
    getSessionMock().mockResolvedValue(null)
    getPermisoMock().mockRejectedValue(new SesionInvalidaError())

    const request = new NextRequest('http://localhost/api/servicios/12', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'toggle_status', estatus: false }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await PATCH(request, params))

    expect(response.status).toBe(401)
  })

  it('PATCH responde 403 cuando falta permiso de gestión', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '4' } })
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('servicios.gestionar'))

    const request = new NextRequest('http://localhost/api/servicios/12', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'toggle_status', estatus: false }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await PATCH(request, params))

    expect(response.status).toBe(403)
  })

  it('PATCH alterna el estatus cuando el permiso es válido', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '4' } })
    getPermisoMock().mockResolvedValue(undefined)

    const servicioActual = {
      id_servicio: 12,
      codigo_servicio: 'SER-2025-010',
      nombre: 'Lavado',
      descripcion: null,
      es_general: true,
      id_marca: null,
      id_modelo: null,
      precio_base: 40,
      descuento: 0,
      oferta: false,
      tiempo_minimo: 30,
      tiempo_maximo: 45,
      unidad_tiempo: 'minutos',
      estatus: true,
      marca: null,
      modelo: null
    }

    ;(prisma.servicio.findUnique as jest.Mock).mockResolvedValue(servicioActual)
    ;(prisma.servicio.update as jest.Mock).mockResolvedValue({ ...servicioActual, estatus: false })
    ;(prisma.bitacora.create as jest.Mock).mockResolvedValue({ id_bitacora: 99 })

    const request = new NextRequest('http://localhost/api/servicios/12', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'toggle_status', estatus: false }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await PATCH(request, params))

    expect(response.status).toBe(200)
    expect(prisma.servicio.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ estatus: false })
    }))
  })
})
