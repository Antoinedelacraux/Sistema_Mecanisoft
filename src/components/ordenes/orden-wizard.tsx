'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, User, Car, Package, Calculator } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { ClienteCompleto, VehiculoCompleto, TrabajadorCompleto, ServicioCompleto, ProductoCompleto } from '@/types'
import type { Step, ItemOrden, CatalogoItem } from './wizard/types'
import { toNumber, calcularTotalLinea, resumenTiempoServicios, estimacionFechas, validarServiciosProductos } from './wizard/utils'
import { ClienteStep } from './wizard/ClienteStep'
import { VehiculoStep } from './wizard/VehiculoStep'
import { ServiciosStep } from './wizard/ServiciosStep'
import { AsignacionStep } from './wizard/AsignacionStep'
import { ResumenStep } from './wizard/ResumenStep'

interface OrdenWizardProps {
  onSuccess: () => void
  onCancel: () => void
}

export function OrdenWizard({ onSuccess, onCancel }: OrdenWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('modo')
  const [loading, setLoading] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteCompleto | null>(null)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoCompleto | null>(null)
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<TrabajadorCompleto | null>(null)
  const [items, setItems] = useState<ItemOrden[]>([])
  const [modoOrden, setModoOrden] = useState<'solo_servicios' | 'servicios_y_productos'>('solo_servicios')
  const [prioridad, setPrioridad] = useState('media')
  const [observaciones, setObservaciones] = useState('')
  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoCompleto[]>([])
  const [servicios, setServicios] = useState<ServicioCompleto[]>([])
  const [trabajadores, setTrabajadores] = useState<TrabajadorCompleto[]>([])
  const [productos, setProductos] = useState<ProductoCompleto[]>([])
  const { toast } = useToast()

  const steps: Array<{ id: Step; title: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'modo', title: 'Tipo de Orden', icon: Package },
    { id: 'cliente', title: 'Cliente', icon: User },
    { id: 'vehiculo', title: 'Vehículo', icon: Car },
    { id: 'servicios', title: 'Servicios', icon: Package },
    { id: 'asignacion', title: 'Asignación', icon: User },
    { id: 'resumen', title: 'Resumen', icon: Calculator }
  ]
  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesRes, serviciosRes, trabajadoresRes] = await Promise.all([
          fetch('/api/clientes/activos'),
          fetch('/api/servicios'),
          fetch('/api/trabajadores?solo_activos=true')
        ])
  const productosRes = await fetch('/api/productos?tipo=producto&limit=100&estatus=activos')
        const [clientesData, serviciosData, trabajadoresData, productosData] = await Promise.all([
          clientesRes.json(),
          serviciosRes.json(),
          trabajadoresRes.json(),
          productosRes.json()
        ])
        setClientes(clientesData.clientes || [])
        setServicios(serviciosData.servicios || [])
  setTrabajadores(trabajadoresData.trabajadores || [])
  setProductos(productosData.productos || [])
      } catch (e) {
        console.error('Error cargando datos del wizard', e)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (clienteSeleccionado) {
      const fetchVehiculos = async () => {
        try {
          const response = await fetch(`/api/vehiculos?cliente_id=${clienteSeleccionado.id_cliente}`)
          const data = await response.json()
          setVehiculos(data.vehiculos || [])
        } catch (e) {
          console.error('Error cargando vehículos', e)
        }
      }
      fetchVehiculos()
    } else {
      setVehiculos([])
      setVehiculoSeleccionado(null)
    }
  }, [clienteSeleccionado])

  const nextStep = () => setCurrentStep(steps[Math.min(currentStepIndex + 1, steps.length - 1)].id)
  const prevStep = () => setCurrentStep(steps[Math.max(currentStepIndex - 1, 0)].id)
  const canProceed = () => currentStep === 'cliente' ? !!clienteSeleccionado : currentStep === 'vehiculo' ? !!vehiculoSeleccionado : currentStep === 'servicios' ? items.length > 0 : true

  const totales = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const impuesto = subtotal * 0.18
    const total = subtotal + impuesto
    return { subtotal, impuesto, total }
  }, [items])

  const resumenTiempo = useMemo(() => resumenTiempoServicios(items, servicios), [items, servicios])
  const fechas = useMemo(() => estimacionFechas(resumenTiempo.totalMin, resumenTiempo.totalMax), [resumenTiempo.totalMin, resumenTiempo.totalMax])

  const submitOrden = async () => {
    if (!clienteSeleccionado || !vehiculoSeleccionado || items.length === 0) {
      toast({ title: 'Error', description: 'Faltan datos requeridos para crear la orden', variant: 'destructive' })
      return
    }
    const val = validarServiciosProductos(items)
    if (!val.ok) {
      toast({ title: 'Error', description: val.mensaje, variant: 'destructive' })
      return
    }
    if (modoOrden === 'solo_servicios' && items.some(i => i.tipo === 'producto')) {
      toast({ title: 'Modo solo servicios', description: 'No puedes agregar productos en modo Solo servicios.', variant: 'destructive' })
      return
    }
    const productoSinAlmacen = items.find((item) => item.tipo === 'producto' && !item.almacenId)
    if (productoSinAlmacen) {
      toast({
        title: 'Selecciona un almacén',
        description: `Define desde qué almacén se reservará el producto ${productoSinAlmacen.nombre}.`,
        variant: 'destructive',
      })
      setCurrentStep('servicios')
      return
    }
    setLoading(true)
    try {
      const ordenData = {
        id_cliente: clienteSeleccionado.id_cliente,
        id_vehiculo: vehiculoSeleccionado.id_vehiculo,
        id_trabajador_principal: trabajadorSeleccionado?.id_trabajador,
        prioridad,
        fecha_fin_estimada: fechas?.finMax?.toISOString(),
        observaciones,
        modo_orden: modoOrden,
        items: items.map(item => ({
          // La API espera 'id_producto' como identificador genérico del catálogo;
          // para servicios también enviamos el id del servicio en este campo.
          id_producto: item.id_referencia,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento,
          tipo: item.tipo,
          ...(item.tipo === 'producto' && item.servicio_ref ? { servicio_ref: item.servicio_ref } : {}),
          ...(item.tipo === 'producto' ? { almacen_id: item.almacenId } : {}),
          ...(item.tipo === 'producto' ? { ubicacion_id: item.ubicacionId ?? null } : {})
        }))
      }
      const response = await fetch('/api/ordenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ordenData) })
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Error al crear orden') }
      const result = await response.json()
      toast({ title: 'Orden creada exitosamente', description: `Orden ${result.codigo_transaccion} creada para ${clienteSeleccionado.persona.nombre}` })
      onSuccess()
    } catch (error: unknown) {
      const message = (error as Error)?.message || 'Ocurrió un error al crear la orden'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Nueva Orden de Trabajo</CardTitle>
            <CardDescription>Crea una nueva orden de trabajo paso a paso</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">Paso {currentStepIndex + 1} de {steps.length}</div>
            <div className="w-32"><Progress value={progress} className="h-2" /></div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {currentStep === 'modo' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">¿Qué tipo de orden requiere el cliente?</h3>
            <div className="flex gap-4">
              <Button type="button" variant={modoOrden==='solo_servicios'?'default':'outline'} onClick={()=>setModoOrden('solo_servicios')}>Solo servicios</Button>
              <Button type="button" variant={modoOrden==='servicios_y_productos'?'default':'outline'} onClick={()=>setModoOrden('servicios_y_productos')}>Servicios + productos</Button>
            </div>
          </div>
        )}
        {currentStep === 'cliente' && (
          <ClienteStep clientes={clientes} clienteSeleccionado={clienteSeleccionado} setClienteSeleccionado={setClienteSeleccionado} />
        )}
        {currentStep === 'vehiculo' && (
          <VehiculoStep clienteSeleccionado={clienteSeleccionado} vehiculos={vehiculos} vehiculoSeleccionado={vehiculoSeleccionado} setVehiculoSeleccionado={setVehiculoSeleccionado} />
        )}
        {currentStep === 'servicios' && (
          <ServiciosStep
            servicios={servicios}
            productos={productos}
            modoOrden={modoOrden}
            items={items}
            setItems={setItems}
            agregarItem={(elemento: CatalogoItem) => {
              const esProducto = elemento.tipo === 'producto'
              if (esProducto && modoOrden === 'solo_servicios') {
                toast({ title: 'Modo solo servicios', description: 'No puedes agregar productos en modo Solo servicios.', variant: 'destructive' })
                return
              }
              const base = esProducto ? elemento.producto : elemento.servicio
              const idReferencia = esProducto ? elemento.producto.id_producto : elemento.servicio.id_servicio
              const nombre = base.nombre
              const codigo = esProducto ? elemento.producto.codigo_producto : elemento.servicio.codigo_servicio
              const precioBase = esProducto ? toNumber(elemento.producto.precio_venta) : toNumber(elemento.servicio.precio_base)
              const descuentoBase = esProducto ? toNumber(elemento.producto.descuento) : elemento.servicio.oferta ? toNumber(elemento.servicio.descuento) : 0
              const ofertaActiva = esProducto ? Boolean(elemento.producto.oferta) : Boolean(elemento.servicio.oferta)
              const permiteEditarDescuento = esProducto ? true : ofertaActiva
              const existingIndex = items.findIndex(item => item.id_referencia === idReferencia && item.tipo === (esProducto ? 'producto' : 'servicio'))
              if (existingIndex >= 0) {
                const newItems = [...items]
                const actual = { ...newItems[existingIndex] }
                actual.cantidad += 1
                actual.total = calcularTotalLinea(actual.cantidad, actual.precio_unitario, actual.descuento)
                newItems[existingIndex] = actual
                setItems(newItems)
                return
              }
              const nuevoItem: ItemOrden = {
                id_referencia: idReferencia,
                tipo: esProducto ? 'producto' : 'servicio',
                nombre,
                codigo,
                cantidad: 1,
                precio_unitario: precioBase,
                descuento: permiteEditarDescuento ? descuentoBase : 0,
                total: calcularTotalLinea(1, precioBase, permiteEditarDescuento ? descuentoBase : 0),
                oferta: ofertaActiva,
                permiteEditarDescuento,
                servicio_ref: esProducto ? null : undefined,
                ...(esProducto ? { almacenId: null, ubicacionId: null } : {})
              }
              setItems(prev => [...prev, nuevoItem])
            }}
            actualizarItem={(index, campo, valor) => {
              const newItems = [...items]
              const item = { ...newItems[index] }
              if (campo === 'descuento' && !item.permiteEditarDescuento) return
              if (campo === 'cantidad') {
                const nuevaCantidad = parseInt(String(valor), 10)
                item.cantidad = Number.isFinite(nuevaCantidad) && nuevaCantidad > 0 ? nuevaCantidad : 1
              } else if (campo === 'precio_unitario') {
                const nuevoPrecio = parseFloat(String(valor))
                item.precio_unitario = Number.isFinite(nuevoPrecio) && nuevoPrecio >= 0 ? nuevoPrecio : 0
              } else if (campo === 'descuento') {
                const nuevoDescuento = parseFloat(String(valor))
                const d = Number.isFinite(nuevoDescuento) ? Math.min(Math.max(nuevoDescuento, 0), 100) : 0
                item.descuento = d
              } else if (campo === 'servicio_ref') {
                const idSrv = parseInt(String(valor), 10)
                item.servicio_ref = Number.isFinite(idSrv) ? idSrv : null
              } else if (campo === 'almacenId') {
                const parsed = typeof valor === 'number' ? valor : parseInt(String(valor), 10)
                item.almacenId = Number.isFinite(parsed) ? parsed : null
                item.ubicacionId = null
              } else if (campo === 'ubicacionId') {
                const parsed = typeof valor === 'number' ? valor : parseInt(String(valor), 10)
                item.ubicacionId = Number.isFinite(parsed) ? parsed : null
              }
              item.total = calcularTotalLinea(item.cantidad, item.precio_unitario, item.descuento)
              newItems[index] = item
              setItems(newItems)
            }}
            eliminarItem={(index) => setItems(items.filter((_, i) => i !== index))}
          />
        )}
        {currentStep === 'asignacion' && (
          <AsignacionStep
            trabajadores={trabajadores}
            trabajadorSeleccionado={trabajadorSeleccionado}
            setTrabajadorSeleccionado={setTrabajadorSeleccionado}
            prioridad={prioridad}
            setPrioridad={setPrioridad}
            observaciones={observaciones}
            setObservaciones={setObservaciones}
          />
        )}
        {currentStep === 'resumen' && (
          <ResumenStep
            clienteSeleccionado={clienteSeleccionado}
            vehiculoSeleccionado={vehiculoSeleccionado}
            trabajadorSeleccionado={trabajadorSeleccionado}
            items={items}
            servicios={servicios}
            prioridad={prioridad}
            observaciones={observaciones}
            estimacion={fechas}
            totales={totales}
          />
        )}
        <div className="flex justify-between pt-6">
          <div>
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={prevStep} disabled={loading}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
            {currentStep === 'resumen' ? (
              <Button onClick={submitOrden} disabled={loading || !canProceed()}>
                {loading ? 'Creando Orden...' : 'Crear Orden de Trabajo'}
              </Button>
            ) : (
              <Button onClick={nextStep} disabled={!canProceed()}>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}