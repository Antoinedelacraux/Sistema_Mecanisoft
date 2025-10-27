"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Download, Loader2, PlayCircle, Table as TableIcon } from "lucide-react"

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { usePermisos } from "@/hooks/use-permisos"

const VentasFormSchema = z
  .object({
    fechaInicio: z.string().min(1, "Selecciona una fecha de inicio"),
    fechaFin: z.string().min(1, "Selecciona una fecha de fin"),
    agrupar: z.enum(["dia", "semana", "mes", "producto", "vendedor"]),
    formato: z.enum(["csv", "xlsx", "pdf"]),
    recipients: z.string().optional().or(z.literal("")),
    notas: z.string().optional().or(z.literal("")),
  })
  .refine((data) => new Date(data.fechaInicio) <= new Date(data.fechaFin), {
    message: "La fecha de inicio no puede ser mayor que la fecha final",
    path: ["fechaFin"],
  })

type VentasFormValues = z.infer<typeof VentasFormSchema>

type PreviewRow = Record<string, unknown>

type GenerateResponse =
  | { success: true; queued: true; jobId?: string }
  | { success: true; queued: false; result: { outPath: string; elapsedMs?: number } }
  | { success: false; error: string }

type PreviewResponse = {
  success: boolean
  data?: PreviewRow[]
  error?: string
}

const dateFormatter = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" })

type GenerationSummary =
  | { status: "queued"; jobId?: string }
  | { status: "completed"; outPath: string; elapsedMs?: number }

