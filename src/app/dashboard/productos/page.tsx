'use client'

import { useState } from 'react'

// Safe converter: handles number | string | Prisma.Decimal-like objects
const toNumber = (value: any): number => {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // Prisma Decimal: has toNumber or toString
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') return value.toNumber()
    if (typeof value.toString === 'function') {
      const parsed = Number(value.toString())
      return Number.isFinite(parsed) ? parsed : 0
    }
  }
  return 0
}
import { ProductosTable } from '@/components/productos/productos-table'
import { ProductoForm } from '@/components/productos/producto-form'
import { CategoriasManager } from '@/components/productos/categorias-manager'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ProductoCompleto } from '@/types'

type ModalState = 'closed' | 'create' | 'edit' | 'view' | 'categories'

export default function ProductosPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedProducto, setSelectedProducto] = useState<ProductoCompleto | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleCreateNew = () => {
    setSelectedProducto(undefined)
    setModalState('create')
  }

  const handleEdit = (producto: ProductoCompleto) => {
    setSelectedProducto(producto)
    setModalState('edit')
  }

  const handleView = (producto: ProductoCompleto) => {
    setSelectedProducto(producto)
    setModalState('view')
  }

  const handleManageCategories = () => {
    setModalState('categories')
  }

  const handleSuccess = () => {
    setModalState('closed')
    setSelectedProducto(undefined)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setModalState('closed')
    setSelectedProducto(undefined)
  }

  const handleCategoriesClose = () => {
    setModalState('closed')
    setRefreshTrigger(prev => prev + 1) // Refrescar para actualizar categorías
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Productos e Inventario</h1>
        <p className="text-gray-600 mt-2">
          Gestiona productos, servicios y controla el inventario de tu taller
        </p>
      </div>

      {/* Tabla principal */}
      <ProductosTable
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        onManageCategories={handleManageCategories}
        refreshTrigger={refreshTrigger}
      />

      {/* Modal para formularios */}
      <Dialog open={modalState !== 'closed'} onOpenChange={() => setModalState('closed')}>
    <DialogContent className={`${modalState === 'categories' ? 'max-w-8xl' : 'max-w-7xl'} max-h-[90vh] overflow-y-auto w-full`}>
          <DialogHeader>
            <DialogTitle>
              {modalState === 'create' && 'Crear Nuevo Producto'}
              {modalState === 'edit' && 'Editar Producto'}
              {modalState === 'view' && 'Detalles del Producto'}
              {modalState === 'categories' && 'Gestionar Categorías'}
            </DialogTitle>
            <DialogDescription>
              {modalState === 'create' && 'Completa la información del nuevo producto o servicio.'}
              {modalState === 'edit' && `Modifica la información de ${selectedProducto?.nombre}.`}
              {modalState === 'view' && `Visualizando detalles de ${selectedProducto?.nombre}.`}
              {modalState === 'categories' && 'Administra las categorías y fabricantes de tus productos.'}
            </DialogDescription>
          </DialogHeader>

          {(modalState === 'create' || modalState === 'edit') && (
            <ProductoForm
              producto={selectedProducto}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
          
          {modalState === 'categories' && (
            <CategoriasManager onClose={handleCategoriesClose} />
          )}
          
          {modalState === 'view' && selectedProducto && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Información básica */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Información Básica</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold">Código</p>
                      <p className="text-lg font-mono bg-gray-100 px-2 py-1 rounded">
                        {selectedProducto.codigo_producto}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">Tipo</p>
                      <p className="capitalize">{selectedProducto.tipo}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-semibold">Nombre</p>
                      <p className="text-lg">{selectedProducto.nombre}</p>
                    </div>
                    {selectedProducto.descripcion && (
                      <div className="col-span-2">
                        <p className="font-semibold">Descripción</p>
                        <p className="bg-gray-50 p-3 rounded-lg">{selectedProducto.descripcion}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clasificación */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Clasificación</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">Categoría</p>
                      <p>{selectedProducto.categoria.nombre}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Fabricante</p>
                      <p>{selectedProducto.fabricante.nombre_fabricante}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Unidad de Medida</p>
                      <p>{selectedProducto.unidad_medida.nombre_unidad} ({selectedProducto.unidad_medida.abreviatura})</p>
                    </div>
                  </div>
                </div>

                {/* Inventario - Solo para productos físicos */}
                {selectedProducto.tipo === 'producto' && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b pb-2">Inventario</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold">Stock Actual</p>
                        <p className={`text-2xl font-bold ${
                          selectedProducto.stock === 0 
                            ? 'text-red-600' 
                            : selectedProducto.stock <= selectedProducto.stock_minimo
                            ? 'text-orange-600'
                            : 'text-green-600'
                        }`}>
                          {selectedProducto.stock}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">Stock Mínimo</p>
                        <p className="text-xl">{selectedProducto.stock_minimo}</p>
                      </div>
                    </div>
                    {selectedProducto.stock <= selectedProducto.stock_minimo && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-orange-800 font-medium">
                          ⚠️ Stock por debajo del mínimo recomendado
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Precios */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Precios</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">Precio de Compra</p>
                      <p className="text-lg">S/ {toNumber(selectedProducto.precio_compra).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Precio de Venta</p>
                      <p className="text-xl font-bold text-green-600">S/ {toNumber(selectedProducto.precio_venta).toFixed(2)}</p>
                    </div>
                    {Number(selectedProducto.descuento) > 0 && (
                      <div>
                        <p className="font-semibold">Descuento</p>
                        <p className="text-lg text-blue-600">{Number(selectedProducto.descuento)}%</p>
                      </div>
                    )}
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-blue-800">
                        <strong>Margen de Ganancia:</strong> {
                          (((toNumber(selectedProducto.precio_venta) - toNumber(selectedProducto.precio_compra)) / (toNumber(selectedProducto.precio_compra) || 1)) * 100).toFixed(2)
                        }%
                      </p>
                      <p className="text-blue-800">
                        <strong>Ganancia por unidad:</strong> S/ {
                          (toNumber(selectedProducto.precio_venta) - toNumber(selectedProducto.precio_compra)).toFixed(2)
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Estado */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Estado</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${selectedProducto.estatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>{selectedProducto.estatus ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    {selectedProducto.oferta && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span>En Oferta</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold border-b pb-2">Fechas</h4>
                  <div>
                    <p className="font-semibold">Fecha de Registro</p>
                    <p>{new Date(selectedProducto.fecha_registro).toLocaleString('es-PE')}</p>
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