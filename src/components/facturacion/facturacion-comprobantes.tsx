"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { AlertCircle, Download, FileText, Filter, Loader2, Mail, RefreshCcw, Search, Send, View } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { sendComprobanteEmail } from "@/lib/facturacion/email-client"
import { cn } from "@/lib/utils"
import type { ComprobanteCompleto } from "@/types"

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
  OBSERVADO: "Observado",
}

const TIPO_LABELS: Record<string, string> = {
  BOLETA: "Boleta",
  FACTURA: "Factura",
}

const ORIGEN_LABELS: Record<string, string> = {
  COTIZACION: "Cotización",
  ORDEN: "Orden de trabajo",
}

type Pagination = {
  total: number
  pages: number
  current: number
  limit: number
}

type Serie = {
  id_facturacion_serie: number
  tipo: "BOLETA" | "FACTURA"
  serie: string
  descripcion: string | null
  correlativo_actual: number
  activo: boolean
}

const ESTADOS = ["BORRADOR", "EMITIDO", "ANULADO", "OBSERVADO"] as const
const TIPOS = ["BOLETA", "FACTURA"] as const
const ORIGENES = ["COTIZACION", "ORDEN"] as const

const LIMIT = 10

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value ?? 0)

const padNumero = (value: number | string | null | undefined) =>
  String(value ?? "").padStart(8, "0")

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "—"
  try {
    const date = typeof value === "string" ? parseISO(value) : value
    return format(date, "dd MMM yyyy, HH:mm", { locale: es })
  } catch {
    return "—"
  }
}

const getPdfHref = (pdfUrl?: string | null) => {
  if (!pdfUrl) return null
  if (/^https?:/i.test(pdfUrl)) return pdfUrl
  const normalized = pdfUrl.startsWith("/") ? pdfUrl : `/${pdfUrl}`
  return normalized.replace(/\\/g, "/")
}

