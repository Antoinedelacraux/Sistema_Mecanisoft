"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import type { FacturacionConfigCompleta } from "@/types"
import { RefreshCcw, PlusCircle, Factory, Receipt, Settings, ShieldCheck } from "lucide-react"

const configSchema = z.object({
  afecta_igv: z.boolean(),
  igv_porcentaje: z
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Ingresa un porcentaje válido",
    })
    .min(0, "Debe ser mayor o igual a 0")
    .max(1, "Debe ser menor o igual a 1"),
  precios_incluyen_igv_default: z.boolean(),
  serie_boleta_default: z
    .string()
    .min(1, "Serie requerida")
    .max(10, "Máximo 10 caracteres"),
  serie_factura_default: z
    .string()
    .min(1, "Serie requerida")
    .max(10, "Máximo 10 caracteres"),
  moneda_default: z
    .string()
    .length(3, "Debe tener 3 caracteres"),
})

const serieSchema = z.object({
  tipo: z.enum(["BOLETA", "FACTURA"]),
  serie: z
    .string()
    .min(1, "Serie requerida")
    .max(10, "Máximo 10 caracteres"),
  descripcion: z
    .string()
    .max(150, "Máximo 150 caracteres")
    .optional()
    .or(z.literal("")),
  correlativo_inicial: z
    .number()
    .refine((value) => Number.isFinite(value), {
      message: "Debe ser un número",
    })
    .int("Debe ser entero")
    .min(0, "Debe ser positivo")
    .optional(),
  activo: z.boolean(),
  establecer_como_default: z.boolean(),
})

const toNumberSafe = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number.parseFloat(value)
  if (typeof value === "bigint") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    try {
      const fn = (value as { toNumber?: () => number }).toNumber
      return typeof fn === "function" ? fn() : Number(value as never)
    } catch (error) {
      console.error("Error convirtiendo decimal", error)
    }
  }
  return Number(value ?? 0)
}

const normalizarSerie = (serie: FacturacionConfigCompleta["series"][number]) => ({
  ...serie,
  correlativo_actual: toNumberSafe(serie.correlativo_actual),
})

type ConfigFormValues = z.infer<typeof configSchema>
type SerieFormValues = z.infer<typeof serieSchema>
type Serie = ReturnType<typeof normalizarSerie>
type ConfigState = Omit<FacturacionConfigCompleta, "series" | "igv_porcentaje"> & {
  igv_porcentaje: number
  series: Serie[]
}

