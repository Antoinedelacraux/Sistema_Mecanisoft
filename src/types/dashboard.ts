export type DashboardFilters = {
	from: Date
	to: Date
	almacenId?: number
	usuarioId?: number
	alertThresholds?: {
		pagosPendientesDias?: number
		cotizacionesPorVencerDias?: number
	}
}

export type DashboardKpiVentas = {
	total: number
	comprobantes: number
}

export type DashboardOrdenResumen = {
	id: number
	codigo: string
	cliente: string
	estado: string
	prioridad: string
	fecha: string
	fechaEstimada?: string | null
}

export type DashboardLowStockItem = {
	inventarioId: number
	productoId: number
	nombreProducto: string
	almacen: string
	stockDisponible: number
	stockMinimo: number
}

export type DashboardCotizacionResumen = {
	id: number
	codigo: string
	cliente: string
	vigenciaHasta: string
	estado: string
}

export type DashboardPagoPendienteResumen = {
	id: number
	comprobante: string
	fecha: string
	total: number
	saldo: number
	estado: string
}

export type DashboardAlertSeverity = 'info' | 'warning' | 'critical'

export type DashboardAlertType =
	| 'LOW_STOCK'
	| 'QUOTE_EXPIRED'
	| 'ORDER_PENDING'
	| 'PAYMENT_PENDING'

export type DashboardAlertItem = {
	id: string
	title: string
	subtitle?: string
	href?: string
	meta?: Record<string, unknown>
}

export type DashboardAlert = {
	type: DashboardAlertType
	severity: DashboardAlertSeverity
	title: string
	description: string
	items?: DashboardAlertItem[]
}

export type DashboardSummary = {
	ventasHoy: DashboardKpiVentas
	ventasMes: DashboardKpiVentas & {
		deltaPorcentaje: number | null
	}
	ticketPromedio: number
	ordenesPendientes: {
		total: number
		top: DashboardOrdenResumen[]
	}
	stockBajo: {
		total: number
		items: DashboardLowStockItem[]
	}
	cotizacionesVencidas: {
		total: number
		items: DashboardCotizacionResumen[]
	}
	pagosPendientes: {
		total: number
		items: DashboardPagoPendienteResumen[]
	}
	alerts: DashboardAlert[]
}

export type VentasSeriesGranularity = 'day' | 'week' | 'month'

export type VentasSeriesPoint = {
	label: string
	date: string
	total: number
}

export type VentasMetodoPagoEntry = {
	metodo: string
	total: number
}

export type TopProductoEntry = {
	idProducto: number
	nombreProducto: string
	cantidad: number
	total: number
}

export type DashboardServiceParams = DashboardFilters & {
	granularity?: VentasSeriesGranularity
	topLimit?: number
}
