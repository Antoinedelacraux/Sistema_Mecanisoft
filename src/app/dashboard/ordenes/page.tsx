'use client'

import { useState } from 'react'
import { OrdenesTable, OrdenCompleta } from '@/components/ordenes/ordenes-table'
import { OrdenWizard } from '@/components/ordenes/orden-wizard'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

// Se reutiliza OrdenCompleta exportado desde la tabla

type ModalState = 'closed' | 'create' | 'edit' | 'view'

export default function OrdenesPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompleta | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreateNew = () => {
    setSelectedOrden(undefined)
    setModalState('create')
  }

  const handleEdit = (orden: OrdenCompleta) => {
    setSelectedOrden(orden)
    setModalState('edit')
  }

  const handleView = (orden: OrdenCompleta) => {
    setSelectedOrden(orden)
    setModalState('view')
  }

  const handleSuccess = () => {
    setModalState('closed')
    setSelectedOrden(undefined)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setModalState('closed')
    setSelectedOrden(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Órdenes de Trabajo</h1>
        <p className="text-gray-600 mt-2">
          Gestiona las órdenes de trabajo y asigna servicios a los vehículos
        </p>
      </div>

      {/* Tabla principal */}
      <OrdenesTable
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        refreshTrigger={refreshTrigger}
      />

      {/* Modal para wizard */}
      <Dialog open={modalState !== 'closed'} onOpenChange={() => setModalState('closed')}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {/* Título accesible oculto si se está en modo vista/creación */}
            <DialogTitle className="sr-only">
              {modalState === 'create' && 'Crear Orden de Trabajo'}
              {modalState === 'edit' && 'Editar Orden de Trabajo'}
              {modalState === 'view' && selectedOrden ? `Detalle Orden ${selectedOrden.codigo_transaccion}` : 'Detalle Orden'}
            </DialogTitle>
          </DialogHeader>
          {modalState === 'create' && (
            <OrdenWizard
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
          {modalState === 'edit' && selectedOrden && (
            <OrdenEditSimple
              orden={selectedOrden}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              onOrdenUpdated={(o) => setSelectedOrden(o)}
            />
          )}
          
          {modalState === 'view' && selectedOrden && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold">Orden #{selectedOrden.codigo_transaccion}</h3>
                <p className="text-gray-600">Detalles completos de la orden de trabajo</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Información básica */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Información Básica</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">Cliente</p>
                      <p>{selectedOrden.persona.nombre} {selectedOrden.persona.apellido_paterno}</p>
                      <p className="text-sm text-gray-600">{selectedOrden.persona.numero_documento}</p>
                    </div>
                    
                    {selectedOrden.transaccion_vehiculos[0] && (
                      <div>
                        <p className="font-semibold">Vehículo</p>
                        <p className="font-bold text-lg">{selectedOrden.transaccion_vehiculos[0].vehiculo.placa}</p>
                        <p className="text-sm text-gray-600">
                          {selectedOrden.transaccion_vehiculos[0].vehiculo.modelo.marca.nombre_marca} {selectedOrden.transaccion_vehiculos[0].vehiculo.modelo.nombre_modelo}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="font-semibold">Fecha de Creación</p>
                      <p>{new Date(selectedOrden.fecha).toLocaleString('es-PE')}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-semibold">Estado</p>
                        <div className="mt-1">
                          {/* Usar función getEstadoBadge aquí */}
                          <span className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
                            {selectedOrden.estado_orden}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold">Prioridad</p>
                        <div className="mt-1">
                          <span className="px-2 py-1 rounded text-sm bg-orange-100 text-orange-800">
                            {selectedOrden.prioridad}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Totales */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Resumen Financiero</h4>
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-lg">
                          <span className="font-semibold">Total:</span>
                          <span className="font-bold text-green-600">
                            {new Intl.NumberFormat('es-PE', {
                              style: 'currency',
                              currency: 'PEN'
                            }).format(selectedOrden.total)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {(selectedOrden._count?.detalles_transaccion ?? selectedOrden.detalles_transaccion.length)} servicio{(selectedOrden._count?.detalles_transaccion ?? selectedOrden.detalles_transaccion.length) !== 1 ? 's' : ''} incluido{(selectedOrden._count?.detalles_transaccion ?? selectedOrden.detalles_transaccion.length) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedOrden.trabajador_principal && (
                    <div>
                      <h4 className="font-semibold">Mecánico Responsable</h4>
                      <div className="mt-2 p-3 border rounded-lg">
                        <p className="font-medium">
                          {selectedOrden.trabajador_principal.usuario.persona.nombre} {selectedOrden.trabajador_principal.usuario.persona.apellido_paterno}
                        </p>
                        <p className="text-sm text-gray-600">{selectedOrden.trabajador_principal.codigo_empleado}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Componente interno simple para editar prioridad, mecánico y observaciones
import { useEffect } from 'react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface OrdenEditSimpleProps {
  orden: OrdenCompleta
  onSuccess: () => void
  onCancel: () => void
  onOrdenUpdated: (orden: OrdenCompleta) => void
}

interface TrabajadorOption {
  id_trabajador: number
  codigo_empleado: string
  usuario: { persona: { nombre: string; apellido_paterno: string } }
}

function OrdenEditSimple({ orden, onSuccess, onCancel, onOrdenUpdated }: OrdenEditSimpleProps) {
  const [prioridad, setPrioridad] = useState(orden.prioridad)
  const [observaciones, setObservaciones] = useState('')
  const [fechaFinEstimada, setFechaFinEstimada] = useState<string>('')
  const [trabajadores, setTrabajadores] = useState<TrabajadorOption[]>([])
  const [trabajadorPrincipal, setTrabajadorPrincipal] = useState<string | 'NONE'>(orden.trabajador_principal ? String((orden as any).trabajador_principal.id_trabajador) : 'NONE')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchTrabajadores = async () => {
      try {
        const res = await fetch('/api/trabajadores?solo_activos=true')
        const data = await res.json()
        setTrabajadores(data.trabajadores || [])
      } catch (e) { /* noop */ }
    }
    fetchTrabajadores()
  }, [])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const body: any = { id_transaccion: orden.id_transaccion, prioridad }
      if (trabajadorPrincipal !== 'NONE') body.asignar_trabajador = trabajadorPrincipal
      if (fechaFinEstimada) body.fecha_fin_estimada = fechaFinEstimada
      if (observaciones.trim()) body.observaciones = observaciones.trim()
      const resp = await fetch('/api/ordenes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      if (resp.status === 401) {
        // Redirigir a login si la sesión expiró
        window.location.href = '/login'
        return
      }
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}))
        throw new Error(err.error || 'No se pudo actualizar')
      }
      const result = await resp.json()
      onOrdenUpdated({ ...orden, prioridad: body.prioridad, estado_orden: result.orden.estado_orden, trabajador_principal: result.orden.trabajador_principal || (orden as any).trabajador_principal })
      onSuccess()
    } catch (e) {
      // TODO: agregar toast global si se requiere (requiere provider)
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Editar Orden {orden.codigo_transaccion}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label>Prioridad</Label>
            <Select value={prioridad} onValueChange={setPrioridad}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mecánico Principal</Label>
            <Select value={trabajadorPrincipal} onValueChange={setTrabajadorPrincipal}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin asignar</SelectItem>
                {trabajadores.map(t => (
                  <SelectItem key={t.id_trabajador} value={String(t.id_trabajador)}>
                    {t.usuario.persona.nombre} {t.usuario.persona.apellido_paterno} ({t.codigo_empleado})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha Fin Estimada</Label>
            <Input
              type="date"
              value={fechaFinEstimada}
              onChange={e => setFechaFinEstimada(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas adicionales"
              rows={6}
              className="mt-1"
            />
          </div>
          <div className="text-sm text-gray-500">
            Creada el {format(new Date(orden.fecha), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
      </div>
    </div>
  )
}