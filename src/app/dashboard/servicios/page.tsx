"use client"
import { ServiciosTable } from '@/components/servicios/servicios-table'
import { ServicioForm } from '@/components/servicios/servicio-form'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function ServiciosPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-4 space-y-4">
      <ServiciosTable 
        onCreate={() => { setEditing(null); setOpen(true) }} 
        onEdit={(serv) => { setEditing(serv); setOpen(true) }} 
        refreshKey={refreshKey}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
          </DialogHeader>
          <ServicioForm 
            servicio={editing || undefined}
            onSuccess={() => { setOpen(false); setRefreshKey(prev => prev + 1) }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
