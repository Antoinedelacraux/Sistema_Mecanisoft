'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ProveedorBasicoOption = {
  id_proveedor: number
  razon_social: string
  nombre_comercial: string | null
  contacto: string | null
  numero_contacto: string | null
}

type ProveedorAutocompleteProps = {
  value: ProveedorBasicoOption | null
  onChange: (option: ProveedorBasicoOption | null) => void
  disabled?: boolean
  placeholder?: string
}

const buildLabel = (option: ProveedorBasicoOption) => {
  const comercial = option.nombre_comercial ? ` • ${option.nombre_comercial}` : ''
  return `${option.razon_social}${comercial}`
}

const ProveedorAutocomplete = ({ value, onChange, disabled = false, placeholder = 'Selecciona un proveedor' }: ProveedorAutocompleteProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ProveedorBasicoOption[]>([])
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

        const response = await fetch(`/api/inventario/proveedores?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          const info = await response.json().catch(() => ({}))
          throw new Error(info.error || 'No se pudo obtener la lista de proveedores')
        }

        const data = (await response.json()) as { proveedores?: ProveedorBasicoOption[] }
        setOptions(data.proveedores ?? [])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar proveedores')
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

  const handleSelect = (option: ProveedorBasicoOption) => {
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
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando proveedores...
        </div>
      )
    }

    if (error) {
      return <p className="py-4 text-sm font-medium text-destructive">{error}</p>
    }

    if (options.length === 0) {
      return <p className="py-4 text-sm text-muted-foreground">No se encontraron proveedores.</p>
    }

    return (
      <ul className="max-h-60 space-y-1 overflow-y-auto">
        {options.map((option) => (
          <li key={option.id_proveedor}>
            <button
              type="button"
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                value?.id_proveedor === option.id_proveedor && 'bg-muted',
              )}
              onClick={() => handleSelect(option)}
            >
              <span className="font-medium">{option.razon_social}</span>
              {option.nombre_comercial && (
                <span className="ml-1 text-xs text-muted-foreground">{option.nombre_comercial}</span>
              )}
              {option.contacto && (
                <p className="mt-1 text-xs text-muted-foreground">Contacto: {option.contacto}</p>
              )}
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
            <Search className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="border-b border-border px-3 py-2">
            <Input
              ref={searchRef}
              placeholder="Buscar por razón social o comercial"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="px-3 py-2">{renderedOptions}</div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" onClick={handleClear} disabled={disabled} title="Quitar proveedor">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export default ProveedorAutocomplete
