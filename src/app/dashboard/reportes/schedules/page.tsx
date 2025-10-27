"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  CalendarClock,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { usePermisos } from "@/hooks/use-permisos"

type ReportTemplateOption = {
  id: number
  name: string
  key: string
}

type ReportSchedule = {
  id: number
  name: string
  cron: string
  recipients: string
  params: unknown | null
  active: boolean
  createdAt: string
  lastRunAt: string | null
  nextRunAt: string | null
  template: ReportTemplateOption | null
}

const ScheduleFormSchema = z.object({
  templateId: z
    .number({ required_error: "Selecciona una plantilla" })
    .int({ message: "Selección inválida" })
    .positive("Selección inválida"),
  name: z.string().min(3, "Ingresa al menos 3 caracteres"),
  cron: z.string().min(5, "Ingresa una expresión cron válida"),
  recipients: z.string().min(3, "Ingresa al menos un destinatario"),
  params: z.string().optional().or(z.literal("")),
})

type ScheduleFormValues = z.infer<typeof ScheduleFormSchema>

type FetchState = "idle" | "loading" | "error"

const fetchJSON = async <T,>(input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, {
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // puede no haber contenido
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: string }).error ?? "")
        : typeof data === "string"
        ? data
        : ""
    throw new Error(message || "No fue posible completar la operación")
  }

  return (data ?? ({} as unknown)) as T
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
})

export default function SchedulesPage() {
  const [templates, setTemplates] = useState<ReportTemplateOption[]>([])
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [fetchState, setFetchState] = useState<FetchState>("idle")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(ScheduleFormSchema),
    defaultValues: {
      templateId: 0,
      name: "",
      cron: "0 6 * * *",
      recipients: "",
      params: "",
    },
  })

  const { toast } = useToast()
  const { puede } = usePermisos()
  const puedeGestionar = puede("reportes.gestionar")

  const loadData = useCallback(async () => {
    try {
      setFetchState("loading")
      const [templatesResponse, schedulesResponse] = await Promise.all([
        fetchJSON<ReportTemplateOption[]>("/api/reportes/templates"),
        fetchJSON<ReportSchedule[]>("/api/reportes/schedules"),
      ])
      setTemplates(templatesResponse)
      setSchedules(schedulesResponse)
      setFetchState("idle")
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible cargar las programaciones"
      setFetchState("error")
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const closeDialog = () => {
    setDialogOpen(false)
    form.reset({ templateId: 0, name: "", cron: "0 6 * * *", recipients: "", params: "" })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!puedeGestionar) {
      toast({ title: "Permiso requerido", description: "No cuentas con permisos para gestionar schedules.", variant: "destructive" })
      return
    }

    let parsedParams: unknown = undefined
    const trimmed = values.params?.trim() ?? ""
    if (trimmed.length > 0) {
      try {
        parsedParams = JSON.parse(trimmed)
      } catch {
        form.setError("params", { type: "manual", message: "JSON inválido" })
        return
      }
    }

    const payload = {
      template_id: values.templateId,
      name: values.name.trim(),
      cron: values.cron.trim(),
      recipients: values.recipients.trim(),
      params: parsedParams,
    }

    try {
      setSubmitting(true)
      await fetchJSON("/api/reportes/schedules", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast({ title: "Schedule creado", description: `${values.name} se ejecutará según el cron configurado.` })
      closeDialog()
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible crear el schedule"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  })

  const handleToggleActive = async (schedule: ReportSchedule) => {
    if (!puedeGestionar) {
      toast({ title: "Permiso requerido", description: "No cuentas con permisos para actualizar schedules.", variant: "destructive" })
      return
    }

    try {
      await fetchJSON(`/api/reportes/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !schedule.active }),
      })
      toast({ title: "Estado actualizado", description: `${schedule.name} ahora está ${!schedule.active ? "activo" : "inactivo"}.` })
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible actualizar el estado"
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  const handleDelete = async (schedule: ReportSchedule) => {
    if (!puedeGestionar) {
      toast({ title: "Permiso requerido", description: "No cuentas con permisos para eliminar schedules.", variant: "destructive" })
      return
    }

    const confirmed = typeof window === "undefined" ? true : window.confirm(`¿Eliminar la programación ${schedule.name}?`)
    if (!confirmed) return

    try {
      await fetchJSON(`/api/reportes/schedules/${schedule.id}`, {
        method: "DELETE",
      })
      toast({ title: "Schedule eliminado", description: `${schedule.name} ya no se ejecutará automáticamente.` })
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible eliminar el schedule"
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  const schedulesWithMeta = useMemo(() => {
    return schedules.map((schedule) => ({
      ...schedule,
      recipientsCount: schedule.recipients.split(",").map((value) => value.trim()).filter(Boolean).length,
    }))
  }, [schedules])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Programaciones</h2>
          <p className="text-sm text-slate-600">Automatiza la generación y envío de reportes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={fetchState === "loading"}>
            <RefreshCcw className="mr-2 h-4 w-4" />Actualizar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)} disabled={!puedeGestionar || templates.length === 0}>
                <Plus className="mr-2 h-4 w-4" />Nuevo schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Crear schedule</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={onSubmit}>
                  <FormField
                    control={form.control}
                    name="templateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plantilla</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(value) => field.onChange(Number(value))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona una plantilla" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={String(template.id)}>
                                  {template.name} ({template.key})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Reporte diario" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cron"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expresión cron</FormLabel>
                        <FormControl>
                          <Input placeholder="0 6 * * *" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recipients"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destinatarios</FormLabel>
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
                    name="params"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parámetros adicionales (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            placeholder={'{ "desde": "2025-01-01" }'}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button variant="ghost" type="button" onClick={closeDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando
                        </>
                      ) : (
                        "Crear schedule"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {fetchState === "error" ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar los schedules</AlertTitle>
          <AlertDescription>Intenta de nuevo con el botón Actualizar.</AlertDescription>
        </Alert>
      ) : null}

      {fetchState === "loading" ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : schedulesWithMeta.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500">
          No hay programaciones registradas. Configura la primera para habilitar envíos automáticos.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead className="hidden lg:table-cell">Próxima ejecución</TableHead>
              <TableHead className="hidden xl:table-cell">Última ejecución</TableHead>
              <TableHead>Destinatarios</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedulesWithMeta.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">{schedule.name}</TableCell>
                <TableCell>
                  {schedule.template ? (
                    <Badge variant="outline">{schedule.template.key}</Badge>
                  ) : (
                    <span className="text-xs text-slate-500">Plantilla eliminada</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-slate-500">
                  {schedule.nextRunAt ? dateTimeFormatter.format(new Date(schedule.nextRunAt)) : "Sin programar"}
                </TableCell>
                <TableCell className="hidden xl:table-cell text-xs text-slate-500">
                  {schedule.lastRunAt ? dateTimeFormatter.format(new Date(schedule.lastRunAt)) : "Nunca"}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {schedule.recipients}
                  <div className="text-[11px] text-slate-400">{schedule.recipientsCount} destinatario(s)</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={schedule.active} onCheckedChange={() => handleToggleActive(schedule)} disabled={!puedeGestionar} />
                    <span className="text-xs text-slate-500">
                      {schedule.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleToggleActive(schedule)} disabled={!puedeGestionar}>
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {schedule.active ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(schedule)}
                        variant="destructive"
                        disabled={!puedeGestionar}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
