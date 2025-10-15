"use client"

import { useMemo, useState, useEffect, useRef } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import ProveedorAutocomplete, { type ProveedorBasicoOption } from '@/components/inventario/basico/proveedor-autocomplete'
import ProductoAutocomplete, { type ProductoBasicoOption } from '@/components/inventario/basico/producto-autocomplete'
import ProveedorForm from '@/components/inventario/basico/proveedor-form'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type LineaState = {
  producto: ProductoBasicoOption | null
  cantidad: string
  precio_unitario: string
}

const nuevaLinea = (): LineaState => ({ producto: null, cantidad: '', precio_unitario: '' })

// Reescribimos el componente manteniendo la funcionalidad original
const CompraRapidaForm = ({ onSuccess, initialLines, initialProveedorId }: { onSuccess?: () => void, initialLines?: LineaState[], initialProveedorId?: number }) => {
  const router = useRouter()

  const [proveedor, setProveedor] = useState<ProveedorBasicoOption | null>(null)
  const [fecha, setFecha] = useState('')
  const [lineas, setLineas] = useState<LineaState[]>(initialLines ?? [nuevaLinea()])
  const [nota, setNota] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProveedorSheetOpen, setProveedorSheetOpen] = useState(false)

  const resetFeedback = () => {
    setMessage(null)
    setError(null)
  }

  const handleLineaChange = (index: number, field: 'cantidad' | 'precio_unitario', value: string) => {
    setLineas((prev) => prev.map((linea, idx) => (idx === index ? { ...linea, [field]: value } : linea)))
  }

  const handleProductoSelect = (index: number, producto: ProductoBasicoOption | null) => {
    setLineas((prev) => prev.map((linea, idx) => (idx === index ? { ...linea, producto } : linea)))
  }

  const handleAddLinea = () => setLineas((prev) => [...prev, nuevaLinea()])
  const handleRemoveLinea = (index: number) => setLineas((prev) => prev.filter((_, idx) => idx !== index))

  const handleProveedorRegistrado = (nuevoProveedor: ProveedorBasicoOption) => {
    setProveedor(nuevoProveedor)
    setProveedorSheetOpen(false)
    setMessage('Proveedor registrado correctamente')
  }

  // Fallback: si no vienen initialLines, soportar legacy param preselect_producto
  useEffect(() => {
    if (initialLines && initialLines.length > 0) return
    try {
      const params = new URLSearchParams(window.location.search)
      const pid = params.get('preselect_producto')
      if (!pid) return
      const idNum = Number.parseInt(pid, 10)
      if (!Number.isInteger(idNum)) return

      ;(async () => {
        try {
          const res = await fetch(`/api/productos/${idNum}`)
          if (!res.ok) return
          const data = await res.json()
          const option = {
            id_producto: data.id_producto,
            nombre: data.nombre,
            codigo_producto: data.codigo_producto,
            unidad: data.unidad_medida?.nombre_unidad ?? '',
            stock_disponible: '0',
            stock_comprometido: '0',
            costo_promedio: '0',
          }
          setLineas([{ producto: option, cantidad: '0', precio_unitario: '0' }])
        } catch (e) {
          // ignore
        }
      })()
    } catch (e) {
      // ignore
    }
  }, [initialLines])

  // Si se dio initialProveedorId, intentar precargar
  useEffect(() => {
    if (!initialProveedorId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/inventario/proveedores?id=${initialProveedorId}`)
        if (!res.ok) return
        const data = await res.json()
        const p = data.proveedores?.[0]
        if (p) {
          setProveedor({ id_proveedor: p.id_proveedor, razon_social: p.razon_social, nombre_comercial: p.nombre_comercial ?? null, contacto: p.contacto ?? null, numero_contacto: p.numero_contacto ?? null })
        }
      } catch (e) {
        // ignore
      }
    })()
  }, [initialProveedorId])

  const cantidadRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()

  // Autofocus en la primera línea cuando hay datos iniciales
  useEffect(() => {
    if (lineas.length > 0) {
      // darle un pequeño delay para cuando el input esté montado
      setTimeout(() => {
        cantidadRef.current?.focus()
      }, 50)
    }
  }, [lineas])

  const totalCalculado = useMemo(() => {
    return lineas.reduce((acc, linea) => {
      const cantidad = Number.parseFloat(linea.cantidad || '0')
      const precio = Number.parseFloat(linea.precio_unitario || '0')
      if (Number.isFinite(cantidad) && Number.isFinite(precio)) {
        return acc + cantidad * precio
      }
      return acc
    }, 0)
  }, [lineas])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    if (!proveedor) {
      setError('Selecciona un proveedor')
      return
    }

    const payloadLineas = lineas
      .map((linea) => ({
        id_producto: linea.producto?.id_producto ?? NaN,
        cantidad: linea.cantidad.trim(),
        precio_unitario: linea.precio_unitario.trim(),
      }))
      .filter((linea) => Number.isInteger(linea.id_producto) && linea.cantidad && linea.precio_unitario)

    if (payloadLineas.length === 0) {
      setError('Agrega al menos una línea válida')
      return
    }

    setIsSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        id_proveedor: proveedor.id_proveedor,
        lineas: payloadLineas,
      }

      if (fecha.trim()) body.fecha = fecha
      if (nota.trim()) body.referencia = nota.trim()

      const response = await fetch('/api/inventario/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const info = await response.json().catch(() => ({}))
        throw new Error(info.error || 'No se pudo registrar la compra')
      }

  setMessage('Compra registrada correctamente')
      setProveedor(null)
      setFecha('')
      setNota('')
      setLineas([nuevaLinea()])
      router.refresh()
  toast({ title: 'Entrada registrada', description: 'La entrada de inventario se registró correctamente.' })
  onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al registrar la compra')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Registrar compra rápida</h2>
      <p className="text-sm text-muted-foreground">Registra una entrada rápida para asignar el stock inicial y mantener el historial de movimientos.</p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="proveedorId">Proveedor</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <ProveedorAutocomplete value={proveedor} onChange={setProveedor} disabled={isSubmitting} />
            </div>
            <div className="shrink-0">
              <Button type="button" variant="default" onClick={() => setProveedorSheetOpen(true)} disabled={isSubmitting} className="h-9">
                Nuevo proveedor
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fechaCompra">Fecha (opcional)</Label>
          <Input id="fechaCompra" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={isSubmitting} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Líneas de compra</h3>
            <Button type="button" variant="outline" size="sm" onClick={handleAddLinea} disabled={isSubmitting}>
              <Plus className="h-4 w-4" /> Agregar línea
            </Button>
          </div>

          <div className="space-y-3">
            {lineas.map((linea, index) => (
              <div key={index} className="rounded-md border border-dashed border-muted-foreground/40 p-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end sm:gap-3 items-center">
                  <div className="grid gap-1">
                    <Label className="text-xs">Producto</Label>
                    <div className="w-full">
                      <ProductoAutocomplete value={linea.producto} onChange={(p) => handleProductoSelect(index, p)} disabled={isSubmitting} />
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <Label htmlFor={`cantidad-${index}`} className="text-xs">Cantidad</Label>
                    <Input id={`cantidad-${index}`} ref={index === 0 ? cantidadRef : undefined} className="w-full text-right" type="number" step="0.01" min={0} value={linea.cantidad} onChange={(e) => handleLineaChange(index, 'cantidad', e.target.value)} disabled={isSubmitting} required />
                  </div>

                  <div className="grid gap-1">
                    <Label htmlFor={`precio-${index}`} className="text-xs">Precio unitario</Label>
                    <Input id={`precio-${index}`} className="w-full text-right" type="number" step="0.01" min={0} value={linea.precio_unitario} onChange={(e) => handleLineaChange(index, 'precio_unitario', e.target.value)} disabled={isSubmitting} required />
                  </div>

                  <div className="flex items-center">
                    {lineas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveLinea(index)} disabled={isSubmitting} className="h-9 w-9 flex items-center justify-center">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="nota">Notas internas (opcional)</Label>
          <Textarea id="nota" value={nota} onChange={(e) => setNota(e.target.value)} disabled={isSubmitting} rows={3} placeholder="Factura, guía, nota interna para la bitácora..." />
        </div>

        <div className="rounded-md border border-dashed border-muted-foreground/40 p-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Total estimado</span>
            <span className="font-semibold">S/ {totalCalculado.toFixed(2)}</span>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? (<span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Guardando...</span>) : 'Registrar compra'}</Button>

        {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </form>

      <Sheet open={isProveedorSheetOpen} onOpenChange={setProveedorSheetOpen}>
        <SheetContent side="right" className="w-full max-w-lg">
          <SheetHeader>
            <SheetTitle>Registrar proveedor</SheetTitle>
          </SheetHeader>
          <ProveedorForm onCancel={() => setProveedorSheetOpen(false)} onSuccess={handleProveedorRegistrado} />
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default CompraRapidaForm
