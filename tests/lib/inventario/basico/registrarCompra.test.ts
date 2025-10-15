/// <reference types="jest" />

import { Prisma } from '@prisma/client'

import { registrarCompra, InventarioBasicoError } from '@/lib/inventario/basico'

type InventarioRecord = {
  id_inventario: number
  id_producto: number
  stock_disponible: Prisma.Decimal
  stock_comprometido: Prisma.Decimal
  costo_promedio: Prisma.Decimal
  creado_en: Date
  actualizado_en: Date
}

type CompraRecord = {
  id_compra: number
}

type TransactionClientMock = {
  proveedor: { findUnique: jest.Mock<Promise<{ id_proveedor: number; estatus: boolean } | null>, [unknown?]> }
  producto: { findUnique: jest.Mock<Promise<{ estatus: boolean } | null>, [unknown?]> }
  inventario: {
    findUnique: jest.Mock<Promise<InventarioRecord | null>, [unknown?]>
    create: jest.Mock<Promise<InventarioRecord>, [unknown]>
    update: jest.Mock<Promise<InventarioRecord>, [unknown]>
  }
  compra: { create: jest.Mock<Promise<CompraRecord>, [unknown]> }
  movimiento: { create: jest.Mock<Promise<unknown>, [unknown]> }
  bitacora: { create: jest.Mock<Promise<unknown>, [unknown]> }
}

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown>, [(tx: TransactionClientMock) => unknown | Promise<unknown>]>
  __tx: TransactionClientMock
}

jest.mock('@/lib/prisma', () => {
  const transactionClient: TransactionClientMock = {
    proveedor: { findUnique: jest.fn() },
    producto: { findUnique: jest.fn() },
    inventario: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    compra: { create: jest.fn() },
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

describe('registrarCompra (inventario básico)', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks()
    jest.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(tx))
  })

  it('registra una compra y actualiza inventario generando movimientos', async () => {
    const { tx } = getMocks()

    tx.proveedor.findUnique.mockResolvedValue({ id_proveedor: 99, estatus: true })
    tx.producto.findUnique.mockResolvedValue({ estatus: true })
    tx.inventario.findUnique.mockResolvedValue(null)

    const inventarioCreado: InventarioRecord = {
      id_inventario: 1,
      id_producto: 1,
      stock_disponible: new Prisma.Decimal(0),
      stock_comprometido: new Prisma.Decimal(0),
      costo_promedio: new Prisma.Decimal(0),
      creado_en: new Date(),
      actualizado_en: new Date(),
    }

    tx.inventario.create.mockResolvedValue(inventarioCreado)
    tx.compra.create.mockResolvedValue({ id_compra: 555 })
    tx.movimiento.create.mockResolvedValue({})
    tx.bitacora.create.mockResolvedValue({})

    const resultado = await registrarCompra({
      id_proveedor: 99,
      creado_por: 42,
      lineas: [
        { id_producto: 1, cantidad: '5', precio_unitario: '10.5' },
        { id_producto: 2, cantidad: 3, precio_unitario: 12 },
      ],
    })

  expect(resultado).toEqual({ compraId: 555, total: '88.5', totalLineas: 2 })
    expect(tx.compra.create).toHaveBeenCalledTimes(1)
    expect(tx.movimiento.create).toHaveBeenCalledTimes(2)
    expect(tx.bitacora.create).toHaveBeenCalledTimes(1)
  })

  it('lanza error cuando se repite un producto en las líneas', async () => {
    await expect(
      registrarCompra({
        id_proveedor: 10,
        creado_por: 1,
        lineas: [
          { id_producto: 1, cantidad: 2, precio_unitario: 5 },
          { id_producto: 1, cantidad: 1, precio_unitario: 6 },
        ],
      }),
    ).rejects.toBeInstanceOf(InventarioBasicoError)
  })

  it('lanza error si el proveedor no existe', async () => {
    const { tx } = getMocks()
    tx.proveedor.findUnique.mockResolvedValue(null)

    await expect(
      registrarCompra({
        id_proveedor: 777,
        creado_por: 1,
        lineas: [{ id_producto: 1, cantidad: 1, precio_unitario: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'PROVEEDOR_NO_ENCONTRADO' })
  })
})
