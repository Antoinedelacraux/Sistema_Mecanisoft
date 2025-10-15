/// <reference types="jest" />

import { NextRequest } from 'next/server'
import { POST } from '../../src/app/api/clientes/validar-documento/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => {
  const persona = {
    findUnique: jest.fn()
  }

  const empresaPersona = {
    findUnique: jest.fn()
  }

  const cliente = {
    findUnique: jest.fn()
  }

  const prismaMock: any = {
    persona,
    empresaPersona,
    cliente
  }

  return { prisma: prismaMock }
})

const buildSession = (id: string, permisos: string[] = ['clientes.editar']) => ({
  user: { id, permisos }
})

describe('POST /api/clientes/validar-documento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when session is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/clientes/validar-documento', {
      method: 'POST',
      body: JSON.stringify({ numero_documento: '12345678' })
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('No autorizado')
  })

  it('should report when document already belongs to another client', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(buildSession('1'))
    ;(prisma.persona.findUnique as jest.Mock).mockResolvedValue({
      numero_documento: '12345678',
      nombre: 'Pedro',
      apellido_paterno: 'Ramirez',
      cliente: { id_cliente: 5 },
      proveedor: null,
      usuario: null
    })

    const req = new NextRequest('http://localhost/api/clientes/validar-documento', {
      method: 'POST',
      body: JSON.stringify({ numero_documento: '12345678' })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.disponible).toBe(false)
    expect(json.mensaje).toContain('Este documento ya está registrado')
  })

  it('should allow document when no persona or empresa exists', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(buildSession('1'))
    ;(prisma.persona.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.empresaPersona.findUnique as jest.Mock).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/clientes/validar-documento', {
      method: 'POST',
      body: JSON.stringify({ numero_documento: '87654321' })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.disponible).toBe(true)
    expect(json.mensaje).toBe('Documento disponible')
  })

  it('should allow document when persona belongs to the same client', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(buildSession('1'))
    ;(prisma.persona.findUnique as jest.Mock).mockResolvedValue({
      numero_documento: '12345678',
      nombre: 'Luis',
      apellido_paterno: 'Garcia',
      cliente: { id_cliente: 7 },
      proveedor: null,
      usuario: null
    })

    const req = new NextRequest('http://localhost/api/clientes/validar-documento', {
      method: 'POST',
      body: JSON.stringify({ numero_documento: '12345678', cliente_id: 7 })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.disponible).toBe(true)
    expect(json.mensaje).toBe('Documento disponible')
  })
})
