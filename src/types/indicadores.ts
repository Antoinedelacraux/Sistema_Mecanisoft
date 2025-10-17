export type IndicadoresRange = {
  from: Date
  to: Date
}

export type CoverageKpi = {
  coverageRate: number
  totalVehiculos: number
  vehiculosProgramados: number
  from: string
  to: string
}

export type OnScheduleKpi = {
  onScheduleRate: number
  totalCompletados: number
  completadosDentroVentana: number
  windowDays: number
  reprogramados: number
  from: string
  to: string
}

export type TechnicianUtilizationItem = {
  trabajadorId: number
  nombre: string
  minutosAsignados: number
  minutosDisponibles: number
  utilization: number
  tareas: number
}

export type TechnicianUtilizationKpi = {
  from: string
  to: string
  promedioUtilizacion: number
  minutosTotalesAsignados: number
  minutosTotalesDisponibles: number
  items: TechnicianUtilizationItem[]
}

export type OnTimeCloseBreakdown = Record<
  string,
  {
    total: number
    dentroSla: number
    tasa: number
  }
>

export type OnTimeCloseKpi = {
  from: string
  to: string
  onTimeRate: number
  totalCerradas: number
  cerradasDentroSla: number
  breakdown: OnTimeCloseBreakdown
}

export type RescheduleReason = {
  reason: string
  count: number
}

export type RescheduleKpi = {
  from: string
  to: string
  totalProgramados: number
  reprogramados: number
  rescheduleRate: number
  topReasons: RescheduleReason[]
}

export type AvgTimePerJobItem = {
  servicioId: number
  servicioNombre: string
  promedioMinutos: number
  tareas: number
  totalMinutos: number
}

export type AvgTimePerJobKpi = {
  from: string
  to: string
  promedioGlobal: number
  totalServicios: number
  items: AvgTimePerJobItem[]
}

export type StockCriticalItem = {
  inventarioId: number
  productoId: number
  codigo: string
  nombre: string
  stockDisponible: number
  stockMinimo: number
  almacen: string
  nivel: 'ok' | 'bajo'
}

export type StockCriticalKpi = {
  from: string
  to: string
  totalCriticos: number
  enNivel: number
  bajoNivel: number
  cumplimientoRate: number
  items: StockCriticalItem[]
}

export type ReworkRateItem = {
  ordenId: number
  codigo: string
  prioridad: string | null
  reaperturas: number
  ultimaFecha: string | null
}

export type ReworkRateKpi = {
  from: string
  to: string
  totalCerradas: number
  reabiertas: number
  reworkRate: number
  items: ReworkRateItem[]
}

export type CsatBreakdownItem = {
  score: number
  total: number
  porcentaje: number
}

export type CsatKpi = {
  from: string
  to: string
  promedio: number
  totalRespuestas: number
  breakdown: CsatBreakdownItem[]
}
