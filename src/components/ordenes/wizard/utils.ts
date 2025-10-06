import { addMinutes } from 'date-fns'
import { ServicioCompleto } from '@/types'
import { ItemOrden } from './types'

export const toNumber = (v: unknown): number => {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isNaN(n) ? 0 : n
  }
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'object') {
    const candidate = v as { toString?: () => string }
    if (candidate.toString) {
      const n = Number(candidate.toString())
      return Number.isNaN(n) ? 0 : n
    }
  }
  const fallback = Number(v)
  return Number.isNaN(fallback) ? 0 : fallback
}

export const formatMoney = (v: unknown) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(toNumber(v))

export const calcularTotalLinea = (cantidad: number, precioUnitario: number, descuento: number) => {
  const cantidadValida = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1
  const precioValido = Number.isFinite(precioUnitario) && precioUnitario >= 0 ? precioUnitario : 0
  const descuentoValido = Number.isFinite(descuento) && descuento >= 0 ? descuento : 0
  return cantidadValida * precioValido * (1 - descuentoValido / 100)
}

export const unidadTiempoEnMinutos = (unidad: ServicioCompleto['unidad_tiempo']) => {
  switch (unidad) {
    case 'minutos': return 1
    case 'horas': return 60
    case 'dias': return 60 * 24
    case 'semanas': return 60 * 24 * 7
    default: return 1
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

export const resumenTiempoServicios = (items: ItemOrden[], servicios: ServicioCompleto[]) => {
  let totalMin = 0
  let totalMax = 0
  const detalles: Array<{ id: number; nombre: string; cantidad: number; min: number; max: number; unidad: ServicioCompleto['unidad_tiempo'] }> = []

  items.forEach(item => {
    if (item.tipo !== 'servicio') return
    const servicio = servicios.find(s => s.id_servicio === item.id_referencia)
    if (!servicio) return
    const factor = unidadTiempoEnMinutos(servicio.unidad_tiempo)
    const minCalculado = servicio.tiempo_minimo * factor * item.cantidad
    const maxCalculado = servicio.tiempo_maximo * factor * item.cantidad
    totalMin += minCalculado
    totalMax += maxCalculado
    detalles.push({ id: servicio.id_servicio, nombre: servicio.nombre, cantidad: item.cantidad, min: minCalculado, max: maxCalculado, unidad: servicio.unidad_tiempo })
  })

  return { cantidadServicios: detalles.length, totalMin, totalMax, detalles }
}

export const estimacionFechas = (totalMin: number, totalMax: number) => {
  if (totalMax === 0) return null
  const inicio = new Date()
  return { inicio, finMin: addMinutes(inicio, totalMin), finMax: addMinutes(inicio, totalMax) }
}

export const validarServiciosProductos = (items: ItemOrden[]) => {
  const serviciosRequierenProducto: Array<{ id_servicio: number; id_producto: number }> = [] // reemplazar con lógica real
  for (const item of items) {
    if (item.tipo === 'servicio') {
      const req = serviciosRequierenProducto.find(s => s.id_servicio == item.id_referencia)
      if (req) {
        const tieneProducto = items.some(i => i.tipo === 'producto' && i.id_referencia == req.id_producto)
        if (!tieneProducto) {
          return { ok: false, mensaje: `El servicio ${item.nombre} requiere el producto ${req.id_producto}` }
        }
      }
    }
  }
  return { ok: true }
}