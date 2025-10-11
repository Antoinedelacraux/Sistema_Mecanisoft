/// <reference types="jest" />

import { crearOrden } from '@/lib/ordenes/crear'
import { OrdenServiceError } from '@/lib/ordenes/errors'

jest.mock('@/lib/inventario/reservas', () => ({
	reservarStockEnTx: jest.fn().mockResolvedValue(undefined),
	liberarReservaEnTx: jest.fn(),
	confirmarReservaEnTx: jest.fn(),
}))

const buildPrismaMock = () => {
	const transaccionCreada = {
		id_transaccion: 123,
		codigo_transaccion: 'ORD-2025-001',
		fecha_fin_estimada: null,
	}
	const txMock = {
		transaccion: {
			create: jest.fn().mockResolvedValue(transaccionCreada),
		},
		transaccionVehiculo: {
			create: jest.fn().mockResolvedValue(undefined),
		},
		transaccionTrabajador: {
			create: jest.fn().mockResolvedValue(undefined),
		},
		detalleTransaccion: {
			create: jest.fn().mockResolvedValue({ id_detalle_transaccion: 999 }),
		},
		tarea: {
			create: jest.fn().mockResolvedValue(undefined),
		},
		producto: {
			update: jest.fn().mockResolvedValue(undefined),
		},
	}

	const prisma = {
		transaccion: {
			findFirst: jest.fn().mockResolvedValue(null),
			findUnique: jest.fn().mockResolvedValue({
				id_transaccion: transaccionCreada.id_transaccion,
				persona: { nombre: 'Juan', apellido_paterno: 'Perez' },
				trabajador_principal: null,
				transaccion_vehiculos: [],
				detalles_transaccion: [],
				_count: { detalles_transaccion: 0 },
			}),
		},
		cliente: {
			findUnique: jest.fn().mockResolvedValue({
				id_cliente: 10,
				id_persona: 77,
				estatus: true,
				persona: { nombre: 'Juan', apellido_paterno: 'Perez' },
			}),
		},
		vehiculo: {
			findUnique: jest.fn().mockResolvedValue({
				id_vehiculo: 20,
				id_cliente: 10,
				modelo: { marca: {} },
			}),
		},
		trabajador: {
			findUnique: jest.fn().mockResolvedValue({ id_trabajador: 30, activo: true }),
		},
		almacen: {
			findFirst: jest.fn().mockResolvedValue({ id_almacen: 1 }),
		},
		producto: {
			findMany: jest.fn().mockResolvedValue([]),
		},
		servicio: {
			findMany: jest.fn().mockResolvedValue([
				{
					id_servicio: 101,
					estatus: true,
					tiempo_minimo: 1,
					tiempo_maximo: 2,
					unidad_tiempo: 'horas',
					nombre: 'Diagnóstico',
				},
			]),
		},
		bitacora: {
			create: jest.fn().mockResolvedValue(undefined),
		},
		detalleTransaccion: {
			findMany: jest.fn().mockResolvedValue([{ tareas: [] }]),
		},
		$transaction: jest.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
	}

	return { prisma, txMock, transaccionCreada }
}

describe('crearOrden', () => {
  it('lanza error cuando modo solo servicios incluye producto', async () => {
    const { prisma } = buildPrismaMock()

    const input = {
      id_cliente: '10',
      id_vehiculo: '20',
      id_trabajador_principal: '30',
      modo_orden: 'solo_servicios' as const,
      items: [
        {
          id_producto: '200',
          cantidad: '1',
          precio_unitario: '15',
          tipo: 'producto' as const,
        },
      ],
    }

    await expect(crearOrden(prisma as never, input, 99)).rejects.toMatchObject<Partial<OrdenServiceError>>({
      status: 400,
      message: 'Modo Solo servicios activo: no se permiten productos en la orden.',
    })
  })

  it('crea orden y devuelve resumen con totales', async () => {
    const { prisma, txMock, transaccionCreada } = buildPrismaMock()

    const input = {
      id_cliente: '10',
      id_vehiculo: '20',
      id_trabajador_principal: '30',
      prioridad: 'alta' as const,
      observaciones: 'Chequeo completo',
      items: [
        {
          id_producto: '101',
          cantidad: '1',
          precio_unitario: '100',
          tipo: 'servicio' as const,
        },
      ],
    }

    const resultado = await crearOrden(prisma as never, input, 99)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.transaccion.create).toHaveBeenCalledTimes(1)
    expect(prisma.bitacora.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accion: 'CREATE_ORDEN' }),
    }))

    expect(resultado.status).toBe(201)
    const body = resultado.body as {
      resumen: {
        total: number
        impuesto: number
        tiempo_estimado_min: number
        tiempo_estimado_max: number
      }
    }
    expect(body.resumen.total).toBe(118)
    expect(body.resumen.impuesto).toBe(18)
    expect(body.resumen.tiempo_estimado_min).toBe(60)
    expect(body.resumen.tiempo_estimado_max).toBe(120)

		expect(prisma.transaccion.findUnique).toHaveBeenCalledWith({
			where: { id_transaccion: transaccionCreada.id_transaccion },
			include: expect.any(Object),
		})
		})
	})