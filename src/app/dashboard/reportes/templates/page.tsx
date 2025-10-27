"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  AlertCircle,
  Loader2,
  MoreVertical,
  PencilLine,
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
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { usePermisos } from "@/hooks/use-permisos"

type ReportTemplate = {
  id: number
  name: string
  description: string | null
  key: string
  defaultParams: unknown | null
  createdAt: string
}

const TemplateFormSchema = z.object({
  name: z.string().min(3, "Ingresa al menos 3 caracteres"),
  key: z
    .string()
    .min(3, "Debe tener mínimo 3 caracteres")
    .regex(/^[a-z0-9_\-]+$/i, "Solo letras, números, guiones y guiones bajos"),
  description: z.string().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  defaultParams: z.string().optional().or(z.literal("")),
})

type TemplateFormValues = z.infer<typeof TemplateFormSchema>

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
    // La respuesta puede no tener cuerpo
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: string }).error ?? "")
        : typeof data === "string"
        ? data
        : ""
    throw new Error(errorMessage || "No fue posible completar la operación")
  }

  return (data ?? ({} as unknown)) as T
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
})

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [fetchState, setFetchState] = useState<FetchState>("idle")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(TemplateFormSchema),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      defaultParams: "",
    },
  })

  const { toast } = useToast()
  const { puede } = usePermisos()
  const puedeGestionar = puede("reportes.gestionar")

  const loadTemplates = useCallback(async () => {
    try {
      setFetchState("loading")
      const data = await fetchJSON<ReportTemplate[]>("/api/reportes/templates")
      setTemplates(data)
      setFetchState("idle")
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible cargar las plantillas"
      setFetchState("error")
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleOpenCreate = () => {
    setMode("create")
    setEditingTemplate(null)
    form.reset({
      name: "",
      key: "",
      description: "",
      defaultParams: "",
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (template: ReportTemplate) => {
    setMode("edit")
    setEditingTemplate(template)
    form.reset({
      name: template.name,
      key: template.key,
      description: template.description ?? "",
      defaultParams: template.defaultParams
        ? JSON.stringify(template.defaultParams, null, 2)
        : "",
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingTemplate(null)
    form.reset()
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!puedeGestionar) {
      toast({ title: "Permiso requerido", description: "No cuentas con permisos para gestionar plantillas.", variant: "destructive" })
      return
    }

    let parsedDefault: unknown = undefined
    const trimmedJSON = values.defaultParams?.trim() ?? ""
    if (trimmedJSON.length > 0) {
      try {
         parsedDefault = JSON.parse(trimmedJSON)
       } catch {
        form.setError("defaultParams", {
          type: "manual",
          message: "JSON inválido. Verifica la sintaxis.",
        })
        return
      }
    } else if (mode === "edit") {
      parsedDefault = null
    }

    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      description: values.description?.trim() ? values.description.trim() : null,
      default_params: parsedDefault,
    }

    const createPayload = {
      ...payload,
      key: values.key.trim(),
    }

    try {
      setSubmitting(true)
      if (mode === "create") {
        await fetchJSON("/api/reportes/templates", {
          method: "POST",
          body: JSON.stringify(createPayload),
        })
        toast({ title: "Plantilla creada", description: `${values.name} está disponible.` })
      } else if (editingTemplate) {
        await fetchJSON(`/api/reportes/templates/${editingTemplate.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast({ title: "Cambios guardados", description: `${values.name} fue actualizada.` })
      }
      closeDialog()
      await loadTemplates()
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible guardar la plantilla"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  })

  const handleDelete = async (template: ReportTemplate) => {
    if (!puedeGestionar) {
      toast({ title: "Permiso requerido", description: "No cuentas con permisos para eliminar plantillas.", variant: "destructive" })
      return
    }

    const confirmed = typeof window === "undefined" ? true : window.confirm(`¿Eliminar la plantilla ${template.name}?`)
    if (!confirmed) return

    try {
      await fetchJSON(`/api/reportes/templates/${template.id}`, {
        method: "DELETE",
      })
      toast({ title: "Plantilla eliminada", description: `${template.name} fue eliminada.` })
      await loadTemplates()
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible eliminar la plantilla"
      toast({ title: "Error", description: message, variant: "destructive" })
    }
  }

  const templatesWithMeta = useMemo(() => {
    return templates.map((template) => ({
      ...template,
      hasDefaultParams: template.defaultParams != null,
    }))
  }, [templates])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Plantillas</h2>
          <p className="text-sm text-slate-600">Define los formatos reutilizables para tus reportes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTemplates} disabled={fetchState === "loading"}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} disabled={!puedeGestionar}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{mode === "create" ? "Registrar plantilla" : "Editar plantilla"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={onSubmit}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Ventas mensuales" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Llave interna</FormLabel>
                        <FormControl>
                          <Input placeholder="ventas_resumen" disabled={mode === "edit"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descripción corta del contenido del reporte"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultParams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parámetros por defecto (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={6}
                            placeholder={'{ "desde": "2025-01-01", "hasta": "2025-01-31" }'}
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando
                        </>
                      ) : mode === "create" ? (
                        "Crear"
                      ) : (
                        "Guardar"
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
          <AlertTitle>Ocurrió un problema al cargar las plantillas</AlertTitle>
          <AlertDescription>
            Intenta nuevamente con el botón Actualizar o recarga la página.
          </AlertDescription>
        </Alert>
      ) : null}

      {fetchState === "loading" ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : templatesWithMeta.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500">
          No hay plantillas registradas. Crea la primera para comenzar.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Llave</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templatesWithMeta.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{template.key}</Badge>
                    {template.hasDefaultParams ? (
                      <Badge variant="secondary">Con parámetros</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {template.description ? template.description : "Sin descripción"}
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {dateTimeFormatter.format(new Date(template.createdAt))}
                </TableCell>
                <TableCell className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleOpenEdit(template)} disabled={!puedeGestionar}>
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(template)}
                        variant="destructive"
                        disabled={!puedeGestionar}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
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
