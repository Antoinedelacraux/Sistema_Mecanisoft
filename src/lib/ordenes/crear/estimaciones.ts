import type { ContextoValidacion } from './types'
import type { CrearOrdenInput } from '../validators'

export interface EstimacionesOrden {
  impuesto: number
  total: number
  fechaFinCalculada: Date | null
  trabajadorAsignadoInicial: number | null
  estadoInicialOrden: 'asignado' | 'pendiente'
  estadoInicialTarea: 'por_hacer' | 'pendiente'
}

const IGV_PORCENTAJE = 0.18

export function calcularImpuesto(subtotal: number, tasa = IGV_PORCENTAJE): number {
  return subtotal * tasa
}

export function calcularTotal(subtotal: number, impuesto: number): number {
  return subtotal + impuesto
}

export function calcularFechaFin(contexto: ContextoValidacion, data: CrearOrdenInput): Date | null {
  if (data.fecha_fin_estimada) {
    if (data.fecha_fin_estimada instanceof Date) return data.fecha_fin_estimada
    const fecha = new Date(data.fecha_fin_estimada)
    return Number.isNaN(fecha.valueOf()) ? null : fecha
  }

  if (contexto.totalMinutosMax > 0) {
    const referencia = new Date()
    return new Date(referencia.getTime() + contexto.totalMinutosMax * 60_000)
  }

  return null
}

export function determinarAsignaciones(contexto: ContextoValidacion): {
  trabajadorAsignadoInicial: number | null
  estadoInicialOrden: 'asignado' | 'pendiente'
  estadoInicialTarea: 'por_hacer' | 'pendiente'
} {
  const trabajadorAsignadoInicial = contexto.trabajadorPrincipalId ?? contexto.trabajadoresSecundarios[0] ?? null
  const estadoInicialOrden = trabajadorAsignadoInicial ? 'asignado' : 'pendiente'
  const estadoInicialTarea = trabajadorAsignadoInicial ? 'por_hacer' : 'pendiente'

  return { trabajadorAsignadoInicial, estadoInicialOrden, estadoInicialTarea }
}

export function calcularEstimaciones(contexto: ContextoValidacion, data: CrearOrdenInput): EstimacionesOrden {
  const impuesto = calcularImpuesto(contexto.subtotal)
  const total = calcularTotal(contexto.subtotal, impuesto)
  const fechaFinCalculada = calcularFechaFin(contexto, data)
  const { trabajadorAsignadoInicial, estadoInicialOrden, estadoInicialTarea } = determinarAsignaciones(contexto)

  return {
    impuesto,
    total,
    fechaFinCalculada,
    trabajadorAsignadoInicial,
    estadoInicialOrden,
    estadoInicialTarea,
  }
}
