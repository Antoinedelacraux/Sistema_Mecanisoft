import { TipoComprobante } from '@prisma/client'
import type { FacturacionItem, FacturacionTotales } from './types'

export const PEN = 'PEN'

export const DEFAULT_IGV_PERCENTAGE = 0.18

export function toNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '')
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'object') {
    try {
      const maybeNumber = Number((value as { valueOf?: () => unknown }).valueOf?.())
      if (Number.isFinite(maybeNumber)) return maybeNumber
    } catch {
      // ignore
    }
  }
  const fallback = Number(value)
  return Number.isFinite(fallback) ? fallback : 0
}

const roundCurrency = (value: number): number => {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

export type CalculoLineaParams = {
  cantidad: number
  precioUnitario: number
  descuento: number
  afectaIgv: boolean
  preciosIncluyenIgv: boolean
  igvPorcentaje: number
}

export type LineaCalculada = {
  subtotal: number
  igv: number
  total: number
}

export function calcularLinea({
  cantidad,
  precioUnitario,
  descuento,
  afectaIgv,
  preciosIncluyenIgv,
  igvPorcentaje
}: CalculoLineaParams): LineaCalculada {
  const cantidadSegura = Number.isFinite(cantidad) ? cantidad : 0
  const unitarioSeguro = Number.isFinite(precioUnitario) ? precioUnitario : 0
  const descuentoSeguro = Number.isFinite(descuento) ? descuento : 0

  const importeBruto = roundCurrency(cantidadSegura * unitarioSeguro)
  const importeDescontado = roundCurrency(importeBruto - descuentoSeguro)
  if (!afectaIgv) {
    const total = Math.max(importeDescontado, 0)
    return {
      subtotal: roundCurrency(total),
      igv: 0,
      total: roundCurrency(total)
    }
  }

  const porcentaje = Number.isFinite(igvPorcentaje) ? igvPorcentaje : DEFAULT_IGV_PERCENTAGE
  const factor = 1 + porcentaje
  if (preciosIncluyenIgv) {
    const total = Math.max(importeDescontado, 0)
    const subtotal = roundCurrency(total / factor)
    const igv = roundCurrency(total - subtotal)
    return { subtotal, igv, total: roundCurrency(total) }
  }

  const subtotal = Math.max(importeDescontado, 0)
  const igv = roundCurrency(subtotal * porcentaje)
  const total = roundCurrency(subtotal + igv)
  return { subtotal: roundCurrency(subtotal), igv, total }
}

export type CalculoTotalesParams = {
  items: Omit<FacturacionItem, 'subtotal' | 'igv' | 'total'>[]
  afectaIgv: boolean
  preciosIncluyenIgv: boolean
  igvPorcentaje: number
}

export type CalculoTotalesResultado = {
  items: FacturacionItem[]
  totales: FacturacionTotales
}

export function calcularTotales({
  items,
  afectaIgv,
  preciosIncluyenIgv,
  igvPorcentaje
}: CalculoTotalesParams): CalculoTotalesResultado {
  const calculados: FacturacionItem[] = items.map((item) => {
    const linea = calcularLinea({
      cantidad: toNumber(item.cantidad),
      precioUnitario: toNumber(item.precio_unitario),
      descuento: toNumber(item.descuento),
      afectaIgv,
      preciosIncluyenIgv,
      igvPorcentaje
    })

    return {
      ...item,
      cantidad: toNumber(item.cantidad),
      precio_unitario: toNumber(item.precio_unitario),
      descuento: toNumber(item.descuento),
      subtotal: linea.subtotal,
      igv: linea.igv,
      total: linea.total
    }
  })

  const subtotal = roundCurrency(
    calculados.reduce((sum, item) => sum + toNumber(item.subtotal), 0)
  )
  const igv = roundCurrency(
    calculados.reduce((sum, item) => sum + toNumber(item.igv), 0)
  )
  const total = roundCurrency(
    calculados.reduce((sum, item) => sum + toNumber(item.total), 0)
  )

  return {
    items: calculados,
    totales: {
      subtotal,
      igv,
      total,
      precios_incluyen_igv: preciosIncluyenIgv
    }
  }
}

export type TipoComprobanteParams = {
  documento: string | null | undefined
  tieneEmpresa: boolean
  tipoSolicitado?: TipoComprobante | null
}

export function inferirTipoComprobante({
  documento,
  tieneEmpresa,
  tipoSolicitado
}: TipoComprobanteParams): TipoComprobante {
  if (tipoSolicitado) return tipoSolicitado
  const doc = (documento ?? '').trim()
  if (tieneEmpresa) return 'FACTURA'
  if (doc.length === 11) return 'FACTURA'
  return 'BOLETA'
}
