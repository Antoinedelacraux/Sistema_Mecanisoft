'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ProductoAutocomplete, { type ProductoBasicoOption } from '@/components/inventario/basico/producto-autocomplete'

type MovimientoTipo = 'SALIDA' | 'AJUSTE'

type MovimientoFormState = {
  tipo: MovimientoTipo
  producto: ProductoBasicoOption | null
  cantidad: string
  referencia: string
  motivo: string
  direccion: 'incremento' | 'decremento'
}

const INITIAL_STATE: MovimientoFormState = {
  tipo: 'SALIDA',
  producto: null,
  cantidad: '',
  referencia: '',
  motivo: '',
  direccion: 'decremento',
}

const sanitizeNumber = (value: string) => value.trim()

const sanitizeOptional = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const MovimientoQuickForm = ({ onSuccess }: { onSuccess?: () => void }) => {
  const router = useRouter()
  const [form, setForm] = useState<MovimientoFormState>(INITIAL_STATE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: 'tipo' | 'cantidad' | 'referencia' | 'motivo' | 'direccion') => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleProductoSelect = (producto: ProductoBasicoOption | null) => {
    setForm((prev) => ({ ...prev, producto }))
  }

  const resetFeedback = () => {
    setMessage(null)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    if (!form.producto) {
      setError('Selecciona un producto válido')
      return
    }

    if (!form.cantidad.trim()) {
      setError('Ingresa una cantidad')
      return
    }

    if (form.tipo === 'AJUSTE' && form.motivo.trim().length < 3) {
      setError('Describe el motivo del ajuste (mínimo 3 caracteres)')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        id_producto: form.producto.id_producto,
        cantidad: sanitizeNumber(form.cantidad),
      }

      if (form.tipo === 'SALIDA') {
        payload.tipo = 'SALIDA'
        payload.referencia = sanitizeOptional(form.referencia)
      } else {
        payload.tipo = 'AJUSTE'
        payload.motivo = form.motivo.trim()
        payload.direccion = form.direccion
      }

      const response = await fetch('/api/inventario/movimientos/basico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const info = await response.json().catch(() => ({}))
        throw new Error(info.error || 'No se pudo registrar el movimiento')
      }

      setMessage('Movimiento registrado correctamente')
  setForm({ ...INITIAL_STATE })
      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Registrar movimiento rápido</h2>
      <p className="text-sm text-muted-foreground">Salida o ajuste rápido con búsqueda de producto mientras completamos los flujos visuales.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="tipo">Tipo de movimiento</Label>
          <select
            id="tipo"
            className="rounded-md border border-input bg-background p-2"
            value={form.tipo}
            onChange={handleChange('tipo')}
            disabled={isSubmitting}
            title="Seleccionar tipo de movimiento"
          >
            <option value="SALIDA">Salida</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label>Producto</Label>
          <ProductoAutocomplete value={form.producto} onChange={handleProductoSelect} disabled={isSubmitting} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input
            id="cantidad"
            type="number"
            step="0.01"
            value={form.cantidad}
            onChange={handleChange('cantidad')}
            disabled={isSubmitting}
            required
          />
        </div>

        {form.tipo === 'SALIDA' && (
          <div className="grid gap-2">
            <Label htmlFor="referencia">Referencia (opcional)</Label>
            <Input
              id="referencia"
              value={form.referencia}
              onChange={handleChange('referencia')}
              disabled={isSubmitting}
              placeholder="Orden, nota interna..."
            />
          </div>
        )}

        {form.tipo === 'AJUSTE' && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="direccion">Dirección del ajuste</Label>
              <select
                id="direccion"
                className="rounded-md border border-input bg-background p-2"
                value={form.direccion}
                onChange={handleChange('direccion')}
                disabled={isSubmitting}
                title="Seleccionar dirección del ajuste"
              >
                <option value="incremento">Incremento (+)</option>
                <option value="decremento">Decremento (-)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Textarea
                id="motivo"
                value={form.motivo}
                onChange={handleChange('motivo')}
                disabled={isSubmitting}
                placeholder="Conteo físico, merma, inventario inicial..."
                rows={3}
              />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </span>
          ) : (
            'Registrar movimiento'
          )}
        </Button>

        {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </form>
    </div>
  )
}

export default MovimientoQuickForm
