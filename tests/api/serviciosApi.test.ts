/// <reference types="jest" />

import { NextRequest } from 'next/server'

import { GET, POST } from '@/app/api/servicios/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    servicio: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn()
    },
    marca: {
      findUnique: jest.fn()
    },
    modelo: {
      findUnique: jest.fn()
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

describe('API /api/servicios', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const getSessionMock = () => getServerSession as jest.Mock
  const getPermisoMock = () => asegurarPermiso as jest.Mock

  it('GET responde 401 cuando no hay sesión válida', async () => {
    getSessionMock().mockResolvedValue(null)
    getPermisoMock().mockRejectedValue(new SesionInvalidaError())

    const request = new NextRequest('http://localhost/api/servicios')
    const response = ensureResponse(await GET(request))

    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.error).toMatch(/no autorizado/i)
  })

  it('GET responde 403 cuando falta permiso', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '3' } })
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('servicios.listar'))

    const request = new NextRequest('http://localhost/api/servicios')
    const response = ensureResponse(await GET(request))

    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload.error).toMatch(/permisos para ver servicios/i)
  })

  it('GET retorna servicios y paginación cuando el permiso es válido', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '3' } })
    getPermisoMock().mockResolvedValue(undefined)

    ;(prisma.servicio.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id_servicio: 1,
        codigo_servicio: 'SER-2025-001',
        nombre: 'Balanceo',
        descripcion: null,
        es_general: true,
        id_marca: null,
        id_modelo: null,
        precio_base: 50,
        descuento: 0,
        oferta: false,
        tiempo_minimo: 30,
        tiempo_maximo: 60,
        unidad_tiempo: 'minutos',
        estatus: true,
        fecha_registro: '2025-01-01',
        marca: null,
        modelo: null
      }
    ])
    ;(prisma.servicio.count as jest.Mock).mockResolvedValueOnce(1)

    const request = new NextRequest('http://localhost/api/servicios?page=1&limit=10')
    const response = ensureResponse(await GET(request))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.servicios).toHaveLength(1)
    expect(payload.pagination.total).toBe(1)
    expect(payload.pagination.limit).toBe(10)
  })

  it('POST responde 401 cuando el guardián detecta sesión inválida', async () => {
    getSessionMock().mockResolvedValue(null)
    getPermisoMock().mockRejectedValue(new SesionInvalidaError())

    const request = new NextRequest('http://localhost/api/servicios', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Servicio', precio_base: 10, tiempo_minimo: 10, tiempo_maximo: 20, unidad_tiempo: 'minutos' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await POST(request))

    expect(response.status).toBe(401)
  })

  it('POST responde 403 cuando falta permiso de gestión', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '5' } })
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('servicios.gestionar'))

    const request = new NextRequest('http://localhost/api/servicios', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Servicio', precio_base: 10, tiempo_minimo: 10, tiempo_maximo: 20, unidad_tiempo: 'minutos' }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await POST(request))

    expect(response.status).toBe(403)
  })

  it('POST crea un servicio y registra bitácora cuando la solicitud es válida', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '7' } })
    getPermisoMock().mockResolvedValue(undefined)

    ;(prisma.marca.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.modelo.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.servicio.findFirst as jest.Mock).mockResolvedValue(null)

    const creado = {
      id_servicio: 10,
      codigo_servicio: 'SER-2025-001',
      nombre: 'Inspección',
      descripcion: null,
      es_general: true,
      id_marca: null,
      id_modelo: null,
      precio_base: 150,
      descuento: 0,
      oferta: false,
      tiempo_minimo: 60,
      tiempo_maximo: 120,
      unidad_tiempo: 'minutos',
      estatus: true,
      fecha_registro: '2025-01-01',
      marca: null,
      modelo: null
    }

    ;(prisma.servicio.create as jest.Mock).mockResolvedValue(creado)
    ;(prisma.bitacora.create as jest.Mock).mockResolvedValue({ id_bitacora: 1 })

    const request = new NextRequest('http://localhost/api/servicios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Inspección',
        precio_base: 150,
        descuento: 0,
        oferta: false,
        es_general: true,
        tiempo_minimo: 60,
        tiempo_maximo: 120,
        unidad_tiempo: 'minutos'
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(await POST(request))

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.nombre).toBe('Inspección')
    expect(prisma.servicio.create).toHaveBeenCalled()
    expect(prisma.bitacora.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accion: 'CREATE_SERVICIO' })
    }))
  })
})
