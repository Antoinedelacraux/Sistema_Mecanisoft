/// <reference types="jest" />

import { listarVehiculos, crearVehiculo } from '@/lib/vehiculos/service'
import { VehiculoServiceError } from '@/lib/vehiculos/errors'

jest.mock('@/lib/bitacora/log-event', () => jest.fn())

const logEvent = jest.requireMock('@/lib/bitacora/log-event') as jest.Mock

describe('lib/vehiculos/service', () => {
  const prismaMock = {
    vehiculo: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cliente: {
      findUnique: jest.fn(),
    },
    modelo: {
      findUnique: jest.fn(),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lista vehículos aplicando filtros y paginación', async () => {
    prismaMock.vehiculo.findMany.mockResolvedValue([{ id_vehiculo: 1 }])
    prismaMock.vehiculo.count.mockResolvedValue(5)

    const resultado = await listarVehiculos({
      page: 2,
      limit: 5,
      search: 'abc',
      clienteId: 10,
    }, { prismaClient: prismaMock as unknown as any })

    expect(prismaMock.vehiculo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id_cliente: 10,
        OR: expect.any(Array),
      }),
      skip: 5,
      take: 5,
    }))
    expect(prismaMock.vehiculo.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id_cliente: 10 }),
    }))
    expect(resultado.pagination).toEqual({ total: 5, pages: 1, current: 2, limit: 5 })
  })

  it('crea vehículos normalizando datos y registrando bitácora', async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ estatus: true, persona: { nombre: 'Test' } })
    prismaMock.vehiculo.findUnique.mockResolvedValue(null)
    prismaMock.modelo.findUnique.mockResolvedValue({ id_modelo: 3, nombre_modelo: 'Corolla', marca: { nombre_marca: 'Toyota' } })
    const vehiculoCreado = { id_vehiculo: 1, placa: 'XYZ123' }
    prismaMock.vehiculo.create.mockResolvedValue(vehiculoCreado)

    const resultado = await crearVehiculo({
      id_cliente: '5',
      id_modelo: '3',
      placa: 'xyz123',
      tipo: 'Sedan',
      año: '2020',
      tipo_combustible: 'Gasolina',
      transmision: 'Manual',
    }, { prismaClient: prismaMock as unknown as any, usuarioId: 77 })

    expect(prismaMock.vehiculo.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        placa: 'XYZ123',
        ['año']: 2020,
      }),
    }))
    expect(resultado).toBe(vehiculoCreado)
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 77,
      accion: 'CREATE_VEHICULO',
    }))
  })

  it('evita duplicados de placa', async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ estatus: true, persona: {} })
    prismaMock.vehiculo.findUnique.mockResolvedValueOnce({ id_vehiculo: 99 })

    await expect(crearVehiculo({
      id_cliente: '1',
      id_modelo: '2',
      placa: 'AAA111',
      tipo: 'SUV',
      año: '2021',
      tipo_combustible: 'Diesel',
      transmision: 'Automatica',
    }, { prismaClient: prismaMock as unknown as any, usuarioId: 10 })).rejects.toThrow('Ya existe un vehículo con esta placa')

    expect(prismaMock.modelo.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.vehiculo.create).not.toHaveBeenCalled()
  })
})