const estadoBadgeClass = (estado: string) => {
  switch (estado) {
    case "BORRADOR":
      return "bg-yellow-100 text-yellow-800"
    case "EMITIDO":
      return "bg-green-100 text-green-800"
    case "ANULADO":
      return "bg-red-100 text-red-800"
    case "OBSERVADO":
      return "bg-orange-100 text-orange-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

type FetchingState = "idle" | "loading" | "error"

type FiltersState = {
  search: string
  estado?: string
  tipo?: string
  serie?: string
  origen?: string
  date?: string
}

type EmailDialogState = {
  open: boolean
  comprobante: ComprobanteCompleto | null
  destinatario: string
  mensaje: string
  error?: string | null
}

export default function FacturacionComprobantes() {
  const { toast } = useToast()

  const [filters, setFilters] = useState<FiltersState>({ search: "" })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination>({ total: 0, pages: 1, current: 1, limit: LIMIT })
  const [comprobantes, setComprobantes] = useState<ComprobanteCompleto[]>([])
  const [series, setSeries] = useState<Serie[]>([])
  const [fetchState, setFetchState] = useState<FetchingState>("idle")
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedComprobante, setSelectedComprobante] = useState<ComprobanteCompleto | null>(null)
  const [emittingId, setEmittingId] = useState<number | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null)
  const [emailDialog, setEmailDialog] = useState<EmailDialogState>({
    open: false,
    comprobante: null,
    destinatario: "",
    mensaje: "",
    error: null,
  })

  const loadSeries = useCallback(async () => {
    try {
      const response = await fetch("/api/facturacion/series?activo=true", { cache: "no-store" })
      if (!response.ok) return
      const body = await response.json()
      setSeries(Array.isArray(body?.data) ? body.data : [])
    } catch (error) {
      console.error("Error cargando series", error)
    }
  }, [])

  const fetchComprobantes = useCallback(async () => {
    try {
      setFetchState("loading")
  const params = new URLSearchParams({ page: page.toString(), limit: LIMIT.toString() })
      if (filters.search.trim()) params.set("search", filters.search.trim())
      if (filters.estado) params.set("estado", filters.estado)
      if (filters.tipo) params.set("tipo", filters.tipo)
      if (filters.origen) params.set("origen", filters.origen)
      if (filters.serie) params.set("serie", filters.serie)
  if (filters.date) params.set("date", filters.date)

      const response = await fetch(`/api/facturacion/comprobantes?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("No se pudo cargar el listado de comprobantes")
      }

      const body = await response.json()
      setComprobantes(Array.isArray(body?.data) ? body.data : [])
      setPagination((prev) => ({
        total: body?.pagination?.total ?? prev.total,
        pages: body?.pagination?.pages ?? prev.pages,
        current: body?.pagination?.current ?? prev.current,
        limit: body?.pagination?.limit ?? prev.limit,
      }))
      setFetchState("idle")
    } catch (error) {
      console.error("Error listando comprobantes", error)
      setFetchState("error")
      toast({
        variant: "destructive",
        title: "Error al cargar",
        description: error instanceof Error ? error.message : "No se pudo obtener el listado",
      })
    }
  }, [filters.estado, filters.origen, filters.search, filters.serie, filters.tipo, page, toast])

  const handleViewDetail = useCallback(
    async (comprobanteId: number) => {
      setDetailOpen(true)
      setDetailLoading(true)
      try {
        const response = await fetch(`/api/facturacion/comprobantes/${comprobanteId}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("No se pudo obtener el detalle del comprobante")
        }
        const body = await response.json()
        setSelectedComprobante(body?.data ?? null)
      } catch (error) {
        console.error("Error obteniendo comprobante", error)
        setSelectedComprobante(null)
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "No fue posible cargar el comprobante",
        })
      } finally {
        setDetailLoading(false)
      }
    },
    [toast]
  )

  const handleEmit = useCallback(
    async (comprobante: ComprobanteCompleto) => {
      if (comprobante.estado !== "BORRADOR") return
      const confirmed = confirm(
        `¿Deseas emitir el comprobante ${comprobante.serie}-${comprobante.numero}? Esta acción no se puede deshacer.`
      )
      if (!confirmed) return

      try {
        setEmittingId(comprobante.id_comprobante)
        const payload: { descripcion?: string; notas?: string } = {}
        if (typeof comprobante.descripcion === "string" && comprobante.descripcion.trim()) {
          payload.descripcion = comprobante.descripcion
        }
        if (typeof comprobante.notas === "string" && comprobante.notas.trim()) {
          payload.notas = comprobante.notas
        }

        const response = await fetch(`/api/facturacion/comprobantes/${comprobante.id_comprobante}/emitir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error ?? "No se pudo emitir el comprobante")
        }
        toast({
          title: "Comprobante emitido",
          description: `Se emitió ${comprobante.serie}-${comprobante.numero} correctamente.`,
        })
        await fetchComprobantes()
        if (detailOpen) {
          await handleViewDetail(comprobante.id_comprobante)
        }
      } catch (error) {
        console.error("Error emitiendo comprobante", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudo emitir el comprobante",
        })
      } finally {
        setEmittingId(null)
      }
    },
    [detailOpen, fetchComprobantes, handleViewDetail, toast]
  )

  const handleSendEmail = useCallback(
    (comprobante: ComprobanteCompleto) => {
      if (comprobante.estado !== "EMITIDO") {
        toast({
          variant: "destructive",
          title: "No enviado",
          description: "Solo puedes enviar comprobantes que ya fueron emitidos.",
        })
        return
      }

      const numero = `${comprobante.serie}-${padNumero(comprobante.numero)}`
      const tipo = TIPO_LABELS[comprobante.tipo] ?? comprobante.tipo
      const correoDestino = comprobante.persona?.correo?.trim() ?? ""

      setEmailDialog({
        open: true,
        comprobante,
        destinatario: correoDestino,
        mensaje: `Adjuntamos la ${tipo.toLowerCase()} ${numero} emitida por el taller.`,
        error: correoDestino ? null : "Ingresa al menos un correo destinatario antes de enviar.",
      })
    },
    [toast]
  )

  const handleFilterChange = (key: keyof FiltersState, value?: string) => {
    setFilters((prev) => ({ ...prev, [key]: value ?? undefined }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ search: "" })
    setPage(1)
  }

  const resetEmailDialog = useCallback(() => {
    setEmailDialog({ open: false, comprobante: null, destinatario: "", mensaje: "", error: null })
  }, [])

  const handleConfirmSendEmail = useCallback(async () => {
    const comprobanteActual = emailDialog.comprobante
    if (!comprobanteActual) return

    const destinatario = emailDialog.destinatario.trim() || comprobanteActual.persona?.correo?.trim() || ""
    if (!destinatario) {
      setEmailDialog((prev) => ({
        ...prev,
        destinatario: prev.comprobante?.persona?.correo?.trim() ?? "",
        error: "Ingresa al menos un correo destinatario.",
      }))
      return
    }

    const mensaje = emailDialog.mensaje.trim()
    const comprobante = comprobanteActual

    try {
      setSendingEmailId(comprobante.id_comprobante)
      setEmailDialog((prev) => ({ ...prev, error: null }))

      const body = (await sendComprobanteEmail({
        comprobanteId: comprobante.id_comprobante,
        destinatario,
        mensaje,
      })) as { data?: ComprobanteCompleto | null }

      toast({
        title: "Comprobante enviado",
        description: `Se envió ${comprobante.serie}-${padNumero(comprobante.numero)} correctamente.`,
      })

      await fetchComprobantes()

      if (detailOpen) {
        setSelectedComprobante(body?.data ?? null)
      }

      resetEmailDialog()
    } catch (error) {
      console.error("Error enviando comprobante", error)
      const message = error instanceof Error ? error.message : "No se pudo enviar el comprobante"
      setEmailDialog((prev) => ({ ...prev, error: message }))
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setSendingEmailId(null)
    }
  }, [detailOpen, emailDialog, fetchComprobantes, resetEmailDialog, toast])

  const resumenEstados = useMemo(() => {
    return ESTADOS.reduce(
      (acc, estado) => ({
        ...acc,
        [estado]: comprobantes.filter((c) => c.estado === estado).length,
      }),
      {} as Record<(typeof ESTADOS)[number], number>
    )
  }, [comprobantes])

  useEffect(() => {
    loadSeries()
  }, [loadSeries])

  useEffect(() => {
    fetchComprobantes()
  }, [fetchComprobantes])

  const isEmpty = !comprobantes.length && fetchState !== "loading"
  const selectedPdfHref = selectedComprobante ? getPdfHref(selectedComprobante.pdf_url) : null
  const selectedDestinatario = selectedComprobante?.persona?.correo?.trim() ?? ""

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Comprobantes electrónicos</CardTitle>
            <CardDescription>Gestiona la emisión y seguimiento de boletas y facturas.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={clearFilters} className="gap-2">
              <Filter className="h-4 w-4" />
              Limpiar filtros
            </Button>
            <Button variant="outline" onClick={fetchComprobantes} disabled={fetchState === "loading"} className="gap-2">
              {fetchState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total" value={pagination.total} tone="primary" />
            <SummaryCard label="Borradores" value={resumenEstados.BORRADOR ?? 0} tone="warning" />
            <SummaryCard label="Emitidos" value={resumenEstados.EMITIDO ?? 0} tone="success" />
            <SummaryCard label="Observados/Anulados" value={(resumenEstados.OBSERVADO ?? 0) + (resumenEstados.ANULADO ?? 0)} tone="danger" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label className="sr-only" htmlFor="search-comprobantes">
                Buscar comprobantes
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="search-comprobantes"
                  placeholder="Buscar por cliente, documento o código"
                  value={filters.search}
                  onChange={(event) => handleFilterChange("search", event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <SelectFilter
              label="Estado"
              placeholder="Todos los estados"
              value={filters.estado}
              onChange={(value) => handleFilterChange("estado", value)}
              options={ESTADOS.map((estado) => ({ value: estado, label: ESTADO_LABELS[estado] }))}
            />
            <SelectFilter
              label="Tipo"
              placeholder="Todos los tipos"
              value={filters.tipo}
              onChange={(value) => handleFilterChange("tipo", value)}
              options={TIPOS.map((tipo) => ({ value: tipo, label: TIPO_LABELS[tipo] }))}
            />
            <SelectFilter
              label="Origen"
              placeholder="Todos los origenes"
              value={filters.origen}
              onChange={(value) => handleFilterChange("origen", value)}
              options={ORIGENES.map((origen) => ({ value: origen, label: ORIGEN_LABELS[origen] }))}
            />
            <SelectFilter
              label="Serie"
              placeholder="Todas las series"
              value={filters.serie}
              onChange={(value) => handleFilterChange("serie", value)}
              options={series.map((serie) => ({
                value: serie.serie,
                label: `${serie.serie} (${TIPO_LABELS[serie.tipo]})`,
              }))}
            />
            {/* Filtro por fecha */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-gray-500">Fecha</Label>
              <Input type="date" value={filters.date ?? ""} onChange={(e) => handleFilterChange('date', e.target.value)} />
            </div>
          </div>

          <Separator />

          {fetchState === "loading" ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando comprobantes...
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-gray-500">
              <FileText className="h-10 w-10" />
              <p>No se encontraron comprobantes con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comprobante</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comprobantes.map((comprobante) => {
                      const receptorCorreo = comprobante.persona?.correo?.trim() ?? ""
                      const pdfHref = getPdfHref(comprobante.pdf_url)
                      const missingEmail = receptorCorreo.length === 0
                      const emitDisabled = comprobante.estado !== "BORRADOR" || emittingId === comprobante.id_comprobante
                      const sendDisabled = comprobante.estado !== "EMITIDO" || sendingEmailId === comprobante.id_comprobante

                      const sendButton = (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={sendDisabled}
                          onClick={() => handleSendEmail(comprobante)}
                        >
                          {sendingEmailId === comprobante.id_comprobante ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                          Enviar
                        </Button>
                      )

                      return (
                        <TableRow key={comprobante.id_comprobante}>
                          <TableCell>
                            <div className="font-medium">{comprobante.serie}-{String(comprobante.numero).padStart(8, "0")}</div>
                            <div className="text-sm text-gray-500">{TIPO_LABELS[comprobante.tipo] ?? comprobante.tipo}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{comprobante.receptor_nombre}</div>
                            <div className="text-sm text-gray-500">{comprobante.receptor_documento}</div>
                            {missingEmail ? (
                              <Badge variant="secondary" className="mt-1 bg-amber-100 text-amber-800">
                                Sin correo registrado
                              </Badge>
                            ) : (
                              <div className="mt-1 text-xs text-gray-500">{receptorCorreo}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {ORIGEN_LABELS[comprobante.origen_tipo] ?? comprobante.origen_tipo}
                            </div>
                            <div className="text-xs text-gray-500">{comprobante.codigo ?? "Sin código"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{formatCurrency(Number(comprobante.total ?? 0))}</div>
                            <div className="text-xs text-gray-500">Subtotal {formatCurrency(Number(comprobante.subtotal ?? 0))}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("font-semibold", estadoBadgeClass(comprobante.estado))}>
                              {ESTADO_LABELS[comprobante.estado] ?? comprobante.estado}
                            </Badge>
                            <div className="mt-1 text-xs text-gray-500">
                              {comprobante.estado === "EMITIDO"
                                ? `Emitido el ${formatDateTime(comprobante.fecha_emision)}`
                                : `Creado el ${formatDateTime(comprobante.creado_en)}`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleViewDetail(comprobante.id_comprobante)}>
                                <View className="h-4 w-4" /> Ver
                              </Button>
                              {pdfHref ? (
                                <Button variant="outline" size="sm" className="gap-1" asChild>
                                  <Link href={pdfHref} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" /> PDF
                                  </Link>
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" className="gap-1" disabled>
                                  <Download className="h-4 w-4" /> PDF
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={emitDisabled}
                                onClick={() => handleEmit(comprobante)}
                              >
                                {emittingId === comprobante.id_comprobante ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                Emitir
                              </Button>
                              {missingEmail ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>{sendButton}</TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-left">
                                    Este cliente no tiene un correo registrado. Podrás ingresarlo antes de enviar.
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                sendButton
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {pagination.pages > 1 && (
                <div className="flex flex-col items-center justify-between gap-3 text-sm text-gray-500 md:flex-row">
                  <div>
                    Mostrando {Math.min((page - 1) * pagination.limit + 1, pagination.total)} -
                    {" "}
                    {Math.min(page * pagination.limit, pagination.total)} de {pagination.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                      Anterior
                    </Button>
                    <span>
                      Página {page} de {pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del comprobante</DialogTitle>
            <DialogDescription>Revisa la información emitida y el detalle de ítems.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando detalle...
            </div>
          ) : selectedComprobante ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedComprobante.serie}-{String(selectedComprobante.numero).padStart(8, "0")}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {TIPO_LABELS[selectedComprobante.tipo] ?? selectedComprobante.tipo} •
                    {" "}
                    {ESTADO_LABELS[selectedComprobante.estado] ?? selectedComprobante.estado}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPdfHref ? (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <Link href={selectedPdfHref} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> Descargar PDF
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-2" disabled>
                      <Download className="h-4 w-4" /> Generando PDF…
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={selectedComprobante.estado !== "BORRADOR" || emittingId === selectedComprobante.id_comprobante}
                    onClick={() => handleEmit(selectedComprobante)}
                  >
                    {emittingId === selectedComprobante.id_comprobante ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Emitir
                  </Button>
                  {selectedDestinatario ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={selectedComprobante.estado !== "EMITIDO" || sendingEmailId === selectedComprobante.id_comprobante}
                      onClick={() => handleSendEmail(selectedComprobante)}
                    >
                      {sendingEmailId === selectedComprobante.id_comprobante ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      Enviar correo
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={selectedComprobante.estado !== "EMITIDO"}
                            onClick={() => handleSendEmail(selectedComprobante)}
                          >
                            <Mail className="h-4 w-4" />
                            Enviar correo
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-left">
                        Este cliente no tiene un correo registrado. Puedes ingresarlo antes de enviar.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border p-4 text-sm md:grid-cols-2">
                <DetailRow label="Cliente" value={selectedComprobante.receptor_nombre} />
                <DetailRow label="Documento" value={selectedComprobante.receptor_documento} />
                <DetailRow label="Correo" value={selectedComprobante.persona?.correo ?? "—"} />
                <DetailRow label="Teléfono" value={selectedComprobante.persona?.telefono ?? "—"} />
                <DetailRow label="Origen" value={`${ORIGEN_LABELS[selectedComprobante.origen_tipo] ?? selectedComprobante.origen_tipo} ${selectedComprobante.codigo ? `• ${selectedComprobante.codigo}` : ""}`} />
                <DetailRow label="Fecha de emisión" value={formatDateTime(selectedComprobante.fecha_emision)} />
                <DetailRow label="Serie" value={selectedComprobante.serie} />
                <DetailRow label="Número" value={String(selectedComprobante.numero).padStart(8, "0")} />
              </div>

              {!selectedDestinatario ? (
                <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Cliente sin correo registrado</AlertTitle>
                  <AlertDescription>
                    Actualiza la ficha del cliente o ingresa un correo manualmente antes de enviar el comprobante.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Totales</h4>
                <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-3">
                  <DetailRow label="Subtotal" value={formatCurrency(Number(selectedComprobante.subtotal ?? 0))} />
                  <DetailRow label="IGV" value={formatCurrency(Number(selectedComprobante.igv ?? 0))} />
                  <DetailRow label="Total" value={formatCurrency(Number(selectedComprobante.total ?? 0))} />
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Vista previa del PDF
                </div>
                {selectedPdfHref ? (
                  <div className="h-[480px] w-full overflow-hidden bg-slate-100">
                    <iframe
                      src={`${selectedPdfHref}#view=FitH`}
                      title={`Vista previa ${selectedComprobante.serie}-${padNumero(selectedComprobante.numero)}`}
                      className="h-full w-full"
                      loading="lazy"
                      aria-label="Vista previa del comprobante en PDF"
                    />
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    El PDF aún se está generando. Intenta actualizar en unos segundos.
                  </div>
                )}
              </div>

              <div className="rounded-lg border">
                <div className="border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Ítems del comprobante
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">P. unitario</TableHead>
                      <TableHead className="text-right">Descuento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedComprobante.detalles.map((detalle) => (
                      <TableRow key={detalle.id_comprobante_detalle}>
                        <TableCell>
                          <div className="font-medium">{detalle.descripcion}</div>
                          <div className="text-xs text-gray-500 capitalize">{detalle.tipo_item.toLowerCase()}</div>
                        </TableCell>
                        <TableCell className="text-right">{Number(detalle.cantidad ?? 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(detalle.precio_unitario ?? 0))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(detalle.descuento ?? 0))}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(Number(detalle.total ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {(selectedComprobante.descripcion || selectedComprobante.notas) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedComprobante.descripcion && (
                    <div className="rounded-lg border p-4">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Descripción</h4>
                      <p className="text-sm text-gray-700">{selectedComprobante.descripcion}</p>
                    </div>
                  )}
                  {selectedComprobante.notas && (
                    <div className="rounded-lg border p-4">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Notas</h4>
                      <p className="text-sm text-gray-700">{selectedComprobante.notas}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedComprobante.bitacoras?.length ? (
                <div className="rounded-lg border">
                  <div className="border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Historial de acciones
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    {selectedComprobante.bitacoras
                      .slice()
                      .sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
                        return dateB - dateA
                      })
                      .map((evento) => (
                        <div key={`${evento.id_comprobante_bitacora}-${evento.created_at ?? evento.accion}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                            <span className="flex-1 border-l border-dashed border-blue-200" />
                          </div>
                          <div className="flex-1 space-y-1 rounded-md bg-blue-50 p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-blue-700">{evento.accion.replace(/_/g, " ")}</span>
                              <span className="text-xs uppercase tracking-wide text-blue-500">
                                {formatDateTime(evento.created_at)}
                              </span>
                            </div>
                            {evento.descripcion && <p className="text-blue-800">{evento.descripcion}</p>}
                            <div className="text-xs text-blue-600">
                              {evento.usuario?.persona
                                ? `${evento.usuario.persona.nombre} ${evento.usuario.persona.apellido_paterno ?? ""}`.trim()
                                : "Usuario"}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-gray-500">Selecciona un comprobante para ver el detalle.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={emailDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            resetEmailDialog()
          } else {
            setEmailDialog((prev) => ({ ...prev, open: true }))
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar comprobante por correo</DialogTitle>
            <DialogDescription>
              Confirma el destinatario y personaliza el mensaje antes de enviar.
            </DialogDescription>
          </DialogHeader>

          {emailDialog.comprobante ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-4 text-sm">
                <div className="font-semibold text-gray-900">
                  {TIPO_LABELS[emailDialog.comprobante.tipo] ?? emailDialog.comprobante.tipo}
                  {" "}
                  {emailDialog.comprobante.serie}-{padNumero(emailDialog.comprobante.numero)}
                </div>
                <div className="mt-1 text-gray-600">
                  {emailDialog.comprobante.receptor_nombre}
                </div>
                <div className="text-xs text-gray-500">
                  Total {formatCurrency(Number(emailDialog.comprobante.total ?? 0))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comprobante-email">Destinatario</Label>
                <Input
                  id="comprobante-email"
                  type="email"
                  value={emailDialog.destinatario}
                  onChange={(event) =>
                    setEmailDialog((prev) => ({ ...prev, destinatario: event.target.value, error: null }))
                  }
                  placeholder="correo@cliente.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comprobante-mensaje">Mensaje</Label>
                <Textarea
                  id="comprobante-mensaje"
                  rows={5}
                  value={emailDialog.mensaje}
                  onChange={(event) =>
                    setEmailDialog((prev) => ({ ...prev, mensaje: event.target.value }))
                  }
                />
                <p className="text-xs text-gray-500">
                  El PDF generado se adjuntará automáticamente al correo.
                </p>
              </div>

              {emailDialog.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No se pudo enviar</AlertTitle>
                  <AlertDescription>{emailDialog.error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" onClick={resetEmailDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSendEmail}
              disabled={!emailDialog.comprobante || sendingEmailId === emailDialog.comprobante.id_comprobante}
              className="gap-2"
            >
              {emailDialog.comprobante && sendingEmailId === emailDialog.comprobante.id_comprobante ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Enviar comprobante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type SummaryCardProps = {
  label: string
  value: number
  tone: "primary" | "success" | "warning" | "danger"
}

const SummaryCard = ({ label, value, tone }: SummaryCardProps) => {
  const toneClass = {
    primary: "bg-blue-50 text-blue-700",
    success: "bg-green-50 text-green-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  }[tone]

  return (
    <div className={cn("rounded-lg border p-4", toneClass)}>
      <div className="text-sm uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  )
}

type DetailRowProps = {
  label: string
  value: string | number
}

const DetailRow = ({ label, value }: DetailRowProps) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value}</p>
  </div>
)

type SelectFilterProps = {
  label: string
  placeholder: string
  value?: string
  onChange: (value?: string) => void
  options: { value: string; label: string }[]
}

const SelectFilter = ({ label, placeholder, value, onChange, options }: SelectFilterProps) => (
  <div className="space-y-1">
    <Label className="text-xs uppercase tracking-wide text-gray-500">{label}</Label>
    <Select onValueChange={onChange} value={value ?? ""}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)
