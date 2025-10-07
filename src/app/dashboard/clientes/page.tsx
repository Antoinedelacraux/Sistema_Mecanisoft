'use client'

import { useState } from 'react'
import { ClientesTable } from '@/components/clientes/clientes-table'
import { ClienteForm } from '@/components/clientes/cliente-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClienteCompleto } from '@/types'

type ModalState = 'closed' | 'create' | 'edit' | 'view'

export default function ClientesPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedCliente, setSelectedCliente] = useState<ClienteCompleto | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreateNew = () => {
    setSelectedCliente(undefined)
    setModalState('create')
  }

  const handleEdit = (cliente: ClienteCompleto) => {
    setSelectedCliente(cliente)
    setModalState('edit')
  }

  const handleView = (cliente: ClienteCompleto) => {
    setSelectedCliente(cliente)
    setModalState('view')
  }

  const handleSuccess = () => {
    setModalState('closed')
    setSelectedCliente(undefined)
    // ✅ Trigger refresh de la tabla
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setModalState('closed')
    setSelectedCliente(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-600 mt-2">
          Gestiona la información de tus clientes y mantén un registro detallado
        </p>
      </div>
      {/* Tabla principal */}
      <ClientesTable
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        refreshTrigger={refreshTrigger}
      />



      {/* Modal para formularios */}
      <Dialog open={modalState !== 'closed'} onOpenChange={() => setModalState('closed')}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Gestión de Cliente</DialogTitle>
          </DialogHeader>
          {(modalState === 'create' || modalState === 'edit') && (
            <ClienteForm
              cliente={selectedCliente}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
          
          {modalState === 'view' && selectedCliente && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Detalles del Cliente</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Nombre Completo</h4>
                  <p>{selectedCliente.persona.nombre} {selectedCliente.persona.apellido_paterno} {selectedCliente.persona.apellido_materno}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Documento</h4>
                  <p>{selectedCliente.persona.tipo_documento}: {selectedCliente.persona.numero_documento}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Teléfono</h4>
                  <p>{selectedCliente.persona.telefono || 'No registrado'}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Correo</h4>
                  <p>{selectedCliente.persona.correo || 'No registrado'}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Estado</h4>
                  <p className={selectedCliente.estatus ? 'text-green-600' : 'text-red-600'}>
                    {selectedCliente.estatus ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
                {selectedCliente.persona.empresa_persona && (
                  <div>
                    <h4 className="font-semibold">Empresa</h4>
                    <p>{selectedCliente.persona.empresa_persona.razon_social}</p>
                    {selectedCliente.persona.empresa_persona.nombre_comercial && (
                      <p className="text-sm text-muted-foreground">
                        {selectedCliente.persona.empresa_persona.nombre_comercial}
                      </p>
                    )}
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