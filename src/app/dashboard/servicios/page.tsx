"use client"

import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'

import { ServiciosTable } from '@/components/servicios/servicios-table'
import { ServicioForm } from '@/components/servicios/servicio-form'
import { PermisoGate } from '@/components/permisos/permiso-gate'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermisos } from '@/hooks/use-permisos'

export default function ServiciosPage() {
  const { puede } = usePermisos()
  const canManage = puede('servicios.gestionar')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-4 space-y-4">
      <PermisoGate
        permiso="servicios.listar"
        loadingFallback={
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Cargando permisos...
          </div>
        }
        fallback={
          <Alert className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            <div>
              <AlertTitle>Acceso restringido</AlertTitle>
              <AlertDescription>
                Necesitas el permiso <span className="font-semibold">servicios.listar</span> para visualizar este módulo.
                Contacta a un administrador si requieres acceso.
              </AlertDescription>
            </div>
          </Alert>
        }
      >
        <ServiciosTable
          onCreate={canManage ? () => { setEditing(null); setOpen(true) } : undefined}
          onEdit={canManage ? (serv) => { setEditing(serv); setOpen(true) } : undefined}
          refreshKey={refreshKey}
          canManage={canManage}
        />

        {canManage && (
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
        )}
      </PermisoGate>
    </div>
  )
}
