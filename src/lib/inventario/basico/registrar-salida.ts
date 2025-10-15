import { Prisma, MovimientoBasicoTipo } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { actualizarProductoStock, validarProductoActivo } from './common'
import { InventarioBasicoError } from './errors'
import { decimalToString, ensurePositiveDecimal, toDecimal } from './normalizers'
import type { MovimientoBasicoResultado, RegistrarSalidaPayload } from './types'

type TxClient = Prisma.TransactionClient

const sanitizeReferencia = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, 120)
}

const buildBitacoraDescripcion = (productoId: number, cantidad: Prisma.Decimal, referencia: string | null) => {
  const base = `Salida manual de inventario para producto ${productoId} por ${cantidad.toString()} unidades`
  return referencia ? `${base}. Referencia: ${referencia}` : base
}

const ejecutarSalida = async (tx: TxClient, payload: RegistrarSalidaPayload): Promise<MovimientoBasicoResultado> => {
  const cantidad = toDecimal(payload.cantidad)
  ensurePositiveDecimal(cantidad, 'La cantidad a descontar debe ser mayor a cero')

  const referencia = sanitizeReferencia(payload.referencia)

  await validarProductoActivo(tx, payload.id_producto)

  const inventario = await tx.inventario.findUnique({ where: { id_producto: payload.id_producto } })

  if (!inventario || inventario.stock_disponible.lt(cantidad)) {
    throw new InventarioBasicoError('No hay stock suficiente para registrar la salida', 409, 'STOCK_INSUFICIENTE')
  }

  const nuevoStock = inventario.stock_disponible.sub(cantidad)

  await tx.inventario.update({
    where: { id_inventario: inventario.id_inventario },
    data: { stock_disponible: nuevoStock },
  })

  await actualizarProductoStock(tx, payload.id_producto)

  const movimiento = await tx.movimiento.create({
    data: {
      tipo: MovimientoBasicoTipo.SALIDA,
      id_producto: payload.id_producto,
      cantidad,
      costo_unitario: inventario.costo_promedio,
      referencia,
      id_usuario: payload.id_usuario,
    },
  })

  await tx.bitacora.create({
    data: {
      id_usuario: payload.id_usuario,
      accion: 'INVENTARIO_SALIDA',
      descripcion: buildBitacoraDescripcion(payload.id_producto, cantidad, referencia),
      tabla: 'inventario',
    },
  })

  return {
    movimientoId: movimiento.id_movimiento,
    id_producto: payload.id_producto,
    tipo: movimiento.tipo,
    cantidad: decimalToString(cantidad),
    stock_disponible: decimalToString(nuevoStock),
    referencia,
  }
}

export const registrarSalidaEnTx = async (tx: TxClient, payload: RegistrarSalidaPayload): Promise<MovimientoBasicoResultado> => {
  return ejecutarSalida(tx, payload)
}

export const registrarSalida = async (payload: RegistrarSalidaPayload): Promise<MovimientoBasicoResultado> => {
  return prisma.$transaction(async (tx) => ejecutarSalida(tx, payload))
}
