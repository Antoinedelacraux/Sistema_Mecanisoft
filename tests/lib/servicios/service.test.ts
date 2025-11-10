/// <reference types="jest" />

import { listarServicios, crearServicio } from '@/lib/servicios/service'
import { ServicioServiceError } from '@/lib/servicios/errors'

jest.mock('@/lib/bitacora/log-event', () => jest.fn())
jest.mock('@/lib/correlativos/service', () => ({
  generarCodigoCorrelativo: jest.fn(),
  CORRELATIVO_TIPOS: { SERVICIO: 'servicio' },
}))

const logEvent = jest.requireMock('@/lib/bitacora/log-event') as jest.Mock
const correlativos = jest.requireMock('@/lib/correlativos/service') as {
  generarCodigoCorrelativo: jest.Mock
  CORRELATIVO_TIPOS: { SERVICIO: string }
}

describe('lib/servicios/service', () => {
  const prismaMock = {
    servicio: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    marca: {
      findUnique: jest.fn(),
    },
    modelo: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lista servicios aplicando filtros y ordenamientos', async () => {
    prismaMock.servicio.findMany.mockResolvedValue([{ id_servicio: 1 }])
    prismaMock.servicio.count.mockResolvedValue(12)

    const resultado = await listarServicios({
      page: 1,
      limit: 20,
      search: 'alineacion',
      marcaId: 3,
      modeloId: 4,
      estado: 'activos',
    }, { prismaClient: prismaMock as unknown as any })

    expect(prismaMock.servicio.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        estatus: true,
        id_marca: 3,
        id_modelo: 4,
        OR: expect.any(Array),
      }),
      orderBy: [{ estatus: 'desc' }, { nombre: 'asc' }],
      skip: 0,
      take: 20,
    }))
    expect(resultado.pagination).toEqual({ total: 12, pages: 1, current: 1, limit: 20 })
  })

  it('crea servicios generando correlativo cuando no se envía código', async () => {
    prismaMock.marca.findUnique.mockResolvedValue({ id_marca: 3 })
    prismaMock.modelo.findUnique.mockResolvedValue({ id_modelo: 4 })
    prismaMock.servicio.findUnique.mockResolvedValue(null)

    const servicioCreado = { id_servicio: 10, nombre: 'Cambio de aceite' }
    const txMock = {
      servicio: {
        create: jest.fn().mockResolvedValue(servicioCreado),
      },
    }
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    correlativos.generarCodigoCorrelativo.mockResolvedValue({ codigo: 'SER-2024-001', correlativo: 1, anio: 2024 })

    const resultado = await crearServicio({
      nombre: 'Cambio de aceite',
      precio_base: '120.50',
      descuento: 10,
      oferta: true,
      tiempo_minimo: '30',
      tiempo_maximo: '60',
      unidad_tiempo: 'minutos',
      id_marca: '3',
      id_modelo: '4',
      descripcion: 'Servicio basico',
    }, { prismaClient: prismaMock as unknown as any, usuarioId: 22 })

    expect(correlativos.generarCodigoCorrelativo).toHaveBeenCalledWith(expect.objectContaining({
      tipo: correlativos.CORRELATIVO_TIPOS.SERVICIO,
      prefijo: 'SER',
    }))
    expect(txMock.servicio.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        codigo_servicio: 'SER-2024-001',
        descuento: 10,
        oferta: true,
      }),
    }))
    expect(resultado).toBe(servicioCreado)
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 22,
      accion: 'CREATE_SERVICIO',
    }))
  })

  it('rechaza descuentos cuando la oferta no está activa', async () => {
    prismaMock.marca.findUnique.mockResolvedValue({ id_marca: 1 })
    prismaMock.modelo.findUnique.mockResolvedValue({ id_modelo: 2 })
    prismaMock.servicio.findUnique.mockResolvedValue(null)

    await expect(crearServicio({
      nombre: 'Alineado',
      precio_base: 50,
      descuento: 15,
      oferta: false,
      tiempo_minimo: 10,
      tiempo_maximo: 20,
      unidad_tiempo: 'minutos',
    }, { prismaClient: prismaMock as unknown as any, usuarioId: 5 })).rejects.toThrow('El descuento solo se permite cuando el servicio está en oferta')

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})