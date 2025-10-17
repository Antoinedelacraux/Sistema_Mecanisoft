import { AlertTriangle, BarChart3, ClipboardList, CreditCard, DollarSign, PackageMinus, ShieldAlert, TrendingUp } from "lucide-react"
import { getServerSession } from "next-auth/next"

import { DashboardFilters } from "@/components/dashboard/dashboard-filters"
import { ExportCsvButton } from "@/components/dashboard/export-csv-button"
import { VentasMetodoChart } from "@/components/dashboard/ventas-metodo-chart"
import { VentasSeriesChart } from "@/components/dashboard/ventas-series-chart"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { parseDashboardParams, type DashboardSearchParamsInput } from "@/lib/dashboard-params"
import { prisma } from "@/lib/prisma"
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from "@/lib/permisos/guards"
import { getDashboardSummary, getTopProductos, getVentasPorMetodoPago, getVentasSeries } from "@/lib/dashboard"
import type { DashboardSummary, TopProductoEntry, VentasMetodoPagoEntry, VentasSeriesPoint } from "@/types/dashboard"

const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2
})

const integerFormatter = new Intl.NumberFormat("es-PE")

const dateFormatter = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" })

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short"
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const formatPercentDelta = (value: number | null) => {
  if (value === null) {
    return "Sin comparación previa"
  }
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}% vs mes anterior`
}

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "Sin fecha"
  }
  return dateFormatter.format(new Date(value))
}

const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))

const prioridadVariant = (prioridad: string | null | undefined) => {
  if (!prioridad) {
    return "outline"
  }
  if (prioridad.toLowerCase() === "alta") {
    return "destructive"
  }
  if (prioridad.toLowerCase() === "media") {
    return "default"
  }
  return "secondary"
}

const emptySummary: DashboardSummary = {
  ventasHoy: { total: 0, comprobantes: 0 },
  ventasMes: { total: 0, comprobantes: 0, deltaPorcentaje: null },
  ticketPromedio: 0,
  ordenesPendientes: { total: 0, top: [] },
  stockBajo: { total: 0, items: [] },
  cotizacionesVencidas: { total: 0, items: [] },
  pagosPendientes: { total: 0, items: [] },
  alerts: []
}

type DashboardPageProps = {
  searchParams: Promise<DashboardSearchParamsInput> | DashboardSearchParamsInput
}

const DashboardPage = async ({ searchParams }: DashboardPageProps) => {
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermiso(session, "dashboard.ver", { prismaClient: prisma })
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return (
        <Alert className="mt-6">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <AlertTitle>Sesión requerida</AlertTitle>
          <AlertDescription>Debes iniciar sesión nuevamente para acceder al panel principal.</AlertDescription>
        </Alert>
      )
    }

    if (error instanceof PermisoDenegadoError) {
      return (
        <Alert className="mt-6">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>No cuentas con permisos para visualizar el módulo de dashboard.</AlertDescription>
        </Alert>
      )
    }

    throw error
  }

  const resolvedSearchParams = await searchParams
  const { filters, granularity, topLimit } = parseDashboardParams(resolvedSearchParams)

  let summary: DashboardSummary = emptySummary
  let ventasSeries: VentasSeriesPoint[] = []
  let topProductos: TopProductoEntry[] = []
  let ventasMetodoPago: VentasMetodoPagoEntry[] = []

  try {
    const [summaryResult, seriesResult, ventasMetodoPagoResult, topProductosResult] = await Promise.all([
      getDashboardSummary(filters),
      getVentasSeries(filters, granularity),
      getVentasPorMetodoPago(filters),
      getTopProductos(filters, Math.min(topLimit, 10))
    ])

    summary = summaryResult
    ventasSeries = seriesResult
    ventasMetodoPago = ventasMetodoPagoResult
    topProductos = topProductosResult
  } catch (error) {
    console.error("Error cargando datos del dashboard", error)
  }

  const rangoLabel = `${dateFormatter.format(filters.from)} — ${dateFormatter.format(filters.to)}`
  const delta = summary.ventasMes.deltaPorcentaje
  const deltaClass = delta === null ? "text-muted-foreground" : delta >= 0 ? "text-emerald-600" : "text-rose-600"

  const kpis = [
    {
      title: "Ventas de hoy",
      icon: DollarSign,
      value: formatCurrency(summary.ventasHoy.total),
      helper: `${integerFormatter.format(summary.ventasHoy.comprobantes)} comprobantes`
    },
    {
      title: "Ventas del mes",
      icon: TrendingUp,
      value: formatCurrency(summary.ventasMes.total),
      helper: (
        <span className={`text-xs font-medium ${deltaClass}`}>{formatPercentDelta(delta)}</span>
      )
    },
    {
      title: "Ticket promedio",
      icon: CreditCard,
      value: formatCurrency(summary.ticketPromedio),
      helper: `${integerFormatter.format(summary.ventasMes.comprobantes)} comprobantes en el rango`
    },
    {
      title: "Órdenes pendientes",
      icon: ClipboardList,
      value: integerFormatter.format(summary.ordenesPendientes.total),
      helper: summary.ordenesPendientes.total > 0 ? `Top ${Math.min(summary.ordenesPendientes.top.length, 5)} visible abajo` : "Sin órdenes activas"
    },
    {
      title: "Pagos pendientes",
      icon: BarChart3,
      value: integerFormatter.format(summary.pagosPendientes.total),
      helper: summary.pagosPendientes.total > 0 ? `${summary.pagosPendientes.items.length} listados más recientes` : "Todo al día"
    },
    {
      title: "Stock bajo",
      icon: PackageMinus,
      value: integerFormatter.format(summary.stockBajo.total),
      helper: summary.stockBajo.total > 0 ? `${summary.stockBajo.items.length} productos críticos` : "Inventario saludable"
    }
  ]

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Panel de control</h1>
            <p className="text-sm text-muted-foreground">
              Hola {session?.user?.name ?? ""}, este es el resumen para el rango seleccionado ({rangoLabel}).
            </p>
          </div>
        </div>
        <DashboardFilters
          from={filters.from.toISOString()}
          to={filters.to.toISOString()}
          granularity={granularity}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => (
          <Card key={item.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <item.icon className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-border">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Curva de ventas</CardTitle>
              <CardDescription>Comprobantes emitidos en el rango seleccionado.</CardDescription>
            </div>
            <ExportCsvButton label="Descargar CSV" />
          </CardHeader>
          <CardContent className="h-[320px]">
            {ventasSeries.length ? (
              <VentasSeriesChart series={ventasSeries} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No hay ventas registradas en el período.
              </div>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Top productos vendidos</CardTitle>
              <CardDescription>Basado en importe total del rango.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topProductos.length ? (
                <div className="space-y-3">
                  {topProductos.map((producto, index) => (
                    <div key={producto.idProducto} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{producto.nombreProducto}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(producto.total)} • {producto.cantidad.toLocaleString("es-PE")} unidades
                        </p>
                      </div>
                      <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin ventas registradas para este rango.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Ventas por método de pago</CardTitle>
              <CardDescription>Distribución de ingresos por método registrado.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {ventasMetodoPago.length ? (
                <VentasMetodoChart data={ventasMetodoPago} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No se registraron métodos de pago en el período.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {summary.alerts.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">Alertas operativas</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summary.alerts.map((alerta) => {
              const variant = alerta.severity === "critical" ? "destructive" : "default"
              const Icon = alerta.type === "LOW_STOCK" ? AlertTriangle : alerta.type === "ORDER_PENDING" ? ClipboardList : alerta.type === "PAYMENT_PENDING" ? BarChart3 : TrendingUp
              return (
                <Alert key={alerta.type} variant={variant}>
                  <Icon className="h-5 w-5" />
                  <AlertTitle>{alerta.title}</AlertTitle>
                  <AlertDescription>
                    <p>{alerta.description}</p>
                    {alerta.items && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {alerta.items.map((item) => (
                          <li key={item.id} className="rounded bg-background/60 p-2">
                            <p className="font-medium">{item.title}</p>
                            {item.subtitle && <p className="text-muted-foreground">{item.subtitle}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )
            })}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Órdenes pendientes</CardTitle>
            <CardDescription>Prioriza las órdenes con fecha próxima de entrega.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.ordenesPendientes.top.length ? (
              <div className="space-y-3">
                {summary.ordenesPendientes.top.map((orden) => (
                  <div key={orden.id} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{orden.codigo}</p>
                        <p className="text-xs text-muted-foreground">{orden.cliente}</p>
                      </div>
                      <Badge variant={prioridadVariant(orden.prioridad)}>{orden.prioridad ?? "N/D"}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Iniciada: {formatDate(orden.fecha)}</span>
                      {orden.fechaEstimada && <span>Entrega estimada: {formatDate(orden.fechaEstimada)}</span>}
                      <span>Estado: {orden.estado}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay órdenes pendientes en el rango.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Productos con stock bajo</CardTitle>
            <CardDescription>Inventario por debajo del mínimo configurado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.stockBajo.items.length ? (
              <div className="space-y-3">
                {summary.stockBajo.items.map((item) => (
                  <div key={item.inventarioId} className="flex items-center justify-between rounded border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{item.nombreProducto}</p>
                      <p className="text-xs text-muted-foreground">{item.almacen}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold">Disp: {item.stockDisponible}</p>
                      <p className="text-muted-foreground">Mín: {item.stockMinimo}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No se detectaron productos críticos.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Cotizaciones vencidas</CardTitle>
            <CardDescription>Revisa oportunidades comerciales que necesitan seguimiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.cotizacionesVencidas.items.length ? (
              <ol className="space-y-3 text-sm">
                {summary.cotizacionesVencidas.items.map((cotizacion) => (
                  <li key={cotizacion.id} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{cotizacion.codigo}</p>
                      <Badge variant="outline">{cotizacion.estado}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{cotizacion.cliente}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Venció: {formatDate(cotizacion.vigenciaHasta)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No hay cotizaciones vencidas pendientes.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Pagos pendientes</CardTitle>
            <CardDescription>Ventas con saldo pendiente de cobro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.pagosPendientes.items.length ? (
              <ul className="space-y-3 text-sm">
                {summary.pagosPendientes.items.map((pago) => (
                  <li key={pago.id} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{pago.comprobante}</p>
                      <Badge variant="outline">{pago.estado}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Emitido: {formatDateTime(pago.fecha)}</p>
                    <p className="mt-1 text-xs">
                      Total: {formatCurrency(pago.total)} • Saldo: {formatCurrency(pago.saldo)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay pagos pendientes en el período.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default DashboardPage