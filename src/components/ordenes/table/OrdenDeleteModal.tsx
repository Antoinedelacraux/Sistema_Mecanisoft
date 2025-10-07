import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OrdenCompleta } from '../ordenes-table'

interface OrdenDeleteModalProps {
  open: boolean
  onClose: () => void
  orden: OrdenCompleta | null
  onConfirm: () => Promise<void>
}

export function OrdenDeleteModal({ open, onClose, orden, onConfirm }: OrdenDeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Orden</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {orden && (
            <div className="p-3 bg-red-50 rounded border border-red-200 text-sm">
              ¿Seguro que deseas eliminar la orden
              {' '}<span className="font-semibold">{orden.codigo_transaccion}</span>?<br />
              Esta acción la ocultará de la lista (borrado lógico).
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button variant="destructive" onClick={onConfirm}>Eliminar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
