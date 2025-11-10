/// <reference types="jest" />

import type { Prisma } from '@prisma/client'

import { generarCodigoCorrelativo, obtenerSiguienteCorrelativo, CORRELATIVO_TIPOS } from '@/lib/correlativos/service'
import { prisma } from '@/lib/prisma'

type CorrelativoRecord = {
  id_correlativo_codigo: number
  tipo: string
  anio: number
  ultimo_valor: number
  created_at: Date
  updated_at: Date
}

type PrismaMock = {
  correlativoCodigo: {
    upsert: jest.Mock<Promise<CorrelativoRecord>, [unknown]>
  }
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    correlativoCodigo: {
      upsert: jest.fn()
    }
  }
}))

const prismaMock = prisma as unknown as PrismaMock

describe('correlativos/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('genera códigos con padding y año basado en la fecha indicada', async () => {
    const now = new Date('2025-03-01T12:00:00Z')
    prismaMock.correlativoCodigo.upsert.mockResolvedValue({
      id_correlativo_codigo: 10,
      tipo: 'producto',
      anio: now.getFullYear(),
      ultimo_valor: 5,
      created_at: now,
      updated_at: now
    })

    const resultado = await generarCodigoCorrelativo({
      tipo: CORRELATIVO_TIPOS.PRODUCTO,
      prefijo: 'PROD',
      fechaBase: now
    })

    expect(resultado.codigo).toBe('PROD-2025-005')
    expect(resultado.correlativo).toBe(5)
    expect(resultado.anio).toBe(2025)
    expect(prismaMock.correlativoCodigo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tipo_anio: { tipo: 'producto', anio: 2025 } },
      update: { ultimo_valor: { increment: 1 } },
      create: { tipo: 'producto', anio: 2025, ultimo_valor: 1 }
    }))
  })

  it('utiliza el cliente transaccional provisto', async () => {
    const customClientMock = {
      correlativoCodigo: {
        upsert: jest.fn().mockResolvedValue({
          id_correlativo_codigo: 20,
          tipo: 'cotizacion',
          anio: 2024,
          ultimo_valor: 11,
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    }

    const siguiente = await obtenerSiguienteCorrelativo({
      tipo: CORRELATIVO_TIPOS.COTIZACION,
      anio: 2024,
      prismaClient: customClientMock as unknown as Prisma.TransactionClient
    })

    expect(siguiente).toBe(11)
    expect(customClientMock.correlativoCodigo.upsert).toHaveBeenCalled()
    expect(prismaMock.correlativoCodigo.upsert).not.toHaveBeenCalled()
  })
})
