/// <reference types="jest" />

import { prepararContextoCreacion } from '@/lib/ordenes/crear/validaciones'
import { OrdenServiceError } from '@/lib/ordenes/errors'

const buildPrismaMock = () => {
  const prisma = {
    cliente: {
      findUnique: jest.fn().mockResolvedValue({
        id_cliente: 10,
        id_persona: 40,
        estatus: true,
        persona: { nombre: 'Juan', apellido_paterno: 'Pérez' },
      }),
    },
    vehiculo: {
      findUnique: jest.fn().mockResolvedValue({
        id_vehiculo: 20,
        id_cliente: 10,
        modelo: { marca: { nombre_marca: 'Marca' } },
      }),
    },
    trabajador: {
      findUnique: jest.fn(),
    },
    almacen: {
      findFirst: jest.fn().mockResolvedValue({ id_almacen: 1 }),
    },
    producto: {
      findMany: jest.fn().mockResolvedValue([{
        id_producto: 201,
        estatus: true,
        stock: 5,
        nombre: 'Filtro',
      }]),
    },
    servicio: {
      findMany: jest.fn().mockResolvedValue([{
        id_servicio: 101,
        estatus: true,
        tiempo_minimo: 1,
        tiempo_maximo: 2,
        unidad_tiempo: 'horas',
        nombre: 'Diagnóstico',
      }]),
    },
  }

  return prisma
}

describe('prepararContextoCreacion', () => {
  it('retorna items validados y totales calculados', async () => {
    const prisma = buildPrismaMock()

    const contexto = await prepararContextoCreacion(prisma as never, {
      id_cliente: '10',
      id_vehiculo: '20',
      items: [
        {
          id_producto: '101',
          cantidad: '1',
          precio_unitario: '100',
          tipo: 'servicio',
        },
      ],
    })

    expect(contexto.subtotal).toBe(100)
    expect(contexto.totalMinutosMin).toBe(60)
    expect(contexto.totalMinutosMax).toBe(120)
    expect(contexto.itemsValidados).toHaveLength(1)
    expect(contexto.itemsValidados[0]).toMatchObject({ tipo: 'servicio', id_servicio: 101 })
  })

  it('lanza error cuando un servicio tiene múltiples productos asociados', async () => {
    const prisma = buildPrismaMock()

    await expect(prepararContextoCreacion(prisma as never, {
      id_cliente: '10',
      id_vehiculo: '20',
      items: [
        { id_producto: '101', cantidad: '1', precio_unitario: '50', tipo: 'servicio' },
        { id_producto: '201', cantidad: '1', precio_unitario: '10', tipo: 'producto', servicio_ref: '101' },
        { id_producto: '201', cantidad: '1', precio_unitario: '10', tipo: 'producto', servicio_ref: '101' },
      ],
    })).rejects.toThrow(OrdenServiceError)
  })
})
