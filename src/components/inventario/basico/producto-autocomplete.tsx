'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, PackageSearch, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ProductoBasicoOption = {
  id_producto: number
  nombre: string
  codigo_producto: string
  unidad: string
  stock_disponible: string
  stock_comprometido: string
  costo_promedio: string
}

type ProductoAutocompleteProps = {
  value: ProductoBasicoOption | null
  onChange: (option: ProductoBasicoOption | null) => void
  disabled?: boolean
  placeholder?: string
}

const buildLabel = (option: ProductoBasicoOption) => `${option.nombre} (${option.codigo_producto})`

const formatCantidad = (valor: string) => {
  const parsed = Number.parseFloat(valor)
  if (!Number.isFinite(parsed)) return '0'
  return parsed.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ProductoAutocomplete = ({ value, onChange, disabled = false, placeholder = 'Selecciona un producto' }: ProductoAutocompleteProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ProductoBasicoOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const selectedLabel = value ? buildLabel(value) : placeholder

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const trimmed = query.trim()
      if (trimmed.length === 1) {
        return
      }

      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ limit: '15' })
        if (trimmed.length >= 2) {
          params.set('q', trimmed)
        }

        const response = await fetch(`/api/inventario/productos/buscar?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          const info = await response.json().catch(() => ({}))
          throw new Error(info.error || 'No se pudo buscar productos')
        }

        const data = (await response.json()) as { productos?: ProductoBasicoOption[] }
        setOptions(data.productos ?? [])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar productos')
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => {
      searchRef.current?.focus()
    }, 10)
    return () => window.clearTimeout(timeout)
  }, [open])

  const handleSelect = (option: ProductoBasicoOption) => {
    onChange(option)
    setOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
  }

  const renderedOptions = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando productos...
        </div>
      )
    }

    if (error) {
      return <p className="py-4 text-sm font-medium text-destructive">{error}</p>
    }

    if (options.length === 0) {
      return <p className="py-4 text-sm text-muted-foreground">No se encontraron productos.</p>
    }

    return (
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {options.map((option) => (
          <li key={option.id_producto}>
            <button
              type="button"
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                value?.id_producto === option.id_producto && 'bg-muted',
              )}
              onClick={() => handleSelect(option)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{option.nombre}</span>
                <span className="text-xs text-muted-foreground">#{option.codigo_producto}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Disp: {formatCantidad(option.stock_disponible)}</span>
                <span>Comp: {formatCantidad(option.stock_comprometido)}</span>
                <span>Costo: S/ {formatCantidad(option.costo_promedio)}</span>
                <span>Unidad: {option.unidad}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    )
  }, [loading, error, options, value])

  return (
    <div className="flex items-center gap-2">
      <Popover open={open && !disabled} onOpenChange={(next) => (disabled ? undefined : setOpen(next))}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('h-10 flex-1 justify-between font-normal', !value && 'text-muted-foreground')}
            disabled={disabled}
          >
            <span className="truncate" title={selectedLabel}>
              {selectedLabel}
            </span>
            <PackageSearch className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="border-b border-border px-3 py-2">
            <Input
              ref={searchRef}
              placeholder="Buscar por nombre o código"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="px-3 py-2">{renderedOptions}</div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" onClick={handleClear} disabled={disabled} title="Quitar producto">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export default ProductoAutocomplete
