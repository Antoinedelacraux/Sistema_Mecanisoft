import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrdenCompleta } from '../ordenes-table'
import { useEffect, useMemo, useState } from 'react'
import type { TrabajadorCompleto } from '@/types'

interface OrdenEditModalProps {
  open: boolean
  onClose: () => void
  orden: OrdenCompleta | null
  onSave: (data: { prioridad: string, observaciones: string, id_trabajador_principal: string | null }) => Promise<void>
  loading: boolean
  trabajadores: TrabajadorCompleto[]
}

export function OrdenEditModal({ open, onClose, orden, onSave, loading, trabajadores }: OrdenEditModalProps) {
  const [prioridad, setPrioridad] = useState('media')
  const [observaciones, setObservaciones] = useState('')
  const [trabajador, setTrabajador] = useState<string>('NONE')

  useEffect(() => {
    if (!orden) {
      setPrioridad('media')
      setObservaciones('')
      setTrabajador('NONE')
      return
    }
    setPrioridad(orden.prioridad)
    setObservaciones(orden.observaciones || '')
    setTrabajador(orden.trabajador_principal?.id_trabajador ? String(orden.trabajador_principal.id_trabajador) : 'NONE')
  }, [orden])

  const options = useMemo(() => trabajadores.map((t) => {
    const persona = t.usuario?.persona ?? t.persona
    const apellidoMaterno = persona?.apellido_materno ? ` ${persona.apellido_materno}` : ''
    return {
      id: t.id_trabajador,
      label: `${persona.nombre} ${persona.apellido_paterno}${apellidoMaterno}`.trim(),
      codigo: t.codigo_empleado
    }
  }), [trabajadores])

  // Actualizar valores cuando cambie la orden
  // ...podrías usar useEffect si lo necesitas

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Orden {orden?.codigo_transaccion}</DialogTitle>
        </DialogHeader>
        {orden && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              await onSave({
                prioridad,
                observaciones,
                id_trabajador_principal: trabajador === 'NONE' ? null : trabajador
              })
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prioridad</label>
                <Select value={prioridad} onValueChange={setPrioridad}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mecánico Principal</label>
                <Select value={trabajador} onValueChange={setTrabajador}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin asignar</SelectItem>
                    {options.length === 0 ? (
                      <SelectItem value="__empty" disabled className="text-xs text-muted-foreground">
                        No hay mecánicos activos
                      </SelectItem>
                    ) : (
                      options.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          {opt.label} ({opt.codigo})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" type="button" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
