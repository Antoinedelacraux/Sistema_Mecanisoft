import { addMinutes } from 'date-fns'
import type { ServicioCompleto } from '@/types'
import type { ItemCotizacion } from './types'

export const toNumber = (value: unknown): number => {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'object') {
    const candidate = value as { toString?: () => string }
    if (candidate.toString) {
      const maybe = Number(candidate.toString())
      return Number.isNaN(maybe) ? 0 : maybe
    }
  }
  const fallback = Number(value)
  return Number.isNaN(fallback) ? 0 : fallback
}

export const formatMoney = (value: unknown) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(toNumber(value))

export const calcularTotalLinea = (cantidad: number, precioUnitario: number, descuento: number) => {
  const cantidadValida = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1
  const precioValido = Number.isFinite(precioUnitario) && precioUnitario >= 0 ? precioUnitario : 0
  const descuentoValido = Number.isFinite(descuento) && descuento >= 0 ? descuento : 0
  return cantidadValida * precioValido * (1 - descuentoValido / 100)
}

export const unidadTiempoEnMinutos = (unidad: ServicioCompleto['unidad_tiempo']) => {
  switch (unidad) {
    case 'minutos':
      return 1
    case 'horas':
      return 60
    case 'dias':
      return 60 * 24
    case 'semanas':
      return 60 * 24 * 7
    default:
      return 1
  }
}

export const formatearDuracion = (minutos: number) => {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0 min'
  const total = Math.round(minutos)
  const dias = Math.floor(total / (60 * 24))
  const horas = Math.floor((total % (60 * 24)) / 60)
  const mins = total % 60
  const partes: string[] = []
  if (dias) partes.push(`${dias} d`)
  if (horas) partes.push(`${horas} h`)
  if (mins || partes.length === 0) partes.push(`${mins} min`)
  return partes.join(' ')
}

export const resumenTiempoServicios = (items: ItemCotizacion[], servicios: ServicioCompleto[]) => {
  let totalMin = 0
  let totalMax = 0
  const detalles: Array<{
    id: number
    nombre: string
    cantidad: number
    min: number
    max: number
    unidad: ServicioCompleto['unidad_tiempo']
  }> = []

  items.forEach((item) => {
    if (item.tipo !== 'servicio') return
    const servicio = servicios.find((s) => s.id_servicio === item.id_referencia)
    if (!servicio) return
    const factor = unidadTiempoEnMinutos(servicio.unidad_tiempo)
    const minCalculado = servicio.tiempo_minimo * factor * item.cantidad
    const maxCalculado = servicio.tiempo_maximo * factor * item.cantidad
    totalMin += minCalculado
    totalMax += maxCalculado
    detalles.push({
      id: servicio.id_servicio,
      nombre: servicio.nombre,
      cantidad: item.cantidad,
      min: minCalculado,
      max: maxCalculado,
      unidad: servicio.unidad_tiempo
    })
  })

  return { cantidadServicios: detalles.length, totalMin, totalMax, detalles }
}

export const estimacionFechas = (totalMin: number, totalMax: number) => {
  if (totalMax === 0) return null
  const inicio = new Date()
  return {
    inicio,
    finMin: addMinutes(inicio, totalMin),
    finMax: addMinutes(inicio, totalMax)
  }
}
