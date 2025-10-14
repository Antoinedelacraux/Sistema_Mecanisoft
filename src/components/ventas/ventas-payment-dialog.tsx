"use client"

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import type { VentaListadoItem } from '@/types/ventas'
import { MetodoPagoVenta } from '@prisma/client'

const metodoOptions = [
  { value: MetodoPagoVenta.EFECTIVO, label: 'Efectivo' },
  { value: MetodoPagoVenta.TARJETA, label: 'Tarjeta' },
  { value: MetodoPagoVenta.APP_MOVIL, label: 'App móvil' },
  { value: MetodoPagoVenta.TRANSFERENCIA, label: 'Transferencia' },
  { value: MetodoPagoVenta.OTRO, label: 'Otro' }
]

type FormState = {
  metodo: MetodoPagoVenta
  monto: string
  fecha_pago: string
  referencia: string
  notas: string
  id_venta_pago?: number
  accion: 'crear' | 'actualizar'
}

type VentasPaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  venta: VentaListadoItem | null
  onUpdated: () => Promise<void> | void
}

const formatDateTimeLocal = (value: Date | string | null | undefined) => {
  if (!value) return format(new Date(), "yyyy-MM-dd'T'HH:mm")
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return format(new Date(), "yyyy-MM-dd'T'HH:mm")
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export function VentasPaymentDialog({ open, onOpenChange, venta, onUpdated }: VentasPaymentDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>({
    metodo: MetodoPagoVenta.EFECTIVO,
    monto: '',
    fecha_pago: formatDateTimeLocal(new Date()),
    referencia: '',
    notas: '',
    accion: 'crear'
  })

  useEffect(() => {
    if (venta) {
      const saldo = venta.saldo > 0 ? venta.saldo : 0
      setForm({
        metodo: venta.metodo_principal ?? MetodoPagoVenta.EFECTIVO,
        monto: saldo ? saldo.toFixed(2) : '',
        fecha_pago: formatDateTimeLocal(new Date()),
        referencia: '',
        notas: '',
        accion: 'crear'
      })
    }
  }, [venta, open])

  const pagosOrdenados = useMemo(() => {
    if (!venta) return []
    return [...venta.pagos].sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime())
  }, [venta])

  const handleSubmit = async () => {
    if (!venta) return
    const montoNumber = Number(form.monto)
    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un monto mayor a cero.', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/ventas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_comprobante: venta.comprobante.id_comprobante,
          metodo: form.metodo,
          monto: montoNumber,
          referencia: form.referencia || undefined,
          fecha_pago: new Date(form.fecha_pago).toISOString(),
          notas: form.notas || undefined,
          id_venta_pago: form.id_venta_pago,
          accion: form.accion
        })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo registrar el pago')
      }

      toast({
        title: form.accion === 'crear' ? 'Pago registrado' : 'Pago actualizado',
        description: 'El estado de la venta se actualizó correctamente.'
      })

      await onUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo registrar el pago.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (pagoId: number) => {
    if (!venta) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/ventas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_comprobante: venta.comprobante.id_comprobante,
          metodo: form.metodo,
          id_venta_pago: pagoId,
          accion: 'eliminar'
        })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo eliminar el pago')
      }

      toast({ title: 'Pago eliminado', description: 'Se actualizó el estado de la venta.' })
      await onUpdated()
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el pago.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSelection = (pagoId: number) => {
    if (!venta) return
    const pago = venta.pagos.find((p) => p.id_venta_pago === pagoId)
    if (!pago) return
    setForm({
      metodo: pago.metodo,
      monto: pago.monto.toFixed(2),
      fecha_pago: formatDateTimeLocal(pago.fecha_pago),
      referencia: pago.referencia ?? '',
      notas: pago.notas ?? '',
      id_venta_pago: pago.id_venta_pago,
      accion: 'actualizar'
    })
  }

  const resetForm = () => {
    if (!venta) return
    const saldo = venta.saldo > 0 ? venta.saldo : 0
    setForm({
      metodo: venta.metodo_principal ?? MetodoPagoVenta.EFECTIVO,
      monto: saldo ? saldo.toFixed(2) : '',
      fecha_pago: formatDateTimeLocal(new Date()),
      referencia: '',
      notas: '',
      accion: 'crear'
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) {
        resetForm()
      }
      onOpenChange(value)
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conciliar pago</DialogTitle>
          <DialogDescription>
            Registra pagos para el comprobante {venta?.comprobante.serie}-{String(venta?.comprobante.numero ?? '').padStart(8, '0')}
          </DialogDescription>
        </DialogHeader>

        {venta && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-md bg-muted">
                <p className="text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">S/ {venta.total.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-md bg-muted">
                <p className="text-muted-foreground">Pagado</p>
                <p className="text-lg font-semibold">S/ {venta.total_pagado.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-md bg-muted">
                <p className="text-muted-foreground">Saldo</p>
                <p className="text-lg font-semibold">S/ {venta.saldo.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Pagos registrados</h3>
                  <Button variant="ghost" size="sm" onClick={resetForm} disabled={submitting}>
                    Nuevo pago
                  </Button>
                </div>
                <Separator className="my-2" />
                {pagosOrdenados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no se registraron pagos.</p>
                ) : (
                  <div className="space-y-2">
                    {pagosOrdenados.map((pago) => (
                      <div key={pago.id_venta_pago} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <div>
                          <p className="font-medium">{pago.metodo.replace('_', ' ')}</p>
                          <p className="text-muted-foreground">
                            {format(new Date(pago.fecha_pago), 'dd/MM/yyyy HH:mm')} — S/ {pago.monto.toFixed(2)}
                          </p>
                          {pago.referencia && <p className="text-muted-foreground">Ref: {pago.referencia}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditSelection(pago.id_venta_pago!)} disabled={submitting}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(pago.id_venta_pago!)} disabled={submitting}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Método</Label>
                    <Select
                      value={form.metodo}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, metodo: value as MetodoPagoVenta }))}
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                      <SelectContent>
                        {metodoOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto (S/)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.monto}
                      onChange={(event) => setForm((prev) => ({ ...prev, monto: event.target.value }))}
                      placeholder="0.00"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Fecha y hora</Label>
                    <Input
                      type="datetime-local"
                      value={form.fecha_pago}
                      onChange={(event) => setForm((prev) => ({ ...prev, fecha_pago: event.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Referencia</Label>
                    <Input
                      value={form.referencia}
                      onChange={(event) => setForm((prev) => ({ ...prev, referencia: event.target.value }))}
                      placeholder="Número de operación, voucher, etc."
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={form.notas}
                    onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))}
                    placeholder="Observaciones del pago"
                    rows={3}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !venta}>
            {form.accion === 'crear' ? 'Registrar pago' : 'Actualizar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