export function FacturacionSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [creatingSerie, setCreatingSerie] = useState(false)
  const [seriesFilter, setSeriesFilter] = useState<"ALL" | "BOLETA" | "FACTURA">("ALL")

  const configForm = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      afecta_igv: true,
      igv_porcentaje: 0.18,
      precios_incluyen_igv_default: true,
      serie_boleta_default: "B001",
      serie_factura_default: "F001",
      moneda_default: "PEN",
    },
  })

  const serieForm = useForm<SerieFormValues>({
    resolver: zodResolver(serieSchema),
    defaultValues: {
      tipo: "BOLETA",
      serie: "",
      descripcion: "",
      correlativo_inicial: 0,
      activo: true,
      establecer_como_default: false,
    },
  })

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/facturacion/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error ?? "No se pudo cargar la configuración")
      }

      const payload = (await response.json()) as { data: FacturacionConfigCompleta }
      const normalizedSeries = payload.data.series.map(normalizarSerie)

      const nextConfig: ConfigState = {
        ...payload.data,
        igv_porcentaje: toNumberSafe(payload.data.igv_porcentaje),
        series: normalizedSeries,
      }

      setConfig(nextConfig)
      configForm.reset({
        afecta_igv: nextConfig.afecta_igv,
        igv_porcentaje: nextConfig.igv_porcentaje,
        precios_incluyen_igv_default: nextConfig.precios_incluyen_igv_default,
        serie_boleta_default: nextConfig.serie_boleta_default,
        serie_factura_default: nextConfig.serie_factura_default,
        moneda_default: nextConfig.moneda_default,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error inesperado"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }, [configForm, toast])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const filteredSeries = useMemo(() => {
    if (!config) return []
    if (seriesFilter === "ALL") return config.series
    return config.series.filter((serie) => serie.tipo === seriesFilter)
  }, [config, seriesFilter])

  const resumenSeries = useMemo(() => {
    if (!config) return { total: 0, boletas: 0, facturas: 0 }
    const boletas = config.series.filter((serie) => serie.tipo === "BOLETA").length
    const facturas = config.series.filter((serie) => serie.tipo === "FACTURA").length
    return {
      total: config.series.length,
      boletas,
      facturas,
    }
  }, [config])

  const handleConfigSubmit = async (values: ConfigFormValues) => {
    if (!config) return
    try {
      setSavingConfig(true)
      const response = await fetch("/api/facturacion/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          serie_boleta_default: values.serie_boleta_default.trim().toUpperCase(),
          serie_factura_default: values.serie_factura_default.trim().toUpperCase(),
          moneda_default: values.moneda_default.trim().toUpperCase(),
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error ?? "No se pudo actualizar la configuración")
      }

      const payload = (await response.json()) as { data: FacturacionConfigCompleta }
      const normalizedSeries = payload.data.series.map(normalizarSerie)

      const nextConfig: ConfigState = {
        ...payload.data,
        igv_porcentaje: toNumberSafe(payload.data.igv_porcentaje),
        series: normalizedSeries,
      }

      setConfig(nextConfig)
      configForm.reset({
        afecta_igv: nextConfig.afecta_igv,
        igv_porcentaje: nextConfig.igv_porcentaje,
        precios_incluyen_igv_default: nextConfig.precios_incluyen_igv_default,
        serie_boleta_default: nextConfig.serie_boleta_default,
        serie_factura_default: nextConfig.serie_factura_default,
        moneda_default: nextConfig.moneda_default,
      })

      toast({
        title: "Configuración actualizada",
        description: "Las preferencias de facturación se guardaron correctamente.",
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error inesperado"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSerieSubmit = async (values: SerieFormValues) => {
    try {
      setCreatingSerie(true)
      const payload = {
        ...values,
        serie: values.serie.trim().toUpperCase(),
        descripcion: values.descripcion?.trim() || undefined,
        correlativo_inicial:
          typeof values.correlativo_inicial === "number" && !Number.isNaN(values.correlativo_inicial)
            ? values.correlativo_inicial
            : undefined,
      }

      const response = await fetch("/api/facturacion/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error ?? "No se pudo crear la serie")
      }

      serieForm.reset({
        tipo: values.tipo,
        serie: "",
        descripcion: "",
        correlativo_inicial: 0,
        activo: true,
        establecer_como_default: false,
      })

      toast({
        title: "Serie creada",
        description: `Se registró la serie ${payload.serie} para ${values.tipo.toLowerCase()}.`,
      })

      await fetchConfig()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error inesperado"
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setCreatingSerie(false)
    }
  }

  if (loading && !config) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Configuración de facturación</h1>
          <p className="text-muted-foreground">No se encontró configuración. Intenta recargar.</p>
        </div>
        <Button onClick={fetchConfig} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" /> Volver a intentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración de facturación</h1>
          <p className="text-muted-foreground">
            Administra los parámetros tributarios y las series de comprobantes.
          </p>
        </div>
        <Button onClick={fetchConfig} variant="ghost" className="gap-2" disabled={loading}>
          <RefreshCcw className="h-4 w-4" /> Refrescar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Preferencias fiscales
            </CardTitle>
            <CardDescription>
              Define el comportamiento del cálculo de IGV, las series por defecto y la moneda principal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={configForm.handleSubmit(handleConfigSubmit)}
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="igv_porcentaje">Porcentaje IGV (0 - 1)</Label>
                  <Input
                    id="igv_porcentaje"
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    {...configForm.register("igv_porcentaje", { valueAsNumber: true })}
                  />
                  {configForm.formState.errors.igv_porcentaje && (
                    <p className="text-sm text-destructive">
                      {configForm.formState.errors.igv_porcentaje.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="moneda_default">Moneda por defecto</Label>
                  <Input
                    id="moneda_default"
                    maxLength={3}
                    {...configForm.register("moneda_default")}
                  />
                  {configForm.formState.errors.moneda_default && (
                    <p className="text-sm text-destructive">
                      {configForm.formState.errors.moneda_default.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serie_boleta_default">Serie boleta por defecto</Label>
                  <Input
                    id="serie_boleta_default"
                    {...configForm.register("serie_boleta_default")}
                  />
                  {configForm.formState.errors.serie_boleta_default && (
                    <p className="text-sm text-destructive">
                      {configForm.formState.errors.serie_boleta_default.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serie_factura_default">Serie factura por defecto</Label>
                  <Input
                    id="serie_factura_default"
                    {...configForm.register("serie_factura_default")}
                  />
                  {configForm.formState.errors.serie_factura_default && (
                    <p className="text-sm text-destructive">
                      {configForm.formState.errors.serie_factura_default.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={configForm.control}
                  name="afecta_igv"
                  render={({ field }) => (
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Aplicar IGV a los comprobantes</p>
                        <p className="text-sm text-muted-foreground">
                          Determina si los totales calculan el impuesto automáticamente.
                        </p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />

                <Controller
                  control={configForm.control}
                  name="precios_incluyen_igv_default"
                  render={({ field }) => (
                    <div className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Precios incluyen IGV</p>
                        <p className="text-sm text-muted-foreground">
                          Usa este valor por defecto al preparar nuevos comprobantes.
                        </p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="gap-2" disabled={savingConfig}>
                  <ShieldCheck className="h-4 w-4" />
                  Guardar configuración
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" /> Resumen de series
            </CardTitle>
            <CardDescription>
              Revisa las series activas y las predeterminadas para cada tipo de comprobante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Series totales</p>
                <p className="text-2xl font-semibold">{resumenSeries.total}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Series boleta</p>
                  <p className="text-xl font-semibold">{resumenSeries.boletas}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Series factura</p>
                  <p className="text-xl font-semibold">{resumenSeries.facturas}</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Serie boleta por defecto</p>
                <Badge variant="outline" className="text-base font-semibold">
                  {config.serie_boleta_default}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Serie factura por defecto</p>
                <Badge variant="outline" className="text-base font-semibold">
                  {config.serie_factura_default}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" /> Registrar nueva serie
          </CardTitle>
          <CardDescription>
            Las series deben coincidir con las autorizadas por SUNAT. Puedes marcarla como predeterminada al crearla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-5" onSubmit={serieForm.handleSubmit(handleSerieSubmit)} noValidate>
            <div className="md:col-span-1">
              <Label>Tipo</Label>
              <Controller
                control={serieForm.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOLETA">Boleta</SelectItem>
                      <SelectItem value="FACTURA">Factura</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="serie">Serie</Label>
              <Input id="serie" {...serieForm.register("serie")} />
              {serieForm.formState.errors.serie && (
                <p className="text-sm text-destructive">
                  {serieForm.formState.errors.serie.message}
                </p>
              )}
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="correlativo_inicial">Correlativo inicial</Label>
              <Input
                id="correlativo_inicial"
                type="number"
                min={0}
                step={1}
                {...serieForm.register("correlativo_inicial", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) {
                      return undefined
                    }
                    const parsed = Number(value)
                    return Number.isNaN(parsed) ? undefined : parsed
                  },
                })}
              />
              {serieForm.formState.errors.correlativo_inicial && (
                <p className="text-sm text-destructive">
                  {serieForm.formState.errors.correlativo_inicial.message}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input id="descripcion" {...serieForm.register("descripcion")} placeholder="Uso interno" />
              {serieForm.formState.errors.descripcion && (
                <p className="text-sm text-destructive">
                  {serieForm.formState.errors.descripcion.message}
                </p>
              )}
            </div>

            <div className="md:col-span-5 grid gap-3 sm:grid-cols-2">
              <Controller
                control={serieForm.control}
                name="activo"
                render={({ field }) => (
                  <div className="flex items-start justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">Serie activa</p>
                      <p className="text-sm text-muted-foreground">Solo las series activas pueden emitir comprobantes.</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />

              <Controller
                control={serieForm.control}
                name="establecer_como_default"
                render={({ field }) => (
                  <div className="flex items-start justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">Marcar como predeterminada</p>
                      <p className="text-sm text-muted-foreground">
                        Actualiza la configuración para usar esta serie por defecto.
                      </p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>

            <div className="md:col-span-5 flex justify-end">
              <Button type="submit" className="gap-2" disabled={creatingSerie}>
                <Receipt className="h-4 w-4" /> Crear serie
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Series registradas</CardTitle>
            <CardDescription>Historial de series autorizadas para facturación electrónica.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={seriesFilter} onValueChange={(value: "ALL" | "BOLETA" | "FACTURA") => setSeriesFilter(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="BOLETA">Boletas</SelectItem>
                <SelectItem value="FACTURA">Facturas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Correlativo actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Predeterminada</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay series registradas para el filtro seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSeries.map((serie) => {
                  const isDefault =
                    (serie.tipo === "BOLETA" && serie.serie === config.serie_boleta_default) ||
                    (serie.tipo === "FACTURA" && serie.serie === config.serie_factura_default)

                  return (
                    <TableRow key={`${serie.tipo}-${serie.serie}`}>
                      <TableCell className="font-medium">{serie.serie}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {serie.tipo === "BOLETA" ? "Boleta" : "Factura"}
                        </Badge>
                      </TableCell>
                      <TableCell>{serie.correlativo_actual}</TableCell>
                      <TableCell>
                        <Badge variant={serie.activo ? "outline" : "destructive"}>
                          {serie.activo ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isDefault ? (
                          <Badge variant="default">Predeterminada</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={serie.descripcion ?? undefined}>
                        {serie.descripcion || "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default FacturacionSettings
