import { Prisma } from '@prisma/client'

const DECIMAL_ZERO = new Prisma.Decimal(0)

const toEnteroSeguro = (valor: Prisma.Decimal) => {
  const numero = Number(valor.toString())
  if (!Number.isFinite(numero)) {
    return 0
  }
  const redondeado = Math.round(numero)
  return redondeado < 0 ? 0 : redondeado
}

export const syncProductoStock = async (tx: Prisma.TransactionClient, productoId: number) => {
  const [inventarioBasico, inventarioAvanzado] = await Promise.all([
    tx.inventario.findUnique({
      where: { id_producto: productoId },
      select: { stock_disponible: true },
    }),
    tx.inventarioProducto.aggregate({
      where: { id_producto: productoId },
      _sum: { stock_disponible: true },
    }),
  ])

  const stockBasico = inventarioBasico?.stock_disponible ?? DECIMAL_ZERO
  const stockAvanzado = inventarioAvanzado._sum.stock_disponible ?? DECIMAL_ZERO
  const total = stockBasico.add(stockAvanzado)

  await tx.producto.update({
    where: { id_producto: productoId },
    data: { stock: toEnteroSeguro(total) },
  })
}