export default function VentasResumenPage() {
  const form = useForm<VentasFormValues>({
    resolver: zodResolver(VentasFormSchema),
    defaultValues: {
      fechaInicio: new Date().toISOString().slice(0, 10),
      fechaFin: new Date().toISOString().slice(0, 10),
      agrupar: "dia",
      formato: "csv",
      recipients: "",
      notas: "",
    },
  })

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [generationSummary, setGenerationSummary] = useState<GenerationSummary | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)

  const { toast } = useToast()
  const { puede } = usePermisos()
  const puedeVer = puede("reportes.ver")
  const puedeDescargar = puede("reportes.descargar")

  const tableHeaders = useMemo(() => {
    if (previewRows.length === 0) return [] as string[]
    return Object.keys(previewRows[0] ?? {})
  }, [previewRows])

  const previewReport = form.handleSubmit(async (values) => {
    if (!puedeVer) {
      toast({ title: "Sin permisos", description: "No cuentas con permisos para ver reportes.", variant: "destructive" })
      return
    }
    setPreviewLoading(true)
  setGenerationSummary(null)
    try {
      const response = await fetch("/api/reportes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "ventas_resumen",
          params: {
            fechaInicio: values.fechaInicio,
            fechaFin: values.fechaFin,
            agrupar_por: values.agrupar,
          },
          preview: true,
        }),
      })
      const data: PreviewResponse = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "No fue posible obtener el preview")
      }
      setPreviewRows(Array.isArray(data.data) ? data.data : [])
      if (!Array.isArray(data.data) || data.data.length === 0) {
        toast({ title: "Sin datos", description: "La consulta no retornó registros para el rango seleccionado." })
      } else {
        toast({ title: "Preview listo", description: `${data.data.length} fila(s) recuperadas.` })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setPreviewLoading(false)
    }
  })

  const generateReport = form.handleSubmit(async (values) => {
    if (!puedeDescargar) {
      toast({ title: "Sin permisos", description: "Solicita a un administrador acceso para generar exportaciones.", variant: "destructive" })
      return
    }
    setGenerateLoading(true)
  setGenerationSummary(null)
    try {
      const response = await fetch("/api/reportes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "ventas_resumen",
          format: values.formato,
          params: {
            fechaInicio: values.fechaInicio,
            fechaFin: values.fechaFin,
            agrupar_por: values.agrupar,
            notas: values.notas,
          },
          recipients: values.recipients,
        }),
      })
      const data: GenerateResponse = await response.json()
      if (!response.ok || !("success" in data) || !data.success) {
        const message = (data as { error?: string })?.error ?? "No fue posible generar el reporte"
        throw new Error(message)
      }
      if (data.queued) {
        setGenerationSummary({ status: "queued", jobId: data.jobId })
        toast({ title: "Reporte en cola", description: "Se programó la generación en segundo plano." })
      } else if ("result" in data) {
        setGenerationSummary({ status: "completed", outPath: data.result.outPath, elapsedMs: data.result.elapsedMs })
        toast({ title: "Reporte generado", description: "El archivo está disponible para descarga." })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setGenerateLoading(false)
    }
  })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
  <h2 className="text-2xl font-semibold text-slate-900">Ventas - Resumen</h2>
        <p className="text-sm text-slate-600">
          Obtén un consolidado por día, semana, mes, producto o vendedor. Usa el preview para validar los datos antes de exportar.
        </p>
      </header>

      <Form {...form}>
        <form className="grid gap-4 rounded-lg border bg-white p-6 shadow-sm" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="fechaInicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha inicio</FormLabel>
                  <FormControl>
                    <Input type="date" max={form.getValues("fechaFin")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fechaFin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha fin</FormLabel>
                  <FormControl>
                    <Input type="date" min={form.getValues("fechaInicio")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agrupar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agrupar por</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Agrupar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dia">Día</SelectItem>
                        <SelectItem value="semana">Semana</SelectItem>
                        <SelectItem value="mes">Mes</SelectItem>
                        <SelectItem value="producto">Producto</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="formato"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formato</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="xlsx">Excel</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem className="md:col-span-2 lg:col-span-3">
                  <FormLabel>Destinatarios (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="correo@empresa.com, gerente@empresa.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem className="md:col-span-2 lg:col-span-3">
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Observaciones internas para el equipo" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={previewReport} disabled={previewLoading || !puedeVer}>
              {previewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando preview
                </>
              ) : (
                <>
                  <TableIcon className="mr-2 h-4 w-4" />
                  Ver preview
                </>
              )}
            </Button>

            <Button type="button" variant="secondary" onClick={generateReport} disabled={generateLoading || !puedeDescargar}>
              {generateLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generar reporte
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {generationSummary ? (
        <Alert className="bg-slate-50">
          <PlayCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle>Reporte en proceso</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            {generationSummary.status === "queued" ? (
              <>
                <p>
                  El reporte fue encolado en el worker. Recibirás un correo si agregaste destinatarios o podrás descargarlo más tarde desde la sección Exportaciones recientes.
                </p>
                {generationSummary.jobId ? (
                  <p className="text-xs text-slate-500">ID de job: {generationSummary.jobId}</p>
                ) : null}
              </>
            ) : (
              <>
                <p>
                  El reporte se generó de inmediato. Revisa Exportaciones recientes para descargar el archivo.
                </p>
                <p className="text-xs text-slate-500">
                  Ruta almacenada: <code>{generationSummary.outPath}</code>
                  {typeof generationSummary.elapsedMs === "number" ? ` · ${generationSummary.elapsedMs} ms` : ""}
                </p>
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Resultado del preview</h3>
          <Badge variant="secondary">{previewRows.length} fila(s)</Badge>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          {previewRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Ejecuta un preview para visualizar los datos.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {tableHeaders.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, index) => (
                  <TableRow key={index}>
                    {tableHeaders.map((header) => (
                      <TableCell key={header} className="align-top text-xs">
                        {formatCellValue(row[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  )
}

function formatCellValue(value: unknown) {
  if (value == null) return ""
  if (value instanceof Date) return dateFormatter.format(value)
  if (typeof value === "number") return value.toLocaleString("es-PE")
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed) && value.includes("-")) {
      return dateFormatter.format(new Date(parsed))
    }
    return value
  }
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
