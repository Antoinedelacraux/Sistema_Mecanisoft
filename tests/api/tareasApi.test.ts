/// <reference types="jest" />

import { GET } from '../../src/app/api/tareas/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'

// Mocks for next-auth and prisma
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tarea: {
      findMany: jest.fn(),
    },
    trabajador: {
      findMany: jest.fn(),
    },
  },
}))

describe('GET /api/tareas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    const mockedGetServerSession = getServerSession as any
    mockedGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/tareas')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('No autorizado')
  })

  it('filters tareas with trabajador null OR activo when no trabajador_id', async () => {
    const mockedGetServerSession = getServerSession as any
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } })

  const mockedTareaFindMany = (prisma.tarea.findMany as any)
  mockedTareaFindMany.mockResolvedValue([])
  const mockedTrabajadorFindMany = (prisma.trabajador.findMany as any)
  mockedTrabajadorFindMany.mockResolvedValue([{ id_trabajador: 2 }, { id_trabajador: 3 }])

    const req = new NextRequest('http://localhost/api/tareas?estado=pendiente')
    const res = await GET(req)
    expect(res.status).toBe(200)

    expect(mockedTrabajadorFindMany).toHaveBeenCalledTimes(1)
    expect(mockedTareaFindMany).toHaveBeenCalledTimes(1)
    const args = mockedTareaFindMany.mock.calls[0][0]

    expect(args.where.OR).toBeDefined()
    const or = args.where.OR
    expect(or).toEqual(
      expect.arrayContaining([
        { id_trabajador: null },
        { id_trabajador: { in: [2, 3] } },
      ])
    )
  })

  it('filters tareas by specific trabajador_id when provided', async () => {
    const mockedGetServerSession = getServerSession as any
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } })

  const mockedTareaFindMany = (prisma.tarea.findMany as any)
  mockedTareaFindMany.mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/tareas?trabajador_id=5')
    const res = await GET(req)
    expect(res.status).toBe(200)

  expect(mockedTareaFindMany).toHaveBeenCalledTimes(1)
  const args = mockedTareaFindMany.mock.calls[0][0]
  expect(args.where.id_trabajador).toBe(5)
  })
})
