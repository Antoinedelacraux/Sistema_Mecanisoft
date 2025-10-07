'use client'

import { useState } from 'react'
import { CotizacionesTable } from '@/components/cotizaciones/cotizaciones-table'
import { CotizacionWizard } from '@/components/cotizaciones/cotizacion-wizard'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CotizacionCompleta } from '@/types'

type ModalState = 'closed' | 'create' | 'edit' | 'view'

export default function CotizacionesPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedCotizacion, setSelectedCotizacion] = useState<CotizacionCompleta | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreateNew = () => {
    setSelectedCotizacion(undefined)
    setModalState('create')
  }

  const handleEdit = (cotizacion: CotizacionCompleta) => {
    setSelectedCotizacion(cotizacion)
    setModalState('edit')
  }

  const handleView = (cotizacion: CotizacionCompleta) => {
    setSelectedCotizacion(cotizacion)
    setModalState('view')
  }

  const handleSuccess = () => {
    setModalState('closed')
    setSelectedCotizacion(undefined)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setModalState('closed')
    setSelectedCotizacion(undefined)
  }

  const toNumber = (v: any): number => {
    if (v == null) return 0
    if (typeof v === 'number') return isNaN(v) ? 0 : v
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
    if (typeof v === 'object' && v.toString) {
      const s = v.toString(); const n = Number(s); if (!isNaN(n)) return n
    }
    const n = Number(v); return isNaN(n) ? 0 : n
  }
  const formatPrice = (v: any) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(toNumber(v) || 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cotizaciones</h1>
        <p className="text-gray-600 mt-2">
          Gestiona las cotizaciones y conviértelas en órdenes de trabajo
        </p>
      </div>

      <CotizacionesTable
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        refreshTrigger={refreshTrigger}
      />

      <Dialog
        open={modalState !== 'closed'}
        onOpenChange={(open) => {
          if (!open) {
            handleCancel()
          }
        }}
      >
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {modalState === 'create' && 'Nueva Cotización'}
              {modalState === 'edit' && 'Editar Cotización'}
              {modalState === 'view' && (selectedCotizacion ? `Detalle Cotización ${selectedCotizacion.codigo_cotizacion}` : 'Detalle Cotización')}
            </DialogTitle>
          </DialogHeader>
          {modalState === 'create' && (
            <CotizacionWizard
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}

          {modalState === 'edit' && selectedCotizacion && (
            <CotizacionWizard
              cotizacion={selectedCotizacion}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
          
          {modalState === 'view' && selectedCotizacion && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold">Cotización #{selectedCotizacion.codigo_cotizacion}</h3>
                <p className="text-gray-600">Detalles completos de la cotización</p>
              </div>
              
              {/* Vista detallada de cotización - Similar a orden */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Información</h4>
                  <div>
                    <p><strong>Cliente:</strong> {selectedCotizacion.cliente.persona.nombre} {selectedCotizacion.cliente.persona.apellido_paterno}</p>
                    <p><strong>Vehículo:</strong> {selectedCotizacion.vehiculo.placa}</p>
                    <p><strong>Estado:</strong> {selectedCotizacion.estado}</p>
                    <p><strong>Total:</strong> {formatPrice(selectedCotizacion.total)}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Items</h4>
                  <div className="space-y-2">
                    {selectedCotizacion.detalle_cotizacion.map((detalle, index) => (
                      <div key={index} className="flex justify-between py-1 border-b">
                        <span className="text-sm">{detalle.producto?.nombre ?? detalle.servicio?.nombre ?? 'Item'}</span>
                        <span className="text-sm font-semibold">S/ {toNumber(detalle.total).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}