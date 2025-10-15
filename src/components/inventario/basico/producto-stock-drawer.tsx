'use client'

import { useEffect, useState } from 'react'
import { Loader2, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import type { StockDetalle } from '@/lib/inventario/basico'

type ProductoStockDrawerProps = {
  productoId: number
  triggerLabel?: string
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'sm' | 'default'
}

type EstadoCarga = 'idle' | 'loading' | 'error' | 'success'

const ProductoStockDrawer = ({ productoId, triggerLabel = 'Ver stock', variant = 'ghost', size = 'sm' }: ProductoStockDrawerProps) => {
  const [open, setOpen] = useState(false)
  const [estado, setEstado] = useState<EstadoCarga>('idle')
  const [detalle, setDetalle] = useState<StockDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDetalle = async () => {
      if (!open) return

      try {
        setEstado('loading')
        const response = await fetch(`/api/inventario/stock/${productoId}`)
        if (!response.ok) {
          const info = await response.json().catch(() => ({}))
          throw new Error(info.error || 'No se pudo obtener el stock del producto')
        }
        const data = (await response.json()) as StockDetalle
        setDetalle(data)
        setEstado('success')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar el stock')
        setEstado('error')
      }
    }

    fetchDetalle()
  }, [open, productoId])

  const formatoCantidad = (valor: string) => Number.parseFloat(valor).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} size={size} title="Ver stock del producto">
          <Package className="h-4 w-4" />
          <span className="sr-only">{triggerLabel}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle>Stock del producto #{productoId}</SheetTitle>
          <SheetDescription>
            Consulta el inventario consolidado y los últimos movimientos registrados con el flujo simplificado.
          </SheetDescription>
        </SheetHeader>

        {estado === 'loading' && (
          <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Cargando información...</span>
          </div>
        )}

        {estado === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Reintentar
            </Button>
          </div>
        )}

        {estado === 'success' && detalle && (
          <div className="flex h-full flex-col gap-6 py-4">
            <div className="rounded-md border border-border bg-background p-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Resumen</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Disponible</dt>
                  <dd className="text-lg font-semibold">{formatoCantidad(detalle.inventario.stock_disponible)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Comprometido</dt>
                  <dd className="text-lg font-semibold">{formatoCantidad(detalle.inventario.stock_comprometido)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Costo promedio</dt>
                  <dd className="text-lg font-semibold">S/ {formatoCantidad(detalle.inventario.costo_promedio)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Actualizado</dt>
                  <dd>{new Date(detalle.inventario.actualizado_en).toLocaleString('es-PE')}</dd>
                </div>
              </dl>
            </div>

            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Últimos movimientos</h3>
              {detalle.movimientos.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aún no hay movimientos registrados con este flujo.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {detalle.movimientos.map((movimiento) => (
                    <div key={movimiento.id_movimiento} className="rounded-md border border-border bg-background p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{movimiento.tipo}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(movimiento.creado_en).toLocaleString('es-PE')}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                        <span>Cantidad: {formatoCantidad(movimiento.cantidad)}</span>
                        <span>
                          Costo unitario:{' '}
                          {movimiento.costo_unitario ? `S/ ${formatoCantidad(movimiento.costo_unitario)}` : '—'}
                        </span>
                      </div>
                      {movimiento.referencia && (
                        <p className="mt-2 text-xs text-muted-foreground">Referencia: {movimiento.referencia}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default ProductoStockDrawer
