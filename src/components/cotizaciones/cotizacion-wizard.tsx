'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  FileText
} from 'lucide-react'
import { ClienteCompleto, VehiculoCompleto, ProductoCompleto, ServicioCompleto } from '@/types'
// Evitamos importar Decimal de Prisma en componentes cliente
import { useToast } from '@/components/ui/use-toast'
import { format, addDays, addMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

interface CotizacionWizardProps {
  onSuccess: () => void
  onCancel: () => void
}

type CatalogoItem =
  | { tipo: 'producto'; producto: ProductoCompleto }
  | { tipo: 'servicio'; servicio: ServicioCompleto }

interface ItemCotizacion {
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

type Step = 'cliente' | 'vehiculo' | 'servicios' | 'resumen'

export function CotizacionWizard({ onSuccess, onCancel }: CotizacionWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('cliente')
  const [loading, setLoading] = useState(false)
  
  // Datos del wizard
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteCompleto | null>(null)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoCompleto | null>(null)
  const [items, setItems] = useState<ItemCotizacion[]>([])
  const [vigenciaDias, setVigenciaDias] = useState(7)
  
  // Datos para selects
  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoCompleto[]>([])
  const [productos, setProductos] = useState<ProductoCompleto[]>([])
  const [servicios, setServicios] = useState<ServicioCompleto[]>([])
  
  const { toast } = useToast()

  const steps = [
    { id: 'cliente', title: 'Cliente', icon: User },
    { id: 'vehiculo', title: 'Vehículo', icon: Car },
    { id: 'servicios', title: 'Servicios', icon: Package },
    { id: 'resumen', title: 'Resumen', icon: FileText }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesRes, productosRes, serviciosRes] = await Promise.all([
          fetch('/api/clientes/activos'),
          fetch('/api/productos'),
          fetch('/api/servicios?estado=activos&limit=1000')
        ])

        const [clientesData, productosData, serviciosData] = await Promise.all([
          clientesRes.json(),
          productosRes.json(),
          serviciosRes.json()
        ])

        setClientes(clientesData.clientes || [])
        setProductos(productosData.productos || [])
        setServicios(serviciosData.servicios || [])
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
        const maybeNumber = Number(candidate.toString())
        return Number.isNaN(maybeNumber) ? 0 : maybeNumber
      }
    }
    const fallback = Number(v)
    return Number.isNaN(fallback) ? 0 : fallback
  }

  const formatMoney = (v: unknown) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(toNumber(v))

  const catalogo = useMemo<CatalogoItem[]>(() => {
    const catalogoProductos: CatalogoItem[] = productos.map(producto => ({ tipo: 'producto', producto }))
    const catalogoServicios: CatalogoItem[] = servicios.map(servicio => ({ tipo: 'servicio', servicio }))
    return [...catalogoProductos, ...catalogoServicios]
  }, [productos, servicios])

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
  const isProducto = elemento.tipo === 'producto'
    const idReferencia = isProducto ? elemento.producto.id_producto : elemento.servicio.id_servicio
    const nombre = isProducto ? elemento.producto.nombre : elemento.servicio.nombre
    const codigo = isProducto ? elemento.producto.codigo_producto : elemento.servicio.codigo_servicio
    const precioBase = isProducto ? toNumber(elemento.producto.precio_venta) : toNumber(elemento.servicio.precio_base)
    const descuentoBase = isProducto
      ? toNumber(elemento.producto.descuento)
      : elemento.servicio.oferta ? toNumber(elemento.servicio.descuento) : 0
    const ofertaActiva = isProducto ? Boolean(elemento.producto.oferta) : Boolean(elemento.servicio.oferta)
    const permiteEditarDescuento = isProducto ? true : ofertaActiva

    const existingIndex = items.findIndex(item => item.id_referencia === idReferencia && item.tipo === (isProducto ? 'producto' : 'servicio'))

    if (existingIndex >= 0) {
      const newItems = [...items]
      const itemActual = newItems[existingIndex]
      const nuevoItem = {
        ...itemActual,
        cantidad: itemActual.cantidad + 1,
      }
      nuevoItem.total = calcularTotalLinea(nuevoItem.cantidad, nuevoItem.precio_unitario, nuevoItem.descuento)
      newItems[existingIndex] = nuevoItem
      setItems(newItems)
      return
    }

    const nuevoItem: ItemCotizacion = {
      id_referencia: idReferencia,
      tipo: isProducto ? 'producto' : 'servicio',
      nombre,
      codigo,
      cantidad: 1,
      precio_unitario: precioBase,
      descuento: permiteEditarDescuento ? descuentoBase : 0,
      total: calcularTotalLinea(1, precioBase, permiteEditarDescuento ? descuentoBase : 0),
      oferta: ofertaActiva,
      permiteEditarDescuento
    }

    setItems([...items, nuevoItem])
  }

  const actualizarItem = (index: number, campo: keyof ItemCotizacion, valor: unknown) => {
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

  const submitCotizacion = async () => {
    if (!clienteSeleccionado || !vehiculoSeleccionado || items.length === 0) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos para crear la cotización",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const cotizacionData = {
        id_cliente: clienteSeleccionado.id_cliente,
        id_vehiculo: vehiculoSeleccionado.id_vehiculo,
        vigencia_dias: vigenciaDias,
        items: items.map(item => {
          const cantidad = Number.isFinite(item.cantidad) && item.cantidad > 0 ? item.cantidad : 1
          const precio_unitario = Number.isFinite(item.precio_unitario) && item.precio_unitario >= 0 ? item.precio_unitario : 0
          const descuento = Number.isFinite(item.descuento) && item.descuento >= 0 ? item.descuento : 0
          return {
            id_producto: item.id_referencia,
            cantidad,
            precio_unitario,
            descuento,
            tipo: item.tipo
          }
        })
      }

      const response = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cotizacionData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear cotización')
      }

      const result = await response.json()

      toast({
        title: "Cotización creada exitosamente",
        description: `Cotización ${result.codigo_cotizacion} creada para ${clienteSeleccionado.persona.nombre}`,
      })

      onSuccess()
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Ocurrió un error al crear la cotización',
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
            <CardTitle>Nueva Cotización</CardTitle>
            <CardDescription>
              Crea una cotización para mostrar al cliente
            </CardDescription>
          </div>
          
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
          </div>
        )}

        {/* PASO 2: Seleccionar Vehículo */}
        {currentStep === 'vehiculo' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Seleccionar Vehículo</h3>
            
            {clienteSeleccionado && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Cliente:</strong> {clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* PASO 3: Servicios (Similar al wizard de órdenes) */}
        {currentStep === 'servicios' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Servicios y Productos</h3>
            
            <div>
              <h4 className="font-medium mb-3">Productos y Servicios Disponibles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {catalogo.map((elemento) => {
                  const isProducto = elemento.tipo === 'producto'
                  const descuento = isProducto
                    ? toNumber(elemento.producto.descuento)
                    : elemento.servicio.oferta ? toNumber(elemento.servicio.descuento) : 0
                  const precioBase = isProducto
                    ? toNumber(elemento.producto.precio_venta)
                    : toNumber(elemento.servicio.precio_base)
                  const precioFinal = descuento > 0 ? precioBase * (1 - descuento / 100) : precioBase
                  const codigo = isProducto ? elemento.producto.codigo_producto : elemento.servicio.codigo_servicio
                  const nombre = isProducto ? elemento.producto.nombre : elemento.servicio.nombre
                  const esOferta = isProducto ? Boolean(elemento.producto.oferta) : Boolean(elemento.servicio.oferta)
                  const tiempoMin = !isProducto ? elemento.servicio.tiempo_minimo : null
                  const tiempoMax = !isProducto ? elemento.servicio.tiempo_maximo : null
                  const unidadTiempo = !isProducto ? elemento.servicio.unidad_tiempo : null
                  const alcance = !isProducto
                    ? elemento.servicio.es_general
                      ? 'Servicio general'
                      : [elemento.servicio.marca?.nombre_marca, elemento.servicio.modelo?.nombre_modelo].filter(Boolean).join(' • ')
                    : null

                  return (
                    <Card
                      key={`${elemento.tipo}-${isProducto ? elemento.producto.id_producto : elemento.servicio.id_servicio}`}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => agregarItem(elemento)}
                    >
                      <CardContent className="p-3 space-y-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span>{nombre}</span>
                          {esOferta && (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                              Oferta
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">{codigo}</div>

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

                        {!isProducto && tiempoMin != null && tiempoMax != null && (
                          <div className="text-xs text-blue-600">
                            Tiempo estimado: {tiempoMin === tiempoMax ? tiempoMin : `${tiempoMin}-${tiempoMax}`} {unidadTiempo}
                          </div>
                        )}

                        {!isProducto && alcance && (
                          <div className="text-[11px] text-gray-500 truncate">
                            {alcance}
                          </div>
                        )}

                        {descuento > 0 && (
                          <Badge variant="outline" className="mt-1 text-[10px] bg-green-50 text-green-700 border-green-200">
                            -{descuento}%
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs mt-1">
                          {isProducto ? 'Producto' : 'Servicio'}
                        </Badge>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Items seleccionados - Similar al wizard de órdenes */}
            {items.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Items Seleccionados ({items.length})</h4>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            <span>{item.nombre}</span>
                            {item.tipo === 'servicio' && !item.permiteEditarDescuento && item.descuento === 0 && (
                              <Badge variant="outline" className="text-[10px] uppercase border-blue-200 text-blue-600">
                                Sin descuento
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">{item.codigo}</div>
                          {item.tipo === 'servicio' && (
                            <div className="text-xs text-blue-600 mt-1">
                              {(() => {
                                const servicio = servicios.find(s => s.id_servicio === item.id_referencia)
                                if (!servicio) return null
                                return `Tiempo estimado: ${servicio.tiempo_minimo === servicio.tiempo_maximo ? servicio.tiempo_minimo : `${servicio.tiempo_minimo}-${servicio.tiempo_maximo}`} ${servicio.unidad_tiempo}`
                              })()}
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
                            <span className="w-8 text-center">{item.cantidad}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => actualizarItem(index, 'cantidad', item.cantidad + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Precio:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarItem(index, 'precio_unitario', e.target.value)}
                            className="w-24"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Desc:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.descuento}
                            disabled={!item.permiteEditarDescuento}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => actualizarItem(index, 'descuento', e.target.value)}
                            className="w-20"
                          />
                          <span className="text-sm">%</span>
                        </div>
                        
                        <div className="font-semibold text-green-600">
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
                    </Card>
                  ))}
                  
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
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-green-600">{formatMoney(totales.total)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 4: Resumen */}
        {currentStep === 'resumen' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Resumen de la Cotización</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Info del cliente */}
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
                          {clienteSeleccionado.persona.numero_documento}
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Configuración</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <Label>Vigencia (días)</Label>
                      <Select value={vigenciaDias.toString()} onValueChange={(value) => setVigenciaDias(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 días</SelectItem>
                          <SelectItem value="7">7 días</SelectItem>
                          <SelectItem value="15">15 días</SelectItem>
                          <SelectItem value="30">30 días</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600 mt-1">
                        Válida hasta: {format(addDays(new Date(), vigenciaDias), "PPP", { locale: es })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Resumen financiero */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Items ({items.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              <span>{item.nombre}</span>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {item.tipo === 'producto' ? 'Producto' : 'Servicio'}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600">
                              {item.cantidad} x {formatMoney(item.precio_unitario)}
                              {item.descuento > 0 && ` (-${item.descuento}%)`}
                            </div>
                            {item.tipo === 'servicio' && (() => {
                              const servicio = servicios.find(s => s.id_servicio === item.id_referencia)
                              if (!servicio) return null
                              return (
                                <div className="text-[11px] text-blue-600 mt-1">
                                  Tiempo estimado: {servicio.tiempo_minimo === servicio.tiempo_maximo ? servicio.tiempo_minimo : `${servicio.tiempo_minimo}-${servicio.tiempo_maximo}`} {servicio.unidad_tiempo}
                                </div>
                              )
                            })()}
                          </div>
                          <div className="font-semibold">
                            {formatMoney(item.total)}
                          </div>
                        </div>
                      ))}
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
                      <div className="flex justify-between font-bold text-xl">
                        <span>Total:</span>
                        <span className="text-green-600">{formatMoney(totales.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {resumenTiempoServicios.cantidadServicios > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Duración estimada</CardTitle>
                      <CardDescription>
                        Calculada a partir de los servicios seleccionados
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex justify-between">
                          <span>Servicios:</span>
                          <span>{resumenTiempoServicios.cantidadServicios}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duración mínima:</span>
                          <span>{formatearDuracion(resumenTiempoServicios.totalMin)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duración máxima:</span>
                          <span>{formatearDuracion(resumenTiempoServicios.totalMax)}</span>
                        </div>
                      </div>

                      {estimacionFechas && (
                        <div className="space-y-1 rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                          <div className="flex justify-between">
                            <span>Inicio estimado:</span>
                            <span>{format(estimacionFechas.inicio, 'PPpp', { locale: es })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fin mínimo:</span>
                            <span>{format(estimacionFechas.finMin, 'PPpp', { locale: es })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fin máximo:</span>
                            <span>{format(estimacionFechas.finMax, 'PPpp', { locale: es })}</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {resumenTiempoServicios.detalles.map(detalle => (
                          <div key={detalle.id} className="border border-dashed border-blue-100 rounded-md p-2 text-[12px] text-blue-800 bg-blue-50/40">
                            <div className="font-medium truncate">{detalle.nombre}</div>
                            <div className="flex justify-between">
                              <span>{detalle.cantidad} servicio{detalle.cantidad !== 1 ? 's' : ''}</span>
                              <span>Mín: {formatearDuracion(detalle.min)}</span>
                            </div>
                            {detalle.min !== detalle.max && (
                              <div className="text-right">Máx: {formatearDuracion(detalle.max)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                onClick={submitCotizacion}
                disabled={loading || !canProceed()}
              >
                {loading ? 'Creando Cotización...' : 'Crear Cotización'}
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