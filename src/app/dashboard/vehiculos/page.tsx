'use client'

import { useState } from 'react'
import { VehiculosTable } from '@/components/vehiculos/vehiculos-table'
import { VehiculoForm } from '@/components/vehiculos/vehiculo-form'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { VehiculoCompleto } from '@/types'

type ModalState = 'closed' | 'create' | 'edit' | 'view'

export default function VehiculosPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedVehiculo, setSelectedVehiculo] = useState<VehiculoCompleto | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreateNew = () => {
    setSelectedVehiculo(undefined)
    setModalState('create')
  }

  const handleEdit = (vehiculo: VehiculoCompleto) => {
    setSelectedVehiculo(vehiculo)
    setModalState('edit')
  }

  const handleView = (vehiculo: VehiculoCompleto) => {
    setSelectedVehiculo(vehiculo)
    setModalState('view')
  }

  const handleSuccess = () => {
    setModalState('closed')
    setSelectedVehiculo(undefined)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setModalState('closed')
    setSelectedVehiculo(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Vehículos</h1>
        <p className="text-gray-600 mt-2">
          Gestiona los vehículos de tus clientes y mantén un registro detallado
        </p>
      </div>

      {/* Tabla principal */}
      <VehiculosTable
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        refreshTrigger={refreshTrigger}
      />

      {/* Modal para formularios */}
      <Dialog open={modalState !== 'closed'} onOpenChange={() => setModalState('closed')}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {(modalState === 'create' || modalState === 'edit') && (
            <VehiculoForm
              vehiculo={selectedVehiculo}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
          
          {modalState === 'view' && selectedVehiculo && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold">Detalles del Vehículo</h3>
                <p className="text-gray-600">Información completa del vehículo</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Información básica */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Información Básica</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold">Placa</p>
                      <p className="text-2xl font-bold text-blue-600">{selectedVehiculo.placa}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Tipo</p>
                      <p>{selectedVehiculo.tipo}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Marca</p>
                      <p>{selectedVehiculo.modelo.marca.nombre_marca}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Modelo</p>
                      <p>{selectedVehiculo.modelo.nombre_modelo}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Año</p>
                      <p>{selectedVehiculo.año}</p>
                    </div>
                  </div>
                </div>

                {/* Información del propietario */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Propietario</h4>
                  <div>
                    <p className="font-semibold">Nombre</p>
                    <p>{selectedVehiculo.cliente.persona.nombre} {selectedVehiculo.cliente.persona.apellido_paterno}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Documento</p>
                    <p>{selectedVehiculo.cliente.persona.tipo_documento}: {selectedVehiculo.cliente.persona.numero_documento}</p>
                  </div>
                  {selectedVehiculo.cliente.persona.telefono && (
                    <div>
                      <p className="font-semibold">Teléfono</p>
                      <p>{selectedVehiculo.cliente.persona.telefono}</p>
                    </div>
                  )}
                </div>

                {/* Especificaciones técnicas */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Especificaciones</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold">Combustible</p>
                      <p>{selectedVehiculo.tipo_combustible}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Transmisión</p>
                      <p>{selectedVehiculo.transmision}</p>
                    </div>
                    {selectedVehiculo.numero_motor && (
                      <div>
                        <p className="font-semibold">Número de Motor</p>
                        <p className="font-mono text-sm">{selectedVehiculo.numero_motor}</p>
                      </div>
                    )}
                    {selectedVehiculo.numero_chasis && (
                      <div>
                        <p className="font-semibold">Número de Chasis</p>
                        <p className="font-mono text-sm">{selectedVehiculo.numero_chasis}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Observaciones */}
                {selectedVehiculo.observaciones && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b pb-2">Observaciones</h4>
                    <p className="bg-gray-50 p-3 rounded-lg">{selectedVehiculo.observaciones}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}