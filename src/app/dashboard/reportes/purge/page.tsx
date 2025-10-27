"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { usePermisos } from "@/hooks/use-permisos"

const PurgeSchema = z.object({
  days: z
    .number({ required_error: "Ingresa un número" })
    .int("Debe ser un entero")
    .min(1, "El mínimo es 1 día")
    .max(365, "El máximo permitido es 365 días"),
})

type PurgeValues = z.infer<typeof PurgeSchema>

type PurgeResponse = {
  removedFiles: number
  freedBytes: number
}

type FetchState = "idle" | "loading"

export default function PurgePage() {
  const form = useForm<PurgeValues>({
    resolver: zodResolver(PurgeSchema),
    defaultValues: { days: 30 },
  })
  const [state, setState] = useState<FetchState>("idle")
  const [result, setResult] = useState<PurgeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { toast } = useToast()
  const { puede } = usePermisos()
  const puedeGestionar = puede("reportes.gestionar")

  const onSubmit = form.handleSubmit(async (values) => {
    if (!puedeGestionar) {
      toast({ title: "Permiso requerido", description: "No cuentas con permisos para purgar archivos.", variant: "destructive" })
      return
    }

    setState("loading")
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/reportes/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxAgeDays: values.days }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = typeof data?.error === "string" ? data.error : "No fue posible completar la purga"
        throw new Error(message)
      }

      const payload = data as PurgeResponse
      setResult(payload)
      toast({ title: "Purga ejecutada", description: `Se eliminaron ${payload.removedFiles} archivo(s).` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      setError(message)
    } finally {
      setState("idle")
    }
  })

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB", "TB"]
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / Math.pow(1024, exponent)
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Purgar exportaciones</h2>
        <p className="text-sm text-slate-600">
          Elimina archivos generados con antigüedad mayor a cierto número de días para liberar espacio local o en S3.
        </p>
      </div>

      {!puedeGestionar ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Permiso requerido</AlertTitle>
          <AlertDescription>
            Requiere el permiso <code>reportes.gestionar</code>. Contacta a un administrador.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-600" />
            Ejecutar purga
          </CardTitle>
          <CardDescription>
            Los archivos y metadatos eliminados no se podrán recuperar. Recomendamos ejecutar esta acción fuera de horarios críticos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="flex flex-col gap-4 md:flex-row md:items-end" onSubmit={onSubmit}>
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem className="max-w-[180px]">
                    <FormLabel>Antigüedad máxima (días)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={365} {...field} onChange={(event) => field.onChange(Number(event.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={state === "loading" || !puedeGestionar}>
                {state === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  "Purgar ahora"
                )}
              </Button>
            </form>
          </Form>

          {error ? (
            <Alert variant="destructive" className="mt-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No se pudo completar la purga</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result ? (
            <Card className="mt-6 bg-slate-50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Resumen</CardTitle>
                <CardDescription>Resultados entregados por la API de reportes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Archivos eliminados</span>
                  <span className="font-medium">{result.removedFiles}</span>
                </div>
                <div className="flex justify-between">
                  <span>Espacio liberado</span>
                  <span className="font-medium">{formatBytes(result.freedBytes)}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
