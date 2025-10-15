/// <reference types="jest" />

import { Prisma } from '@prisma/client'

import { registrarSalida, registrarAjuste, InventarioBasicoError } from '@/lib/inventario/basico'

type InventarioRecord = {
  id_inventario: number
  id_producto: number
  stock_disponible: Prisma.Decimal
  stock_comprometido: Prisma.Decimal
  costo_promedio: Prisma.Decimal
  creado_en: Date
  actualizado_en: Date
}

type MovimientoRecord = {
  id_movimiento: number
  tipo: string
}

type TransactionClientMock = {
  producto: {
    findUnique: jest.Mock<Promise<{ estatus: boolean } | null>, [unknown?]>;
    update: jest.Mock<Promise<unknown>, [unknown?]>;
  };
  inventario: {
    findUnique: jest.Mock<Promise<InventarioRecord | null>, [unknown?]>
    create: jest.Mock<Promise<InventarioRecord>, [unknown?]>
    update: jest.Mock<Promise<InventarioRecord>, [unknown]>
  }
  inventarioProducto: {
    aggregate: jest.Mock<Promise<{ _sum: { stock_disponible: Prisma.Decimal | null } }>, [unknown?]>;
  }
  movimiento: { create: jest.Mock<Promise<MovimientoRecord>, [unknown]> }
  bitacora: { create: jest.Mock<Promise<unknown>, [unknown]> }
}

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown>, [(tx: TransactionClientMock) => unknown | Promise<unknown>]>
  __tx: TransactionClientMock
}

jest.mock('@/lib/prisma', () => {
  const transactionClient: TransactionClientMock = {
    producto: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    inventario: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventarioProducto: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { stock_disponible: new Prisma.Decimal(0) } }),
    },
    movimiento: { create: jest.fn() },
    bitacora: { create: jest.fn() },
  }

  const prismaMock: PrismaMock = {
    $transaction: jest.fn(async (callback) => callback(transactionClient)),
    __tx: transactionClient,
  }

  return { prisma: prismaMock }
})

const getMocks = () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }
  return { prisma, tx: prisma.__tx }
}

describe('Movimientos manuales (inventario básico)', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks()
    jest.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(tx))
    tx.producto.update.mockResolvedValue(undefined)
    tx.inventarioProducto.aggregate.mockResolvedValue({ _sum: { stock_disponible: new Prisma.Decimal(0) } })
  })

  it('registra una salida descontando el stock y generando bitácora', async () => {
    const { tx } = getMocks()

    const inventarioActual: InventarioRecord = {
      id_inventario: 1,
      id_producto: 10,
      stock_disponible: new Prisma.Decimal('8'),
      stock_comprometido: new Prisma.Decimal('0'),
      costo_promedio: new Prisma.Decimal('12'),
      creado_en: new Date(),
      actualizado_en: new Date(),
    }

    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue(inventarioActual)
    tx.inventario.update.mockResolvedValue({ ...inventarioActual, stock_disponible: new Prisma.Decimal('5') })
    tx.movimiento.create.mockResolvedValue({ id_movimiento: 99, tipo: 'SALIDA' })
    tx.bitacora.create.mockResolvedValue({})

    const resultado = await registrarSalida({
      id_producto: 10,
      id_usuario: 7,
      cantidad: '3',
      referencia: 'orden:45',
    })

    expect(resultado).toEqual({
      movimientoId: 99,
      id_producto: 10,
      tipo: 'SALIDA',
      cantidad: '3',
      stock_disponible: '5',
      referencia: 'orden:45',
    })
    expect(tx.inventario.update).toHaveBeenCalledTimes(1)
    expect(tx.bitacora.create).toHaveBeenCalledTimes(1)
  })

  it('lanza error si la salida supera el stock disponible', async () => {
    const { tx } = getMocks()
    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue({
      id_inventario: 1,
      id_producto: 20,
      stock_disponible: new Prisma.Decimal('1'),
      stock_comprometido: new Prisma.Decimal('0'),
      costo_promedio: new Prisma.Decimal('5'),
      creado_en: new Date(),
      actualizado_en: new Date(),
    })

    await expect(
      registrarSalida({ id_producto: 20, id_usuario: 1, cantidad: '2' }),
    ).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' })
  })

  it('crea inventario cuando el ajuste positivo no encuentra registro previo', async () => {
    const { tx } = getMocks()

    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue(null)
    tx.inventario.create.mockResolvedValue({
      id_inventario: 5,
      id_producto: 30,
      stock_disponible: new Prisma.Decimal('4'),
      stock_comprometido: new Prisma.Decimal('0'),
      costo_promedio: new Prisma.Decimal('0'),
      creado_en: new Date(),
      actualizado_en: new Date(),
    })
    tx.movimiento.create.mockResolvedValue({ id_movimiento: 101, tipo: 'AJUSTE' })
    tx.bitacora.create.mockResolvedValue({})

    const resultado = await registrarAjuste({
      id_producto: 30,
      id_usuario: 2,
      cantidad: '4',
      motivo: 'Inventario inicial',
      esIncremento: true,
    })

    expect(resultado).toMatchObject({
      movimientoId: 101,
      id_producto: 30,
      tipo: 'AJUSTE',
      cantidad: '4',
      stock_disponible: '4',
      referencia: 'Inventario inicial',
    })
    expect(tx.inventario.create).toHaveBeenCalledTimes(1)
  })

  it('resta stock en un ajuste negativo y lanza error si no alcanza', async () => {
    const { tx } = getMocks()

    const inventarioActual: InventarioRecord = {
      id_inventario: 2,
      id_producto: 40,
      stock_disponible: new Prisma.Decimal('6'),
      stock_comprometido: new Prisma.Decimal('0'),
      costo_promedio: new Prisma.Decimal('11.5'),
      creado_en: new Date(),
      actualizado_en: new Date(),
    }

    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue(inventarioActual)
    tx.inventario.update.mockResolvedValue({ ...inventarioActual, stock_disponible: new Prisma.Decimal('3') })
    tx.movimiento.create.mockResolvedValue({ id_movimiento: 202, tipo: 'AJUSTE' })
    tx.bitacora.create.mockResolvedValue({})

    const resultado = await registrarAjuste({
      id_producto: 40,
      id_usuario: 9,
      cantidad: '3',
      motivo: 'Merma',
      esIncremento: false,
    })

    expect(resultado).toEqual({
      movimientoId: 202,
      id_producto: 40,
      tipo: 'AJUSTE',
      cantidad: '-3',
      stock_disponible: '3',
      referencia: 'Merma',
    })

    await expect(
      registrarAjuste({ id_producto: 40, id_usuario: 9, cantidad: '20', motivo: 'Error', esIncremento: false }),
    ).rejects.toBeInstanceOf(InventarioBasicoError)
  })
})
