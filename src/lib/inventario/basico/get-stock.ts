import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { InventarioBasicoError } from './errors'
import { decimalToString } from './normalizers'
import type { StockDetalle } from './types'

type TxClient = Prisma.TransactionClient

const ensureProductoExiste = async (tx: TxClient, productoId: number) => {
  const producto = await tx.producto.findUnique({
    where: { id_producto: productoId },
    select: { estatus: true },
  })

  if (!producto) {
    throw new InventarioBasicoError('El producto indicado no existe', 404, 'PRODUCTO_NO_ENCONTRADO')
  }

  if (!producto.estatus) {
    throw new InventarioBasicoError('El producto indicado está inactivo', 409, 'PRODUCTO_INACTIVO')
  }
}

export const getStock = async (productoId: number): Promise<StockDetalle> => {
  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new InventarioBasicoError('El identificador de producto es inválido', 422, 'PRODUCTO_ID_INVALIDO')
  }

  return prisma.$transaction(async (tx) => {
    await ensureProductoExiste(tx, productoId)

    const inventario = await tx.inventario.findUnique({
      where: { id_producto: productoId },
    })

    const movimientos = await tx.movimiento.findMany({
      where: { id_producto: productoId },
      orderBy: { creado_en: 'desc' },
      take: 15,
    })

    const inventarioSerializado = inventario
      ? {
          id_producto: inventario.id_producto,
          stock_disponible: decimalToString(inventario.stock_disponible),
          stock_comprometido: decimalToString(inventario.stock_comprometido),
          costo_promedio: decimalToString(inventario.costo_promedio),
          actualizado_en: inventario.actualizado_en.toISOString(),
        }
      : {
          id_producto: productoId,
          stock_disponible: '0',
          stock_comprometido: '0',
          costo_promedio: '0',
          actualizado_en: new Date(0).toISOString(),
        }

    return {
      inventario: inventarioSerializado,
      movimientos: movimientos.map((movimiento) => ({
        id_movimiento: movimiento.id_movimiento,
        tipo: movimiento.tipo,
        cantidad: decimalToString(movimiento.cantidad),
        costo_unitario: movimiento.costo_unitario ? decimalToString(movimiento.costo_unitario) : null,
        referencia: movimiento.referencia ?? null,
        creado_en: movimiento.creado_en.toISOString(),
      })),
    }
  })
}
