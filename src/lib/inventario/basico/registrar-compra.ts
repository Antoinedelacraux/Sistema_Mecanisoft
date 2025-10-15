import { Prisma, MovimientoBasicoTipo, CompraEstado } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { InventarioBasicoError } from './errors'
import { decimalToString, ensureNotNegativeDecimal, ensurePositiveDecimal, toDecimal } from './normalizers'
import type { RegistrarCompraPayload, RegistrarCompraResultado } from './types'
import { actualizarProductoStock, validarProductoActivo, validarProveedorActivo } from './common'

type PrismaTx = Prisma.TransactionClient

const DECIMAL_ZERO = new Prisma.Decimal(0)

const prepararLineas = (lineas: RegistrarCompraPayload['lineas']) => {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new InventarioBasicoError('La compra debe tener al menos una línea', 422, 'LINEAS_VACIAS')
  }

  return lineas.map((linea, index) => {
    const cantidad = toDecimal(linea.cantidad)
    const precioUnitario = toDecimal(linea.precio_unitario)

    ensurePositiveDecimal(cantidad, `La cantidad debe ser mayor a cero (línea ${index + 1})`)
    ensureNotNegativeDecimal(precioUnitario, `El precio unitario no puede ser negativo (línea ${index + 1})`)

    const subtotal = cantidad.mul(precioUnitario)

    return {
      id_producto: linea.id_producto,
      cantidad,
      precio_unitario: precioUnitario,
      subtotal,
    }
  })
}

const asegurarLineasSinDuplicados = (lineas: ReturnType<typeof prepararLineas>) => {
  const productosVistos = new Set<number>()

  for (const linea of lineas) {
    if (productosVistos.has(linea.id_producto)) {
      throw new InventarioBasicoError('No se puede repetir el mismo producto en la compra', 422, 'PRODUCTO_DUPLICADO')
    }
    productosVistos.add(linea.id_producto)
  }
}

const recalcularInventario = async (
  tx: PrismaTx,
  productoId: number,
  cantidad: Prisma.Decimal,
  costoUnitario: Prisma.Decimal,
) => {
  const inventarioExistente = await tx.inventario.findUnique({
    where: { id_producto: productoId },
  })

  if (!inventarioExistente) {
    const creado = await tx.inventario.create({
      data: {
        id_producto: productoId,
        stock_disponible: cantidad,
        stock_comprometido: DECIMAL_ZERO,
        costo_promedio: costoUnitario,
      },
    })
    await actualizarProductoStock(tx, productoId)
    return creado
  }

  const nuevoStock = inventarioExistente.stock_disponible.add(cantidad)
  const stockAnterior = inventarioExistente.stock_disponible
  const costoAnterior = inventarioExistente.costo_promedio

  const totalAnterior = stockAnterior.mul(costoAnterior)
  const totalNuevaCompra = cantidad.mul(costoUnitario)

  const nuevoCostoPromedio = nuevoStock.equals(DECIMAL_ZERO)
    ? DECIMAL_ZERO
    : totalAnterior.add(totalNuevaCompra).div(nuevoStock)
  const actualizado = await tx.inventario.update({
    where: { id_inventario: inventarioExistente.id_inventario },
    data: {
      stock_disponible: nuevoStock,
      costo_promedio: nuevoCostoPromedio,
    },
  })

  await actualizarProductoStock(tx, productoId)

  return actualizado
}

const registrarMovimientos = async (
  tx: PrismaTx,
  lineas: ReturnType<typeof prepararLineas>,
  compraId: number,
  usuarioId: number,
) => {
  const referencia = `compra:${compraId}`

  for (const linea of lineas) {
    await tx.movimiento.create({
      data: {
        tipo: MovimientoBasicoTipo.INGRESO,
        id_producto: linea.id_producto,
        cantidad: linea.cantidad,
        costo_unitario: linea.precio_unitario,
        referencia,
        id_usuario: usuarioId,
      },
    })
  }
}

const registrarBitacora = async (
  tx: PrismaTx,
  usuarioId: number,
  compraId: number,
  total: Prisma.Decimal,
  cantidadLineas: number,
) => {
  await tx.bitacora.create({
    data: {
      id_usuario: usuarioId,
      accion: 'INVENTARIO_COMPRA',
      descripcion: `Registro de compra ${compraId} con ${cantidadLineas} línea(s) por un total de ${decimalToString(total)}`,
      tabla: 'inventario',
    },
  })
}

export const registrarCompra = async (payload: RegistrarCompraPayload): Promise<RegistrarCompraResultado> => {
  const lineas = prepararLineas(payload.lineas)
  asegurarLineasSinDuplicados(lineas)

  const total = lineas.reduce((acc, linea) => acc.add(linea.subtotal), DECIMAL_ZERO)

  return prisma.$transaction(async (tx) => {
    await validarProveedorActivo(tx, payload.id_proveedor)

    for (const linea of lineas) {
      await validarProductoActivo(tx, linea.id_producto)
    }

    const compra = await tx.compra.create({
      data: {
        id_proveedor: payload.id_proveedor,
        fecha: payload.fecha ?? new Date(),
        total,
        estado: CompraEstado.RECIBIDO,
        creado_por: payload.creado_por,
        detalles: {
          create: lineas.map((linea) => ({
            id_producto: linea.id_producto,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            subtotal: linea.subtotal,
          })),
        },
      },
    })

    for (const linea of lineas) {
      await recalcularInventario(tx, linea.id_producto, linea.cantidad, linea.precio_unitario)
    }

    await registrarMovimientos(tx, lineas, compra.id_compra, payload.creado_por)
    await registrarBitacora(tx, payload.creado_por, compra.id_compra, total, lineas.length)

    return {
      compraId: compra.id_compra,
      total: decimalToString(total),
      totalLineas: lineas.length,
    }
  })
}
