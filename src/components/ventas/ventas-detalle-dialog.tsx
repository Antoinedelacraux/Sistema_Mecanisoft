"use client"

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ComprobanteCompleto } from '@/types'
import { format } from 'date-fns'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value ?? 0)

type VentasDetalleDialogProps = {
  open: boolean
  comprobanteId: number | null
  onOpenChange: (open: boolean) => void
}

export function VentasDetalleDialog({ open, comprobanteId, onOpenChange }: VentasDetalleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comprobante, setComprobante] = useState<ComprobanteCompleto | null>(null)

  useEffect(() => {
    if (!open || !comprobanteId) {
      setComprobante(null)
      setError(null)
      return
    }

    const fetchDetalle = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/facturacion/comprobantes/${comprobanteId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo obtener el comprobante')
        }
        const comprobanteData = (data?.data ?? null) as ComprobanteCompleto | null
        setComprobante(comprobanteData)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchDetalle()
  }, [open, comprobanteId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle del comprobante</DialogTitle>
          <DialogDescription>Consulta los ítems y totales emitidos.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : comprobante ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {comprobante.tipo} {comprobante.serie}-{String(comprobante.numero).padStart(8, '0')}
                </h3>
                <p className="text-muted-foreground">
                  Emitido el {comprobante.fecha_emision ? format(new Date(comprobante.fecha_emision), 'dd/MM/yyyy HH:mm') : 'Sin fecha'}
                </p>
              </div>
              <Badge variant="secondary">{comprobante.estado}</Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Cliente</h4>
                <p>{comprobante.receptor_nombre}</p>
                <p className="text-xs text-muted-foreground">Documento: {comprobante.receptor_documento}</p>
                {comprobante.receptor_direccion && (
                  <p className="text-xs text-muted-foreground">Dirección: {comprobante.receptor_direccion}</p>
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Origen</h4>
                <p>{comprobante.origen_tipo}</p>
                {comprobante.codigo && <p className="text-xs text-muted-foreground">Código: {comprobante.codigo}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Ítems</h4>
              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  <div className="col-span-5">Descripción</div>
                  <div className="col-span-2 text-right">Cantidad</div>
                  <div className="col-span-2 text-right">P. Unitario</div>
                  <div className="col-span-3 text-right">Total</div>
                </div>
                {comprobante.detalles.map((detalle) => (
                  <div key={detalle.id_comprobante_detalle} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs">
                    <div className="col-span-5">
                      <p className="font-medium">{detalle.descripcion}</p>
                      <p className="text-muted-foreground">
                        {detalle.tipo_item === 'SERVICIO' ? 'Servicio' : 'Producto'}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">{Number(detalle.cantidad ?? 0)}</div>
                    <div className="col-span-2 text-right">{formatCurrency(Number(detalle.precio_unitario ?? 0))}</div>
                    <div className="col-span-3 text-right">{formatCurrency(Number(detalle.total ?? 0))}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(comprobante.subtotal ?? 0))}</span>
              </div>
              <div className="flex justify-between">
                <span>IGV</span>
                <span>{formatCurrency(Number(comprobante.igv ?? 0))}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(Number(comprobante.total ?? 0))}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Selecciona un comprobante para ver el detalle.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
