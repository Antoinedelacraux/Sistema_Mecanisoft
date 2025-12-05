/// <reference types="jest" />

import path from 'path'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/reportes/files/[id]/download/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso } from '@/lib/permisos/guards'
import fs from 'fs/promises'
import { getPresignedUrlForKey } from '@/lib/storage/s3'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/permisos/guards', () => {
  const actual = jest.requireActual('@/lib/permisos/guards')
  return {
    ...actual,
    asegurarPermiso: jest.fn()
  }
})

jest.mock('@/lib/prisma', () => ({
  prisma: {
    reportFile: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    stat: jest.fn(),
    readFile: jest.fn()
  }
}))

jest.mock('@/lib/storage/s3', () => ({
  getPresignedUrlForKey: jest.fn()
}))

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

const sessionMock = () => getServerSession as jest.Mock
const permisoMock = () => asegurarPermiso as jest.Mock
const prismaMock = () => prisma.reportFile.findUnique as jest.Mock
const mockFs = fs as unknown as { stat: jest.Mock; readFile: jest.Mock }
const presignMock = () => getPresignedUrlForKey as jest.Mock

describe('GET /api/reportes/files/[id]/download', () => {
  const originalEnv = process.env.S3_BUCKET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.S3_BUCKET = originalEnv
  })

  it('retorna 401 si la sesión no es válida', async () => {
    sessionMock().mockResolvedValue(null)
    permisoMock().mockRejectedValue(new (sesionError())())

    const request = new NextRequest('http://localhost/api/reportes/files/1/download')
    const response = ensureResponse(await GET(request, { params: Promise.resolve({ id: '1' }) }))

    expect(response.status).toBe(401)
  })

  it('redirige a S3 cuando está configurado', async () => {
    process.env.S3_BUCKET = 'demo'
    sessionMock().mockResolvedValue({ user: { id: '10' } })
    permisoMock().mockResolvedValue(undefined)
    prismaMock().mockResolvedValue({
      id: 1,
      path: 'reportes/demo.csv',
      filename: 'demo.csv',
      mime: 'text/csv'
    })
    presignMock().mockResolvedValue('https://signed-url.test/demo.csv')

    const request = new NextRequest('http://localhost/api/reportes/files/1/download')
    const response = ensureResponse(await GET(request, { params: Promise.resolve({ id: '1' }) }))

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toBe('https://signed-url.test/demo.csv')
    expect(presignMock()).toHaveBeenCalledWith('reportes/demo.csv', expect.any(Number))
  })

  it('devuelve el archivo cuando existe en disco', async () => {
    process.env.S3_BUCKET = ''
    sessionMock().mockResolvedValue({ user: { id: '10' } })
    permisoMock().mockResolvedValue(undefined)
    const fakePath = path.join(process.cwd(), 'public', 'exports', 'demo.csv')
    prismaMock().mockResolvedValue({
      id: 2,
      path: fakePath,
      filename: 'demo.csv',
      mime: 'text/csv'
    })
    mockFs.stat.mockResolvedValue({ isFile: () => true, size: 4 })
    mockFs.readFile.mockResolvedValue(Buffer.from('data'))

    const request = new NextRequest('http://localhost/api/reportes/files/2/download')
    const response = ensureResponse(await GET(request, { params: Promise.resolve({ id: '2' }) }))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('demo.csv')
    expect(mockFs.readFile).toHaveBeenCalledWith(fakePath)
  })

  it('normaliza rutas relativas dentro de /exports', async () => {
    process.env.S3_BUCKET = ''
    sessionMock().mockResolvedValue({ user: { id: '12' } })
    permisoMock().mockResolvedValue(undefined)
    const storedPath = '/exports/demo-rel.csv'
    const resolvedPath = path.join(process.cwd(), 'public', 'exports', 'demo-rel.csv')
    prismaMock().mockResolvedValue({
      id: 5,
      path: storedPath,
      filename: 'demo-rel.csv',
      mime: 'text/csv'
    })
    mockFs.stat.mockResolvedValue({ isFile: () => true, size: 8 })
    mockFs.readFile.mockResolvedValue(Buffer.from('contenido'))

    const request = new NextRequest('http://localhost/api/reportes/files/5/download')
    const response = ensureResponse(await GET(request, { params: Promise.resolve({ id: '5' }) }))

    expect(response.status).toBe(200)
    expect(mockFs.readFile).toHaveBeenCalledWith(resolvedPath)
  })

  it('responde 404 si el archivo no existe', async () => {
    process.env.S3_BUCKET = ''
    sessionMock().mockResolvedValue({ user: { id: '11' } })
    permisoMock().mockResolvedValue(undefined)
    prismaMock().mockResolvedValue({
      id: 3,
      path: path.join(process.cwd(), 'public', 'exports', 'missing.csv'),
      filename: 'missing.csv',
      mime: 'text/csv'
    })
    mockFs.stat.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/reportes/files/3/download')
    const response = ensureResponse(await GET(request, { params: Promise.resolve({ id: '3' }) }))

    expect(response.status).toBe(404)
  })
})

function sesionError() {
  const { SesionInvalidaError } = jest.requireActual('@/lib/permisos/guards')
  return SesionInvalidaError
}
