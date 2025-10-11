'use client'

import { useState } from 'react'
import { OrdenesTable, OrdenCompleta } from '@/components/ordenes/ordenes-table'
import { OrdenWizard } from '@/components/ordenes/orden-wizard'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

// Se reutiliza OrdenCompleta exportado desde la tabla

type ModalState = 'closed' | 'create' | 'edit' | 'view' | 'editItems'

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
                {selectedOrden.estado_orden === 'pendiente' && (
                  <div className="mt-3">
                    <button
                      className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => setModalState('editItems')}
                    >
                      Editar items
                    </button>
                  </div>
                )}
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
                        {(() => {
                          const persona = selectedOrden.trabajador_principal?.usuario?.persona ?? selectedOrden.trabajador_principal?.persona
                          return (
                            <p className="font-medium">
                              {persona ? `${persona.nombre} ${persona.apellido_paterno}` : 'Sin datos de contacto'}
                            </p>
                          )
                        })()}
                        <p className="text-sm text-gray-600">{selectedOrden.trabajador_principal.codigo_empleado}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Servicios y productos asociados */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold border-b pb-2">Servicios y Asociaciones</h4>
                <div className="space-y-2">
                  {selectedOrden.detalles_transaccion.filter((d:any) => d.servicio).map((detalle:any, idx:number) => {
                    const unidadFactor: Record<string, number> = { minutos: 1, horas: 60, dias: 60*24, semanas: 60*24*7 }
                    const unidad = detalle.servicio.unidad_tiempo || 'minutos'
                    const minMin = Number(detalle.servicio.tiempo_minimo) * unidadFactor[unidad] * Number(detalle.cantidad)
                    const maxMin = Number(detalle.servicio.tiempo_maximo) * unidadFactor[unidad] * Number(detalle.cantidad)
                    const formatRange = (minMin:number, maxMin:number) => {
                      const units = [ { label: 'min', factor: 1 }, { label: 'h', factor: 60 }, { label: 'd', factor: 60*24 }, { label: 'sem', factor: 60*24*7 } ]
                      const pick = (val:number) => val >= units[3].factor ? units[3] : val >= units[2].factor ? units[2] : val >= units[1].factor ? units[1] : units[0]
                      const unitSel = pick(maxMin)
                      const f = unitSel.factor
                      const minVal = Math.round((minMin / f) * 10) / 10
                      const maxVal = Math.round((maxMin / f) * 10) / 10
                      return `${minVal}–${maxVal} ${unitSel.label}`
                    }
                    const productoAsociado = (detalle as any).productos_asociados?.[0]?.producto
                    return (
                      <Card key={`srv-${idx}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{detalle.servicio.nombre}</div>
                              <div className="text-xs text-gray-500">{detalle.servicio.codigo_servicio}</div>
                            </div>
                            <div className="text-sm text-gray-700">Duración: {formatRange(minMin, maxMin)}</div>
                          </div>
                          {productoAsociado && (
                            <div className="mt-2 text-sm">
                              <span className="font-medium">Producto asociado:</span> {productoAsociado.nombre} ({productoAsociado.codigo_producto})
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {modalState === 'editItems' && selectedOrden && (
            <OrdenItemsEditor
              orden={selectedOrden}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
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
import type { ServicioCompleto, ProductoCompleto } from '@/types'
import { calcularTotalLinea } from '@/components/ordenes/wizard/utils'
import { Card as UCard, CardContent as UCardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface OrdenItemsEditorProps {
  orden: OrdenCompleta
  onSuccess: () => void
  onCancel: () => void
}

function OrdenItemsEditor({ orden, onSuccess, onCancel }: OrdenItemsEditorProps) {
  const [items, setItems] = useState<Array<{
    id_referencia: number
    tipo: 'producto'|'servicio'
    nombre: string
    codigo: string
    cantidad: number
    precio_unitario: number
    descuento: number
    total: number
    servicio_ref?: number | null
  }>>(() => {
    const inicial: any[] = []
    for (const d of orden.detalles_transaccion as any[]) {
      if (d.servicio) {
        inicial.push({
          id_referencia: d.servicio.id_servicio,
          tipo: 'servicio',
          nombre: d.servicio.nombre,
          codigo: d.servicio.codigo_servicio,
          cantidad: d.cantidad,
          precio_unitario: Number(d.precio),
          descuento: Number(d.descuento || 0),
          total: calcularTotalLinea(Number(d.cantidad), Number(d.precio), Number(d.descuento || 0))
        })
      } else if (d.producto) {
        const asociadoSrvId = d.servicio_asociado?.servicio?.id_servicio
        inicial.push({
          id_referencia: d.producto.id_producto,
          tipo: 'producto',
          nombre: d.producto.nombre,
          codigo: d.producto.codigo_producto,
          cantidad: d.cantidad,
          precio_unitario: Number(d.precio),
          descuento: Number(d.descuento || 0),
          total: calcularTotalLinea(Number(d.cantidad), Number(d.precio), Number(d.descuento || 0)),
          servicio_ref: asociadoSrvId ?? null
        })
      }
    }
    return inicial
  })
  const [servicios, setServicios] = useState<ServicioCompleto[]>([])
  const [productos, setProductos] = useState<ProductoCompleto[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const [srvRes, prodRes] = await Promise.all([
          fetch('/api/servicios'),
          fetch('/api/productos?tipo=producto&limit=100')
        ])
        const [srvData, prodData] = await Promise.all([srvRes.json(), prodRes.json()])
        setServicios(srvData.servicios || [])
        setProductos(prodData.productos || [])
      } catch {/* noop */}
    }
    fetchCatalogs()
  }, [])

  const agregarServicio = (s: ServicioCompleto) => {
    const ya = items.find(i => i.tipo==='servicio' && i.id_referencia===s.id_servicio)
    if (ya) {
      const copy = [...items]
      ya.cantidad += 1
      ya.total = calcularTotalLinea(ya.cantidad, ya.precio_unitario, ya.descuento)
      setItems(copy)
      return
    }
    const item = {
      id_referencia: s.id_servicio,
      tipo: 'servicio' as const,
      nombre: s.nombre,
      codigo: s.codigo_servicio,
      cantidad: 1,
      precio_unitario: Number(s.precio_base),
      descuento: s.oferta ? Number(s.descuento || 0) : 0,
      total: calcularTotalLinea(1, Number(s.precio_base), s.oferta ? Number(s.descuento || 0) : 0)
    }
    setItems(prev => [...prev, item])
  }

  const agregarProducto = (p: ProductoCompleto) => {
    const ya = items.find(i => i.tipo==='producto' && i.id_referencia===p.id_producto)
    if (ya) {
      const copy = [...items]
      ya.cantidad += 1
      ya.total = calcularTotalLinea(ya.cantidad, ya.precio_unitario, ya.descuento)
      setItems(copy)
      return
    }
    const item = {
      id_referencia: p.id_producto,
      tipo: 'producto' as const,
      nombre: p.nombre,
      codigo: p.codigo_producto,
      cantidad: 1,
      precio_unitario: Number(p.precio_venta),
      descuento: Number(p.descuento || 0),
      total: calcularTotalLinea(1, Number(p.precio_venta), Number(p.descuento || 0)),
      servicio_ref: null
    }
    setItems(prev => [...prev, item])
  }

  const actualizarItem = (index: number, campo: keyof typeof items[number], valor: any) => {
    const copy = [...items]
    const item = { ...copy[index] }
    if (campo === 'cantidad') {
      const c = parseInt(String(valor), 10)
      item.cantidad = Number.isFinite(c) && c>0 ? c : 1
    } else if (campo === 'precio_unitario') {
      const p = parseFloat(String(valor))
      item.precio_unitario = Number.isFinite(p) && p>=0 ? p : 0
    } else if (campo === 'descuento') {
      const d = parseFloat(String(valor))
      item.descuento = Number.isFinite(d) ? Math.max(0, Math.min(100, d)) : 0
    } else if (campo === 'servicio_ref') {
      const s = parseInt(String(valor), 10)
      item.servicio_ref = Number.isFinite(s) ? s : null
    }
    item.total = calcularTotalLinea(item.cantidad, item.precio_unitario, item.descuento)
    copy[index] = item
    setItems(copy)
  }

  const eliminarItem = (index: number) => setItems(items.filter((_,i)=>i!==index))

  const guardar = async () => {
    setSaving(true)
    try {
      // Validación UI: 0–1 producto por servicio
      const map = new Map<number, number>()
      for (const it of items) {
        if (it.tipo==='producto' && it.servicio_ref) {
          const c = map.get(it.servicio_ref) || 0
          if (c>=1) throw new Error('Cada servicio solo puede tener 0 o 1 producto asociado.')
          map.set(it.servicio_ref, c+1)
        }
      }
      const payloadItems = items.map(it => ({
        id_producto: it.id_referencia,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento: it.descuento,
        tipo: it.tipo,
        ...(it.tipo==='producto' && it.servicio_ref ? { servicio_ref: it.servicio_ref } : {})
      }))
      const resp = await fetch('/api/ordenes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_transaccion: orden.id_transaccion, items: payloadItems })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}))
        throw new Error(err.error || 'No se pudo guardar cambios')
      }
      onSuccess()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Editar Items - Orden {orden.codigo_transaccion}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="font-semibold">Servicios</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {servicios.map(s => (
              <UCard key={`srv-${s.id_servicio}`} className="cursor-pointer hover:bg-gray-50" onClick={()=>agregarServicio(s)}>
                <UCardContent className="p-3">
                  <div className="font-medium">{s.nombre}</div>
                  <div className="text-xs text-gray-500">{s.codigo_servicio}</div>
                </UCardContent>
              </UCard>
            ))}
          </div>
          <Separator />
          <h4 className="font-semibold">Productos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {productos.map(p => (
              <UCard key={`prod-${p.id_producto}`} className="cursor-pointer hover:bg-gray-50" onClick={()=>agregarProducto(p)}>
                <UCardContent className="p-3">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-xs text-gray-500">{p.codigo_producto}</div>
                </UCardContent>
              </UCard>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold">Items seleccionados ({items.length})</h4>
          {items.length===0 ? (
            <div className="text-sm text-gray-500">No hay items seleccionados</div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <UCard key={`it-${it.tipo}-${it.id_referencia}-${idx}`}>
                  <UCardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{it.nombre}</div>
                        <div className="text-xs text-gray-500">{it.codigo}</div>
                      </div>
                      <button className="text-xs text-red-600" onClick={()=>eliminarItem(idx)}>Eliminar</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="block text-xs text-gray-600">Cantidad</label>
                        <input type="number" min={1} value={it.cantidad} onChange={(e)=>actualizarItem(idx,'cantidad',e.target.value)} className="border rounded px-2 py-1 w-full" title="Cantidad" placeholder="Cantidad" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Precio</label>
                        <input type="number" min={0} value={it.precio_unitario} onChange={(e)=>actualizarItem(idx,'precio_unitario',e.target.value)} className="border rounded px-2 py-1 w-full" title="Precio" placeholder="Precio" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600">Descuento %</label>
                        <input type="number" min={0} max={100} value={it.descuento} onChange={(e)=>actualizarItem(idx,'descuento',e.target.value)} className="border rounded px-2 py-1 w-full" title="Descuento" placeholder="Descuento" />
                      </div>
                    </div>
                    {it.tipo==='producto' && (
                      <div>
                        <label className="block text-xs text-gray-600">Asociar a servicio</label>
                        <select value={it.servicio_ref ?? ''} onChange={(e)=>actualizarItem(idx,'servicio_ref',e.target.value || null)} className="border rounded px-2 py-1 text-sm w-full" aria-label="Asociar producto a servicio">
                          <option value="">Sin asociar</option>
                          {items.filter(i=>i.tipo==='servicio').map(srv => {
                            const ocupado = items.some(pp => pp.tipo==='producto' && pp.servicio_ref===srv.id_referencia && pp!==it)
                            return <option key={`srv-opt-${srv.id_referencia}`} value={srv.id_referencia} disabled={ocupado}>{srv.nombre}{ocupado?' (ocupado)':''}</option>
                          })}
                        </select>
                      </div>
                    )}
                  </UCardContent>
                </UCard>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
      </div>
    </div>
  )
}

interface OrdenEditSimpleProps {
  orden: OrdenCompleta
  onSuccess: () => void
  onCancel: () => void
  onOrdenUpdated: (orden: OrdenCompleta) => void
}

interface TrabajadorOption {
  id_trabajador: number
  codigo_empleado: string
  persona?: { nombre: string; apellido_paterno: string } | null
  usuario?: { persona?: { nombre: string; apellido_paterno: string } | null } | null
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
                {trabajadores.map(t => {
                  const persona = t.usuario?.persona ?? t.persona
                  const nombreCompleto = persona ? `${persona.nombre} ${persona.apellido_paterno}`.trim() : 'Sin datos'
                  return (
                    <SelectItem key={t.id_trabajador} value={String(t.id_trabajador)}>
                      {nombreCompleto} ({t.codigo_empleado})
                    </SelectItem>
                  )
                })}
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