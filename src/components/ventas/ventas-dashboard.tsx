"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { MetodoPagoVenta, EstadoPagoVenta, OrigenComprobante, TipoComprobante } from "@prisma/client"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Download, RefreshCcw, Search, TrendingUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { VentaListadoItem, VentasResponse, ResumenVentas } from "@/types/ventas"
import { VentasPaymentDialog } from "@/components/ventas/ventas-payment-dialog"
import { VentasDetalleDialog } from "@/components/ventas/ventas-detalle-dialog"

const LIMIT = 10

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value ?? 0))

const METODO_LABELS: Record<MetodoPagoVenta, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  APP_MOVIL: "App móvil",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro"
}

const ORIGEN_LABELS: Record<OrigenComprobante, string> = {
  COTIZACION: "Cotización",
  ORDEN: "Orden de trabajo"
}

const TIPO_LABELS: Record<TipoComprobante, string> = {
  FACTURA: "Factura",
  BOLETA: "Boleta"
}

const ESTADO_PAGO_LABELS: Record<EstadoPagoVenta, { label: string; tone: "secondary" | "default" | "destructive" }> = {
  pendiente: { label: "Pendiente", tone: "destructive" },
  parcial: { label: "Parcial", tone: "secondary" },
  pagado: { label: "Pagado", tone: "default" }
}

type FilterState = {
  search: string
  fechaDesde?: string
  fechaHasta?: string
  metodo: MetodoPagoVenta | "todos"
  estado: EstadoPagoVenta | "todos"
  origen: OrigenComprobante | "todos"
  tipo: TipoComprobante | "todos"
  serie: string
}

type FetchState = "idle" | "loading" | "error"

