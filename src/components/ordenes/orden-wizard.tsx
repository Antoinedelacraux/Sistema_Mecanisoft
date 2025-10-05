'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Car, 
  Package, 
  Plus, 
  Minus,
  X,
  Calculator
} from 'lucide-react'
import { ClienteCompleto, VehiculoCompleto, ProductoCompleto, TrabajadorCompleto, ServicioCompleto } from '@/types'
// Eliminamos import de Prisma Decimal para evitar incluir runtime en el bundle del cliente
import { useToast } from '@/components/ui/use-toast'
import { format, addMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

interface OrdenWizardProps {
  onSuccess: () => void
  onCancel: () => void
}

type CatalogoItem =
  | { tipo: 'producto'; producto: ProductoCompleto }
  | { tipo: 'servicio'; servicio: ServicioCompleto }

interface ItemOrden {
  id_referencia: number
  tipo: 'producto' | 'servicio'
  nombre: string
  codigo: string
  cantidad: number
  precio_unitario: number
  descuento: number
  total: number
  oferta: boolean
  permiteEditarDescuento: boolean
}

type Step = 'cliente' | 'vehiculo' | 'servicios' | 'asignacion' | 'resumen'

export function OrdenWizard({ onSuccess, onCancel }: OrdenWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('cliente')
  const [loading, setLoading] = useState(false)
  
  // Datos del wizard
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteCompleto | null>(null)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoCompleto | null>(null)
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<TrabajadorCompleto | null>(null)
  const [items, setItems] = useState<ItemOrden[]>([])
  const [prioridad, setPrioridad] = useState('media')
  const [observaciones, setObservaciones] = useState('')
  
  // Datos para selects
  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoCompleto[]>([])
  const [servicios, setServicios] = useState<ServicioCompleto[]>([])
  const [trabajadores, setTrabajadores] = useState<TrabajadorCompleto[]>([])
  
  const { toast } = useToast()

  const steps = [
    { id: 'cliente', title: 'Cliente', icon: User },
    { id: 'vehiculo', title: 'Vehículo', icon: Car },
    { id: 'servicios', title: 'Servicios', icon: Package },
    { id: 'asignacion', title: 'Asignación', icon: User },
    { id: 'resumen', title: 'Resumen', icon: Calculator }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesRes, serviciosRes, trabajadoresRes] = await Promise.all([
          fetch('/api/clientes/activos'),
          fetch('/api/servicios'), // Solo servicios para órdenes
          fetch('/api/trabajadores?solo_activos=true')
        ])

        const [clientesData, serviciosData, trabajadoresData] = await Promise.all([
          clientesRes.json(),
          serviciosRes.json(),
          trabajadoresRes.json()
        ])

        setClientes(clientesData.clientes || [])
        setServicios(serviciosData.servicios || [])
        setTrabajadores(trabajadoresData.trabajadores || [])
      } catch (error) {
        console.error('Error cargando datos:', error)
      }
    }

    fetchData()
  }, [])

  // Cargar vehículos cuando se selecciona cliente
  useEffect(() => {
    if (clienteSeleccionado) {
      const fetchVehiculos = async () => {
        try {
          const response = await fetch(`/api/vehiculos?cliente_id=${clienteSeleccionado.id_cliente}`)
          const data = await response.json()
          setVehiculos(data.vehiculos || [])
        } catch (error) {
          console.error('Error cargando vehículos:', error)
        }
      }
      fetchVehiculos()
    } else {
      setVehiculos([])
      setVehiculoSeleccionado(null)
    }
  }, [clienteSeleccionado])

  const nextStep = () => {
    const nextIndex = Math.min(currentStepIndex + 1, steps.length - 1)
    setCurrentStep(steps[nextIndex].id as Step)
  }

  const prevStep = () => {
    const prevIndex = Math.max(currentStepIndex - 1, 0)
    setCurrentStep(steps[prevIndex].id as Step)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'cliente':
        return clienteSeleccionado !== null
      case 'vehiculo':
        return vehiculoSeleccionado !== null
      case 'servicios':
        return items.length > 0
      case 'asignacion':
        return true // Opcional
      case 'resumen':
        return true
    }
  }

  const toNumber = (v: unknown): number => {
    if (v == null) return 0
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    if (typeof v === 'string') {
      const n = parseFloat(v)
      return Number.isNaN(n) ? 0 : n
    }
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'bigint') return Number(v)
    if (typeof v === 'object') {
      const candidate = v as { toString?: () => string }
      if (candidate.toString) {
        const n = Number(candidate.toString())
        return Number.isNaN(n) ? 0 : n
      }
    }
    const fallback = Number(v)
    return Number.isNaN(fallback) ? 0 : fallback
  }

  const formatMoney = (v: unknown) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(toNumber(v))

  const calcularTotalLinea = (cantidad: number, precioUnitario: number, descuento: number) => {
    const cantidadValida = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1
    const precioValido = Number.isFinite(precioUnitario) && precioUnitario >= 0 ? precioUnitario : 0
    const descuentoValido = Number.isFinite(descuento) && descuento >= 0 ? descuento : 0
    return cantidadValida * precioValido * (1 - descuentoValido / 100)
  }

  const unidadTiempoEnMinutos = (unidad: ServicioCompleto['unidad_tiempo']) => {
    switch (unidad) {
      case 'minutos':
        return 1
      case 'horas':
        return 60
      case 'dias':
        return 60 * 24
      case 'semanas':
        return 60 * 24 * 7
      default:
        return 1
    }
  }

  const formatearDuracion = (minutos: number) => {
    if (!Number.isFinite(minutos) || minutos <= 0) return '0 min'
    const total = Math.round(minutos)
    const dias = Math.floor(total / (60 * 24))
    const horas = Math.floor((total % (60 * 24)) / 60)
    const mins = total % 60
    const partes: string[] = []
    if (dias) partes.push(`${dias} d`)
    if (horas) partes.push(`${horas} h`)
    if (mins || partes.length === 0) partes.push(`${mins} min`)
    return partes.join(' ')
  }

  const resumenTiempoServicios = useMemo(() => {
    let totalMin = 0
    let totalMax = 0
    const detalles: Array<{
      id: number
      nombre: string
      cantidad: number
      min: number
      max: number
      unidad: ServicioCompleto['unidad_tiempo']
    }> = []

    items.forEach(item => {
      if (item.tipo !== 'servicio') return
      const servicio = servicios.find(s => s.id_servicio === item.id_referencia)
      if (!servicio) return
      const factor = unidadTiempoEnMinutos(servicio.unidad_tiempo)
      const minCalculado = servicio.tiempo_minimo * factor * item.cantidad
      const maxCalculado = servicio.tiempo_maximo * factor * item.cantidad
      totalMin += minCalculado
      totalMax += maxCalculado
      detalles.push({
        id: servicio.id_servicio,
        nombre: servicio.nombre,
        cantidad: item.cantidad,
        min: minCalculado,
        max: maxCalculado,
        unidad: servicio.unidad_tiempo
      })
    })

    return {
      cantidadServicios: detalles.length,
      totalMin,
      totalMax,
      detalles
    }
  }, [items, servicios])

  const estimacionFechas = useMemo(() => {
    if (resumenTiempoServicios.totalMax === 0) {
      return null
    }
    const inicio = new Date()
    return {
      inicio,
      finMin: addMinutes(inicio, resumenTiempoServicios.totalMin),
      finMax: addMinutes(inicio, resumenTiempoServicios.totalMax)
    }
  }, [resumenTiempoServicios.totalMin, resumenTiempoServicios.totalMax])

  const agregarItem = (elemento: CatalogoItem) => {
    const esProducto = elemento.tipo === 'producto'
    const base = esProducto ? elemento.producto : elemento.servicio
    const idReferencia = esProducto ? elemento.producto.id_producto : elemento.servicio.id_servicio
    const nombre = base.nombre
    const codigo = esProducto ? elemento.producto.codigo_producto : elemento.servicio.codigo_servicio
    const precioBase = esProducto ? toNumber(elemento.producto.precio_venta) : toNumber(elemento.servicio.precio_base)
    const descuentoBase = esProducto
      ? toNumber(elemento.producto.descuento)
      : elemento.servicio.oferta ? toNumber(elemento.servicio.descuento) : 0
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
      permiteEditarDescuento
    }

    setItems(prev => [...prev, nuevoItem])
  }

  const actualizarItem = (index: number, campo: keyof ItemOrden, valor: unknown) => {
    const newItems = [...items]
    const item = { ...newItems[index] }

    if (campo === 'descuento' && !item.permiteEditarDescuento) {
      return
    }

    if (campo === 'cantidad') {
      const nuevaCantidad = parseInt(String(valor), 10)
      item.cantidad = Number.isFinite(nuevaCantidad) && nuevaCantidad > 0 ? nuevaCantidad : 1
    } else if (campo === 'precio_unitario') {
      const nuevoPrecio = parseFloat(String(valor))
      item.precio_unitario = Number.isFinite(nuevoPrecio) && nuevoPrecio >= 0 ? nuevoPrecio : 0
    } else if (campo === 'descuento') {
      const nuevoDescuento = parseFloat(String(valor))
      const descuentoNormalizado = Number.isFinite(nuevoDescuento) ? Math.min(Math.max(nuevoDescuento, 0), 100) : 0
      item.descuento = descuentoNormalizado
    }

    item.total = calcularTotalLinea(item.cantidad, item.precio_unitario, item.descuento)
    newItems[index] = item
    setItems(newItems)
  }

  const eliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const totales = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const impuesto = subtotal * 0.18
    const total = subtotal + impuesto
    return { subtotal, impuesto, total }
  }, [items])

  const submitOrden = async () => {
    if (!clienteSeleccionado || !vehiculoSeleccionado || items.length === 0) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos para crear la orden",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const ordenData = {
        id_cliente: clienteSeleccionado.id_cliente,
        id_vehiculo: vehiculoSeleccionado.id_vehiculo,
        id_trabajador_principal: trabajadorSeleccionado?.id_trabajador,
        prioridad,
        fecha_fin_estimada: estimacionFechas?.finMax?.toISOString(),
        observaciones,
        items: items.map(item => ({
          id_producto: item.id_referencia,
          cantidad: Number.isFinite(item.cantidad) && item.cantidad > 0 ? item.cantidad : 1,
          precio_unitario: Number.isFinite(item.precio_unitario) && item.precio_unitario >= 0 ? item.precio_unitario : 0,
          descuento: Number.isFinite(item.descuento) && item.descuento >= 0 ? item.descuento : 0,
          tipo: item.tipo
        }))
      }

      const response = await fetch('/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ordenData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear orden')
      }

      const result = await response.json()

      toast({
        title: "Orden creada exitosamente",
        description: `Orden ${result.codigo_transaccion} creada para ${clienteSeleccionado.persona.nombre}`,
      })

      onSuccess()
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Ocurrió un error al crear la orden',
        variant: "destructive",
      })
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
            <CardDescription>
              Crea una nueva orden de trabajo paso a paso
            </CardDescription>
          </div>
          
          {/* Indicador de progreso */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Paso {currentStepIndex + 1} de {steps.length}
            </div>
            <div className="w-32">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-between mt-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center gap-2 ${
                  isActive ? 'text-blue-600' : 
                  isCompleted ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-blue-100' : 
                    isCompleted ? 'bg-green-100' : 
                    'bg-gray-100'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                
                {index < steps.length - 1 && (
                  <div className={`w-12 h-px mx-2 ${
                    isCompleted ? 'bg-green-300' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </CardHeader>

      <CardContent>
        {/* Contenido de cada paso */}
        
        {/* PASO 1: Seleccionar Cliente */}
        {currentStep === 'cliente' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Seleccionar Cliente</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientes.map((cliente) => (
                <Card 
                  key={cliente.id_cliente}
                  className={`cursor-pointer transition-colors ${
                    clienteSeleccionado?.id_cliente === cliente.id_cliente 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setClienteSeleccionado(cliente)}
                >
                  <CardContent className="p-4">
                    <div className="font-medium">
                      {cliente.persona.nombre} {cliente.persona.apellido_paterno}
                    </div>
                    <div className="text-sm text-gray-600">
                      {cliente.persona.tipo_documento}: {cliente.persona.numero_documento}
                    </div>
                    {cliente.persona.telefono && (
                      <div className="text-sm text-gray-600">
                        📞 {cliente.persona.telefono}
                      </div>
                    )}
                    <div className="mt-2">
                      <Badge variant="outline">
                        {cliente._count.vehiculos} vehículo{cliente._count.vehiculos !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {clientes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay clientes activos disponibles
              </div>
            )}
          </div>
        )}

        {/* PASO 2: Seleccionar Vehículo */}
        {currentStep === 'vehiculo' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Seleccionar Vehículo</h3>
            
            {clienteSeleccionado && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Cliente seleccionado:</strong> {clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehiculos.map((vehiculo) => (
                <Card 
                  key={vehiculo.id_vehiculo}
                  className={`cursor-pointer transition-colors ${
                    vehiculoSeleccionado?.id_vehiculo === vehiculo.id_vehiculo 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setVehiculoSeleccionado(vehiculo)}
                >
                  <CardContent className="p-4">
                    <div className="font-bold text-lg">{vehiculo.placa}</div>
                    <div className="text-sm text-gray-600">
                      {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}
                    </div>
                    <div className="text-sm text-gray-600">
                      {vehiculo.año} • {vehiculo.tipo}
                    </div>
                    <div className="text-sm text-gray-600">
                      {vehiculo.tipo_combustible} • {vehiculo.transmision}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {vehiculos.length === 0 && clienteSeleccionado && (
              <div className="text-center py-8 text-gray-500">
                Este cliente no tiene vehículos registrados
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Seleccionar Servicios */}
        {currentStep === 'servicios' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Servicios y Productos</h3>
            
            {/* Lista de productos disponibles */}
            <div>
              <h4 className="font-medium mb-3">Servicios Disponibles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {servicios.map((servicio) => {
                  const descuento = toNumber(servicio.descuento)
                  const precioBase = toNumber(servicio.precio_base)
                  const precioFinal = descuento > 0 ? precioBase * (1 - descuento / 100) : precioBase
                  return (
                    <Card 
                      key={servicio.id_servicio}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => agregarItem({ tipo: 'servicio', servicio })}
                    >
                      <CardContent className="p-3">
                        <div className="font-medium text-sm">{servicio.nombre}</div>
                        <div className="text-xs text-gray-600">{servicio.codigo_servicio}</div>
                        <div className="text-sm mt-1 flex items-center gap-2">
                          {descuento > 0 && (
                            <span className="text-xs line-through text-gray-400">
                              {formatMoney(precioBase)}
                            </span>
                          )}
                          <span className="font-semibold text-green-600">
                            {formatMoney(precioFinal)}
                          </span>
                        </div>
                        {descuento > 0 && (
                          <Badge variant="outline" className="mt-1 text-[10px] bg-green-50 text-green-700 border-green-200">
                            -{descuento}%
                          </Badge>
                        )}
                        <div className="text-xs text-gray-600 mt-1">
                          Duración: {servicio.tiempo_minimo} - {servicio.tiempo_maximo} {servicio.unidad_tiempo}
                        </div>
                        <Button size="sm" className="w-full mt-2">
                          <Plus className="w-3 h-3 mr-1" />
                          Agregar
                        </Button>
                      </CardContent>
                    </Card>
                  )})}
              </div>
            </div>

            <Separator />

            {/* Items seleccionados */}
            <div>
              <h4 className="font-medium mb-3">Servicios Seleccionados ({items.length})</h4>
              
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No has agregado servicios aún
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const servicio = item.tipo === 'servicio' ? servicios.find(s => s.id_servicio === item.id_referencia) : null
                    const factor = servicio ? unidadTiempoEnMinutos(servicio.unidad_tiempo) : 0
                    const minCalculado = servicio ? servicio.tiempo_minimo * factor * item.cantidad : 0
                    const maxCalculado = servicio ? servicio.tiempo_maximo * factor * item.cantidad : 0

                    return (
                      <Card key={`${item.tipo}-${item.id_referencia}-${index}`} className="p-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{item.nombre}</div>
                              <div className="text-sm text-gray-600">{item.codigo}</div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <Badge variant="outline" className="text-[10px]">
                                  {item.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                                </Badge>
                                {item.oferta && (
                                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                    Oferta
                                  </Badge>
                                )}
                              </div>
                              {servicio && (
                                <div className="text-xs text-blue-600 mt-2">
                                  Duración estimada: {formatearDuracion(minCalculado)} – {formatearDuracion(maxCalculado)}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Cant:</Label>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => actualizarItem(index, 'cantidad', Math.max(1, item.cantidad - 1))}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-10 text-center">{item.cantidad}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => actualizarItem(index, 'cantidad', item.cantidad + 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Precio:</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.precio_unitario}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarItem(index, 'precio_unitario', e.target.value)}
                                className="w-28"
                                min={0}
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Desc:</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.descuento}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarItem(index, 'descuento', e.target.value)}
                                className="w-24"
                                min={0}
                                max={100}
                                disabled={!item.permiteEditarDescuento}
                              />
                              <span className="text-sm">%</span>
                            </div>

                            <div className="ml-auto font-semibold text-green-600">
                              {formatMoney(item.total)}
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => eliminarItem(index)}
                              className="text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                  
                  {/* Totales */}
                  <Card className="bg-gray-50">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatMoney(totales.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IGV (18%):</span>
                          <span>{formatMoney(totales.impuesto)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-green-600">{formatMoney(totales.total)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 space-y-2 text-sm text-blue-900">
                      <div className="font-semibold">Tiempo estimado del trabajo</div>
                      {resumenTiempoServicios.totalMax > 0 ? (
                        <>
                          <div className="flex justify-between">
                            <span>Duración mínima:</span>
                            <span>{formatearDuracion(resumenTiempoServicios.totalMin)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Duración máxima:</span>
                            <span>{formatearDuracion(resumenTiempoServicios.totalMax)}</span>
                          </div>
                          {estimacionFechas && (
                            <div className="flex justify-between">
                              <span>Fin estimado (máx):</span>
                              <span>{format(estimacionFechas.finMax, 'PPP p', { locale: es })}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>Agrega servicios para calcular la duración estimada.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASO 4: Asignación */}
        {currentStep === 'asignacion' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Asignación y Programación</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Asignar mecánico principal */}
              <div className="space-y-4">
                <h4 className="font-medium">Mecánico Responsable</h4>
                
                <div className="space-y-3">
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setTrabajadorSeleccionado(null)}
                      className={!trabajadorSeleccionado ? 'ring-2 ring-blue-500' : ''}
                    >
                      Sin asignar (asignar después)
                    </Button>
                  </div>
                  
                  {trabajadores.map((trabajador) => (
                    <Card
                      key={trabajador.id_trabajador}
                      className={`cursor-pointer transition-colors ${
                        trabajadorSeleccionado?.id_trabajador === trabajador.id_trabajador
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setTrabajadorSeleccionado(trabajador)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {trabajador.usuario.persona.nombre} {trabajador.usuario.persona.apellido_paterno}
                            </div>
                            <div className="text-sm text-gray-600">{trabajador.codigo_empleado}</div>
                            <Badge variant="outline" className="text-xs">
                              {trabajador.especialidad}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Configuración de la orden */}
              <div className="space-y-4">
                <h4 className="font-medium">Configuración de la Orden</h4>
                
                <div>
                  <Label htmlFor="prioridad">Prioridad</Label>
                  <Select value={prioridad} onValueChange={setPrioridad}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tiempo estimado de trabajo</Label>
                  <Card className="mt-2 bg-slate-50 border-slate-200">
                    <CardContent className="p-4 space-y-2">
                      {resumenTiempoServicios.totalMax > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span>Duración mínima:</span>
                            <span className="font-medium">{formatearDuracion(resumenTiempoServicios.totalMin)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Duración máxima:</span>
                            <span className="font-medium">{formatearDuracion(resumenTiempoServicios.totalMax)}</span>
                          </div>
                          {estimacionFechas && (
                            <div className="pt-2 border-t border-slate-200 text-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span>Inicio estimado:</span>
                                <span>{format(estimacionFechas.inicio, "PPP p", { locale: es })}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Fin estimado (mín):</span>
                                <span>{format(estimacionFechas.finMin, "PPP p", { locale: es })}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Fin estimado (máx):</span>
                                <span>{format(estimacionFechas.finMax, "PPP p", { locale: es })}</span>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Agrega servicios para calcular una duración estimada automática.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Observaciones adicionales sobre el trabajo..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 5: Resumen */}
        {currentStep === 'resumen' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Resumen de la Orden</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información del cliente y vehículo */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clienteSeleccionado && (
                      <div>
                        <p className="font-medium">
                          {clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}
                        </p>
                        <p className="text-sm text-gray-600">
                          {clienteSeleccionado.persona.tipo_documento}: {clienteSeleccionado.persona.numero_documento}
                        </p>
                        {clienteSeleccionado.persona.telefono && (
                          <p className="text-sm text-gray-600">
                            📞 {clienteSeleccionado.persona.telefono}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Vehículo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {vehiculoSeleccionado && (
                      <div>
                        <p className="font-bold text-lg">{vehiculoSeleccionado.placa}</p>
                        <p className="text-sm text-gray-600">
                          {vehiculoSeleccionado.modelo.marca.nombre_marca} {vehiculoSeleccionado.modelo.nombre_modelo}
                        </p>
                        <p className="text-sm text-gray-600">
                          {vehiculoSeleccionado.año} • {vehiculoSeleccionado.tipo}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {trabajadorSeleccionado && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mecánico Asignado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <p className="font-medium">
                          {trabajadorSeleccionado.usuario.persona.nombre} {trabajadorSeleccionado.usuario.persona.apellido_paterno}
                        </p>
                        <p className="text-sm text-gray-600">{trabajadorSeleccionado.codigo_empleado}</p>
                        <Badge variant="outline">{trabajadorSeleccionado.especialidad}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Resumen de servicios y totales */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Servicios ({items.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {items.map((item, index) => {
                        const servicio = item.tipo === 'servicio' ? servicios.find(s => s.id_servicio === item.id_referencia) : null
                        const factor = servicio ? unidadTiempoEnMinutos(servicio.unidad_tiempo) : 0
                        const minCalculado = servicio ? servicio.tiempo_minimo * factor * item.cantidad : 0
                        const maxCalculado = servicio ? servicio.tiempo_maximo * factor * item.cantidad : 0

                        return (
                          <div key={`${item.tipo}-${item.id_referencia}-${index}`} className="space-y-1 py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-sm">{item.nombre}</div>
                                <div className="text-xs text-gray-500">{item.codigo}</div>
                              </div>
                              <div className="font-semibold text-green-700">{formatMoney(item.total)}</div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2">
                              <div>
                                {item.cantidad} x {formatMoney(item.precio_unitario)}
                                {item.descuento > 0 && ` (-${item.descuento}%)`}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {item.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                                </Badge>
                                {item.oferta && (
                                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                    Oferta
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {servicio && (
                              <div className="text-xs text-blue-600">
                                Duración estimada: {formatearDuracion(minCalculado)} – {formatearDuracion(maxCalculado)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatMoney(totales.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IGV (18%):</span>
                        <span>{formatMoney(totales.impuesto)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-green-600">{formatMoney(totales.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Configuración */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Configuración</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Prioridad:</span> {prioridad.toUpperCase()}
                      </div>
                      {resumenTiempoServicios.totalMax > 0 && estimacionFechas && (
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium">Duración mínima:</span> {formatearDuracion(resumenTiempoServicios.totalMin)}
                          </div>
                          <div>
                            <span className="font-medium">Duración máxima:</span> {formatearDuracion(resumenTiempoServicios.totalMax)}
                          </div>
                          <div>
                            <span className="font-medium">Inicio estimado:</span> {format(estimacionFechas.inicio, "PPP p", { locale: es })}
                          </div>
                          <div>
                            <span className="font-medium">Fin estimado:</span> {format(estimacionFechas.finMax, "PPP p", { locale: es })}
                          </div>
                        </div>
                      )}
                      {observaciones && (
                        <div>
                          <span className="font-medium">Observaciones:</span>
                          <p className="text-sm text-gray-600 mt-1">{observaciones}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Navegación */}
        <div className="flex justify-between pt-6">
          <div>
            {currentStepIndex > 0 && (
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={loading}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            
            {currentStep === 'resumen' ? (
              <Button
                onClick={submitOrden}
                disabled={loading || !canProceed()}
              >
                {loading ? 'Creando Orden...' : 'Crear Orden de Trabajo'}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
              >
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