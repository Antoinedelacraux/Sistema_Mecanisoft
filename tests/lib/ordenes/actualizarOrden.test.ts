/// <reference types="jest" />

import { actualizarOrden } from '@/lib/ordenes/actualizar'
import { OrdenServiceError } from '@/lib/ordenes/errors'
import { calcularProgresoOrden } from '@/lib/ordenes/helpers'
import { reservarStockEnTx } from '@/lib/inventario/reservas'

jest.mock('@/lib/inventario/reservas', () => ({
  reservarStockEnTx: jest.fn().mockResolvedValue(undefined),
  liberarReservaEnTx: jest.fn().mockResolvedValue(undefined),
  confirmarReservaEnTx: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/ordenes/helpers', () => {
  const actual = jest.requireActual('@/lib/ordenes/helpers')
  return {
    ...actual,
    calcularProgresoOrden: jest.fn().mockResolvedValue({
      total: 3,
      pendientes: 1,
      en_proceso: 1,
      completadas: 1,
      verificadas: 0,
      porcentaje: 50,
    }),
  }
})

const reservarStockEnTxMock = reservarStockEnTx as jest.MockedFunction<typeof reservarStockEnTx>
const calcularProgresoOrdenMock = calcularProgresoOrden as jest.MockedFunction<typeof calcularProgresoOrden>

describe('actualizarOrden', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rechaza entrada sin id_transaccion', async () => {
    await expect(actualizarOrden({} as never, {} as any, 1)).rejects.toMatchObject<Partial<OrdenServiceError>>({
      status: 400,
      message: 'Datos de entrada inválidos',
    })
  })

  it('impide editar una orden en progreso si no pasa a por_hacer', async () => {
    const prisma = {
      transaccion: {
        findUnique: jest.fn().mockResolvedValue({
          id_transaccion: 10,
          tipo_transaccion: 'orden',
          estado_orden: 'en_proceso',
        }),
      },
    }

    await expect(
      actualizarOrden(prisma as never, { id_transaccion: '10', prioridad: 'alta' }, 99)
    ).rejects.toMatchObject<Partial<OrdenServiceError>>({
      status: 403,
      message: 'Solo se puede editar órdenes en estado pendiente.',
    })
  })

  it('actualiza items en una orden pendiente y recalcula totales', async () => {
    const ordenOriginal = {
      id_transaccion: 25,
      tipo_transaccion: 'orden',
      estado_orden: 'pendiente',
      codigo_transaccion: 'ORD-2025-010',
      id_trabajador_principal: 7,
      fecha_inicio: null,
      fecha_fin_real: null,
      fecha_entrega: null,
      total: 100,
    }

    const ordenActualizada = {
      ...ordenOriginal,
      prioridad: 'alta',
      persona: { nombre: 'Cliente' },
    }

    const txMock = {
      detalleTransaccion: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue(undefined),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id_detalle_transaccion: 2001 })
          .mockResolvedValueOnce({ id_detalle_transaccion: 3001 }),
      },
      tarea: {
        deleteMany: jest.fn(),
        create: jest.fn().mockResolvedValue(undefined),
      },
      reservaInventario: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      producto: {
        update: jest.fn().mockResolvedValue(undefined),
      },
      transaccion: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    }

    const prisma = {
      transaccion: {
        findUnique: jest.fn().mockResolvedValue(ordenOriginal),
        update: jest.fn().mockResolvedValue(ordenActualizada),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([
          { id_producto: 302, estatus: true, stock: 10, nombre: 'Filtro aceite' },
        ]),
      },
      servicio: {
        findMany: jest.fn().mockResolvedValue([
          {
            id_servicio: 201,
            estatus: true,
            tiempo_minimo: 1,
            tiempo_maximo: 2,
            unidad_tiempo: 'horas',
            nombre: 'Diagnóstico',
          },
        ]),
      },
      almacen: {
        findFirst: jest.fn().mockResolvedValue({ id_almacen: 1 }),
      },
      bitacora: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn(async (cb) => cb(txMock as never)),
    }

    const input = {
      id_transaccion: '25',
      prioridad: 'alta' as const,
      items: [
        {
          id_producto: '201',
          cantidad: '1',
          precio_unitario: '120',
          tipo: 'servicio' as const,
        },
        {
          id_producto: '302',
          cantidad: '2',
          precio_unitario: '45',
          tipo: 'producto' as const,
          servicio_ref: '201',
        },
      ],
    }

    const resultado = await actualizarOrden(prisma as never, input, 55)

    expect(prisma.transaccion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_transaccion: 25 },
        data: expect.objectContaining({ prioridad: 'alta' }),
      })
    )
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.detalleTransaccion.create).toHaveBeenCalledTimes(2)
    expect(reservarStockEnTxMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        productoId: 302,
        cantidad: 2,
        motivo: expect.stringContaining('orden'),
      })
    )
    expect(calcularProgresoOrdenMock).toHaveBeenCalledWith(prisma, ordenActualizada.id_transaccion)
    expect(prisma.bitacora.create).toHaveBeenCalled()

    expect(resultado.status).toBe(200)
    expect(resultado.body).toMatchObject({
      orden: ordenActualizada,
      progreso: expect.objectContaining({ porcentaje: 50 }),
      pago: null,
    })
  })
})