export default function VentasDashboard() {
  const { toast } = useToast()
  const [ventas, setVentas] = useState<VentaListadoItem[]>([])
  const [pagination, setPagination] = useState({ total: 0, pages: 1, current: 1, limit: LIMIT })
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    fechaDesde: undefined,
    fechaHasta: undefined,
    metodo: "todos",
    estado: "todos",
    origen: "todos",
    tipo: "todos",
    serie: ""
  })
  const [listState, setListState] = useState<FetchState>("idle")
  const [summaryState, setSummaryState] = useState<FetchState>("idle")
  const [resumen, setResumen] = useState<ResumenVentas | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedVenta, setSelectedVenta] = useState<VentaListadoItem | null>(null)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [selectedComprobanteId, setSelectedComprobanteId] = useState<number | null>(null)

  const buildQuery = useCallback(
    (params: { pageOverride?: number; includeSearch?: boolean }) => {
      const searchParams = new URLSearchParams()
      const currentPage = params.pageOverride ?? page
      searchParams.set("page", String(currentPage))
      searchParams.set("limit", String(LIMIT))

      if (filters.fechaDesde) searchParams.set("fecha_desde", filters.fechaDesde)
      if (filters.fechaHasta) searchParams.set("fecha_hasta", filters.fechaHasta)
      if (filters.serie.trim()) searchParams.set("serie", filters.serie.trim())

      if (filters.metodo !== "todos") searchParams.set("metodo", filters.metodo)
      if (filters.estado !== "todos") searchParams.set("estado_pago", filters.estado)
      if (filters.origen !== "todos") searchParams.set("origen", filters.origen)
      if (filters.tipo !== "todos") searchParams.set("tipo", filters.tipo)

      const term = params.includeSearch ? searchTerm.trim() : filters.search.trim()
      if (term) searchParams.set("search", term)

      return searchParams
    },
    [filters, page, searchTerm]
  )

  const fetchVentas = useCallback(
    async (pageOverride?: number) => {
      try {
        setListState("loading")
        const query = buildQuery({ pageOverride, includeSearch: true })
        const response = await fetch(`/api/ventas?${query.toString()}`)
        const body: VentasResponse | { error?: string } = await response.json()

        if (!response.ok) {
          throw new Error("error" in body ? body.error : "No se pudieron obtener las ventas")
        }

        setVentas(body.ventas)
        setPagination(body.pagination)
        setPage(body.pagination.current)
        setListState("idle")
      } catch (error) {
        console.error("Error listando ventas", error)
        setListState("error")
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudieron obtener las ventas",
          variant: "destructive"
        })
      }
    },
    [buildQuery, toast]
  )

  const fetchResumen = useCallback(async () => {
    try {
      setSummaryState("loading")
      const params = new URLSearchParams()
      if (filters.fechaDesde) params.set("fecha_desde", filters.fechaDesde)
      if (filters.fechaHasta) params.set("fecha_hasta", filters.fechaHasta)

      const response = await fetch(`/api/ventas/resumen?${params.toString()}`)
      const body: ResumenVentas | { error?: string } = await response.json()
      if (!response.ok) {
        const message = "error" in body && body.error ? body.error : "No se pudo obtener el resumen"
        setResumen(null)
        setSummaryState("error")
        toast({
          title: "No se pudo cargar el resumen",
          description: message,
          variant: "destructive"
        })
        return
      }
      setResumen(body as ResumenVentas)
      setSummaryState("idle")
    } catch (error) {
      console.error("Error obteniendo resumen de ventas", error)
      setSummaryState("error")
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo obtener el resumen",
        variant: "destructive"
      })
    }
  }, [filters.fechaDesde, filters.fechaHasta, toast])

  useEffect(() => {
    fetchResumen()
  }, [fetchResumen])

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchVentas(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [fetchVentas, filters, searchTerm])

  const handleRefresh = async () => {
    await Promise.all([fetchVentas(page), fetchResumen()])
  }

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    if (key !== "search") {
      setPage(1)
    }
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearchTerm(value)
    updateFilter("search", value)
    setPage(1)
  }

  const handlePageChange = (direction: "prev" | "next") => {
    setPage((prev) => {
      const next = direction === "prev" ? Math.max(prev - 1, 1) : Math.min(prev + 1, pagination.pages)
      if (next !== prev) {
        fetchVentas(next)
      }
      return next
    })
  }

  const resetFilters = () => {
    setFilters({
      search: "",
      fechaDesde: undefined,
      fechaHasta: undefined,
      metodo: "todos",
      estado: "todos",
      origen: "todos",
      tipo: "todos",
      serie: ""
    })
    setSearchTerm("")
    setPage(1)
  }

  const handleVerDetalle = (venta: VentaListadoItem) => {
    setSelectedComprobanteId(venta.comprobante.id_comprobante)
    setDetalleOpen(true)
  }

  const handleRegistrarPago = (venta: VentaListadoItem) => {
    setSelectedVenta(venta)
    setPagoOpen(true)
  }

  const estadosDistribucion = useMemo(() => {
    if (!resumen) return []
    return Object.entries(resumen.porEstadoPago).map(([estado, cantidad]) => ({
      estado: estado as EstadoPagoVenta,
      cantidad
    }))
  }, [resumen])

  const metodosDistribucion = useMemo(() => {
    if (!resumen) return []
    return Object.entries(resumen.porMetodo)
      .filter(([metodo, monto]) => metodo !== "SIN_REGISTRO" || monto > 0)
      .map(([metodo, monto]) => ({ metodo, monto }))
  }, [resumen])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Ventas</h1>
        <p className="text-muted-foreground">Revisa el desempeño comercial y concilia pagos emitidos.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Buscar por cliente, documento, serie o código"
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={resetFilters} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Limpiar
        </Button>
        <Button onClick={handleRefresh} className="gap-2">
          <Download className="h-4 w-4" />
          Actualizar datos
        </Button>
      </div>

      <Tabs defaultValue="filtros" className="space-y-4">
        <TabsList>
          <TabsTrigger value="filtros">Filtros</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>
        <TabsContent value="filtros">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fecha-desde">Fecha desde</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fecha-desde"
                  type="date"
                  value={filters.fechaDesde ?? ""}
                  onChange={(event) => updateFilter("fechaDesde", event.target.value || undefined)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha-hasta">Fecha hasta</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fecha-hasta"
                  type="date"
                  value={filters.fechaHasta ?? ""}
                  onChange={(event) => updateFilter("fechaHasta", event.target.value || undefined)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serie">Serie</Label>
              <Input
                id="serie"
                value={filters.serie}
                onChange={(event) => updateFilter("serie", event.target.value)}
                placeholder="Ej. F001"
              />
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={filters.metodo} onValueChange={(value) => updateFilter("metodo", value as FilterState["metodo"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(METODO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado de pago</Label>
              <Select value={filters.estado} onValueChange={(value) => updateFilter("estado", value as FilterState["estado"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(ESTADO_PAGO_LABELS).map(([value, info]) => (
                    <SelectItem key={value} value={value}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origen</Label>
              <Select value={filters.origen} onValueChange={(value) => updateFilter("origen", value as FilterState["origen"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(ORIGEN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de comprobante</Label>
              <Select value={filters.tipo} onValueChange={(value) => updateFilter("tipo", value as FilterState["tipo"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="resumen">
          {summaryState === "loading" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : resumen ? (
            <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total vendido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(resumen.totalVentas)}</div>
                    <p className="text-xs text-muted-foreground">Monto conciliado en el periodo filtrado.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Comprobantes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{resumen.numeroComprobantes}</div>
                    <p className="text-xs text-muted-foreground">Documentos emitidos asociados a ventas.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Ticket promedio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(resumen.promedio)}</div>
                    <p className="text-xs text-muted-foreground">Promedio por comprobante.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Métodos registrados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {metodosDistribucion.length === 0 ? (
                      <p className="text-muted-foreground">Sin pagos registrados en este rango.</p>
                    ) : (
                      metodosDistribucion.map(({ metodo, monto }) => (
                        <div key={metodo} className="flex items-center justify-between">
                          <span>{metodo === "SIN_REGISTRO" ? "Sin registro" : METODO_LABELS[metodo as MetodoPagoVenta]}</span>
                          <span className="font-semibold">{formatCurrency(monto)}</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Estado de pagos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {estadosDistribucion.map(({ estado, cantidad }) => (
                    <div key={estado} className="flex items-center justify-between text-sm">
                      <span>{ESTADO_PAGO_LABELS[estado].label}</span>
                      <Badge variant={ESTADO_PAGO_LABELS[estado].tone}>{cantidad}</Badge>
                    </div>
                  ))}
                  {estadosDistribucion.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay ventas emitidas en el rango filtrado.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aplica filtros o registra ventas para ver el resumen.</p>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Ventas registradas</CardTitle>
            <p className="text-sm text-muted-foreground">Listado de comprobantes emitidos listos para conciliación.</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {pagination.total > 0 ? (
              <span>
                Mostrando {Math.min((page - 1) * pagination.limit + 1, pagination.total)}-
                {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} ventas
              </span>
            ) : (
              <span>Sin resultados para los filtros aplicados.</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {listState === "loading" ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : ventas.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              No encontramos ventas con los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Fecha</TableHead>
                      <TableHead className="min-w-[160px]">Comprobante</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Ítems</TableHead>
                      <TableHead className="min-w-[160px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.map((venta) => (
                      <TableRow key={venta.id_venta}>
                        <TableCell>
                          {format(new Date(venta.fecha), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {venta.comprobante.serie}-{String(venta.comprobante.numero).padStart(8, "0")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {venta.comprobante.tipo ? TIPO_LABELS[venta.comprobante.tipo] : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{venta.comprobante.receptor_nombre}</div>
                          <div className="text-xs text-muted-foreground">{venta.comprobante.receptor_documento}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(venta.total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(venta.total_pagado)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(venta.saldo)}</TableCell>
                        <TableCell>
                          <Badge variant={ESTADO_PAGO_LABELS[venta.estado_pago].tone}>
                            {ESTADO_PAGO_LABELS[venta.estado_pago].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {venta.metodo_principal
                            ? METODO_LABELS[venta.metodo_principal]
                            : <span className="text-xs text-muted-foreground">Sin registro</span>}
                        </TableCell>
                        <TableCell className="text-right">{venta.items}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleVerDetalle(venta)}>
                              Ver detalle
                            </Button>
                            <Button size="sm" onClick={() => handleRegistrarPago(venta)}>
                              Conciliar pago
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Página {page} de {pagination.pages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange("prev")}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange("next")}
                      disabled={page === pagination.pages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <VentasPaymentDialog
        open={pagoOpen}
        onOpenChange={(open) => {
          setPagoOpen(open)
          if (!open) {
            setSelectedVenta(null)
          }
        }}
        venta={selectedVenta}
        onUpdated={async () => {
          await fetchVentas(page)
          await fetchResumen()
        }}
      />

      <VentasDetalleDialog
        open={detalleOpen}
        comprobanteId={selectedComprobanteId}
        onOpenChange={(open) => {
          setDetalleOpen(open)
          if (!open) {
            setSelectedComprobanteId(null)
          }
        }}
      />
    </div>
  )
}
