import { Prisma } from '@prisma/client'

import { InventarioBasicoError } from './errors'
import { syncProductoStock } from '../sync-producto-stock'

export type TxClient = Prisma.TransactionClient

export const validarProveedorActivo = async (tx: TxClient, proveedorId: number) => {
  const proveedor = await tx.proveedor.findUnique({
    where: { id_proveedor: proveedorId },
    select: { id_proveedor: true, estatus: true },
  })

  if (!proveedor) {
    throw new InventarioBasicoError('El proveedor indicado no existe', 404, 'PROVEEDOR_NO_ENCONTRADO')
  }

  if (!proveedor.estatus) {
    throw new InventarioBasicoError('El proveedor indicado está inactivo', 409, 'PROVEEDOR_INACTIVO')
  }
}

export const validarProductoActivo = async (tx: TxClient, productoId: number) => {
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

export const actualizarProductoStock = async (tx: TxClient, productoId: number) => {
  await syncProductoStock(tx, productoId)
}
