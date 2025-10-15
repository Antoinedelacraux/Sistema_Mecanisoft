/// <reference types="jest" />

import { Prisma } from '@prisma/client'

import { getStock, InventarioBasicoError } from '@/lib/inventario/basico'

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
  id_producto: number
  cantidad: Prisma.Decimal
  costo_unitario: Prisma.Decimal | null
  referencia: string | null
  id_usuario: number
  creado_en: Date
}

type TransactionClientMock = {
  producto: { findUnique: jest.Mock<Promise<{ estatus: boolean } | null>, [unknown?]> }
  inventario: { findUnique: jest.Mock<Promise<InventarioRecord | null>, [unknown?]> }
  movimiento: { findMany: jest.Mock<Promise<MovimientoRecord[]>, [unknown?]> }
}

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown>, [(tx: TransactionClientMock) => unknown | Promise<unknown>]>
  __tx: TransactionClientMock
}

jest.mock('@/lib/prisma', () => {
  const transactionClient: TransactionClientMock = {
    producto: { findUnique: jest.fn() },
    inventario: { findUnique: jest.fn() },
    movimiento: { findMany: jest.fn() },
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

describe('getStock (inventario básico)', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks()
    jest.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(tx))
  })

  it('retorna stock y movimientos serializados', async () => {
    const { tx } = getMocks()

    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue({
      id_inventario: 1,
      id_producto: 10,
      stock_disponible: new Prisma.Decimal('12.5'),
      stock_comprometido: new Prisma.Decimal('2'),
      costo_promedio: new Prisma.Decimal('8.75'),
      creado_en: new Date('2025-01-01T00:00:00.000Z'),
      actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
    })
    tx.movimiento.findMany.mockResolvedValue([
      {
        id_movimiento: 1,
        tipo: 'INGRESO',
        id_producto: 10,
        cantidad: new Prisma.Decimal('5'),
        costo_unitario: new Prisma.Decimal('9'),
        referencia: 'compra:1',
        id_usuario: 42,
        creado_en: new Date('2025-01-02T10:00:00.000Z'),
      },
    ] as MovimientoRecord[])

    const detalle = await getStock(10)

    expect(detalle.inventario).toEqual({
      id_producto: 10,
      stock_disponible: '12.5',
      stock_comprometido: '2',
      costo_promedio: '8.75',
      actualizado_en: '2025-01-02T00:00:00.000Z',
    })
    expect(detalle.movimientos).toHaveLength(1)
    expect(detalle.movimientos[0]).toMatchObject({
      id_movimiento: 1,
      tipo: 'INGRESO',
      cantidad: '5',
      costo_unitario: '9',
      referencia: 'compra:1',
    })
  })

  it('retorna valores por defecto cuando no existe inventario', async () => {
    const { tx } = getMocks()

    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue(null)
    tx.movimiento.findMany.mockResolvedValue([])

    const detalle = await getStock(7)

    expect(detalle.inventario).toEqual({
      id_producto: 7,
      stock_disponible: '0',
      stock_comprometido: '0',
      costo_promedio: '0',
      actualizado_en: new Date(0).toISOString(),
    })
    expect(detalle.movimientos).toEqual([])
  })

  it('lanza error si el producto no existe', async () => {
    const { tx } = getMocks()
    tx.producto.findUnique.mockResolvedValue(null)

    await expect(getStock(100)).rejects.toBeInstanceOf(InventarioBasicoError)
  })
})
