import { Prisma, MovimientoBasicoTipo } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { actualizarProductoStock, validarProductoActivo } from './common'
import { InventarioBasicoError } from './errors'
import { DECIMAL_ZERO, decimalToString, ensurePositiveDecimal, toDecimal } from './normalizers'
import type { MovimientoBasicoResultado, RegistrarAjustePayload } from './types'

const sanitizeMotivo = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length < 3) {
    throw new InventarioBasicoError('El motivo del ajuste debe tener al menos 3 caracteres', 422, 'MOTIVO_INVALIDO')
  }
  return trimmed.slice(0, 120)
}

const buildBitacoraDescripcion = (
  productoId: number,
  cantidad: Prisma.Decimal,
  esIncremento: boolean,
  motivo: string,
) => {
  const tipo = esIncremento ? 'incremento' : 'disminución'
  return `Ajuste manual (${tipo}) para producto ${productoId} por ${cantidad.toString()} unidades. Motivo: ${motivo}`
}

export const registrarAjuste = async (payload: RegistrarAjustePayload): Promise<MovimientoBasicoResultado> => {
  const cantidadAbsoluta = toDecimal(payload.cantidad)
  ensurePositiveDecimal(cantidadAbsoluta, 'La cantidad del ajuste debe ser mayor a cero')

  const motivo = sanitizeMotivo(payload.motivo)

  return prisma.$transaction(async (tx) => {
    await validarProductoActivo(tx, payload.id_producto)

    const inventarioExistente = await tx.inventario.findUnique({ where: { id_producto: payload.id_producto } })

    if (!payload.esIncremento) {
      if (!inventarioExistente || inventarioExistente.stock_disponible.lt(cantidadAbsoluta)) {
        throw new InventarioBasicoError('No hay stock suficiente para aplicar el ajuste negativo', 409, 'STOCK_INSUFICIENTE')
      }
    }

    let nuevoStock: Prisma.Decimal

    if (!inventarioExistente) {
      const creado = await tx.inventario.create({
        data: {
          id_producto: payload.id_producto,
          stock_disponible: cantidadAbsoluta,
          stock_comprometido: DECIMAL_ZERO,
          costo_promedio: DECIMAL_ZERO,
        },
      })
      nuevoStock = creado.stock_disponible
    } else {
      nuevoStock = payload.esIncremento
        ? inventarioExistente.stock_disponible.add(cantidadAbsoluta)
        : inventarioExistente.stock_disponible.sub(cantidadAbsoluta)

      await tx.inventario.update({
        where: { id_inventario: inventarioExistente.id_inventario },
        data: { stock_disponible: nuevoStock },
      })
    }

    await actualizarProductoStock(tx, payload.id_producto)

    const cantidadMovimiento = payload.esIncremento ? cantidadAbsoluta : cantidadAbsoluta.mul(-1)

    const movimiento = await tx.movimiento.create({
      data: {
        tipo: MovimientoBasicoTipo.AJUSTE,
        id_producto: payload.id_producto,
        cantidad: cantidadMovimiento,
        costo_unitario: inventarioExistente?.costo_promedio ?? null,
        referencia: motivo,
        id_usuario: payload.id_usuario,
      },
    })

    await tx.bitacora.create({
      data: {
        id_usuario: payload.id_usuario,
        accion: 'INVENTARIO_AJUSTE',
        descripcion: buildBitacoraDescripcion(payload.id_producto, cantidadMovimiento, payload.esIncremento, motivo),
        tabla: 'inventario',
      },
    })

    return {
      movimientoId: movimiento.id_movimiento,
      id_producto: payload.id_producto,
      tipo: movimiento.tipo,
      cantidad: decimalToString(cantidadMovimiento),
      stock_disponible: decimalToString(nuevoStock),
      referencia: motivo,
    }
  })
}
