'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, FileText, Package, Car, User } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { ClienteCompleto, CotizacionCompleta, ProductoCompleto, ServicioCompleto, VehiculoCompleto } from '@/types'
import { ClienteStep } from './wizard/ClienteStep'
import { VehiculoStep } from './wizard/VehiculoStep'
import { ItemsStep } from './wizard/ItemsStep'
import { ResumenStep } from './wizard/ResumenStep'
import { ModoStep } from './wizard/ModoStep'
import type { CatalogoItem, CotizacionModo, CotizacionStep, ItemCotizacion } from './wizard/types'
import {
  calcularTotalLinea,
  estimacionFechas as calcularEstimacion,
  resumenTiempoServicios as calcularResumenTiempo,
  toNumber
} from './wizard/utils'

interface CotizacionWizardProps {
  onSuccess: () => void
  onCancel: () => void
  cotizacion?: CotizacionCompleta
}

interface StepDefinition {
  id: CotizacionStep
  title: string
  icon: ComponentType<{ className?: string }>
}

const STEPS: StepDefinition[] = [
  { id: 'modo', title: 'Tipo de Cotización', icon: Package },
  { id: 'cliente', title: 'Cliente', icon: User },
  { id: 'vehiculo', title: 'Vehículo', icon: Car },
  { id: 'items', title: 'Servicios y Productos', icon: Package },
  { id: 'resumen', title: 'Resumen', icon: FileText }
]

const inferirModoDesdeCotizacion = (cotizacion: CotizacionCompleta): CotizacionModo => {
  const tieneServicios = cotizacion.detalle_cotizacion.some((detalle) => Boolean(detalle.servicio))
  const tieneProductos = cotizacion.detalle_cotizacion.some((detalle) => Boolean(detalle.producto))

  if (tieneServicios && tieneProductos) return 'servicios_y_productos'
  if (tieneServicios) return 'solo_servicios'
  if (tieneProductos) return 'solo_productos'
  return 'servicios_y_productos'
}

const calcularVigenciaInicial = (cotizacion: CotizacionCompleta) => {
  if (!cotizacion.vigencia_hasta) return 7

  const fechaCreacion = new Date(cotizacion.created_at)
  const vigenciaHasta = new Date(cotizacion.vigencia_hasta)
  const diff = differenceInCalendarDays(vigenciaHasta, fechaCreacion)

  const dias = Number.isFinite(diff) ? diff : 7
  return Math.min(90, Math.max(1, dias || 1))
}

const mapearDetallesAItems = (cotizacion: CotizacionCompleta): ItemCotizacion[] => {
  return cotizacion.detalle_cotizacion.map((detalle) => {
    const esServicio = Boolean(detalle.id_servicio)

    if (esServicio) {
      const servicio = detalle.servicio
      const cantidad = detalle.cantidad
      const precioUnitario = toNumber(detalle.precio_unitario ?? servicio?.precio_base ?? 0)
      const descuento = toNumber(detalle.descuento ?? servicio?.descuento ?? 0)
      const total = calcularTotalLinea(cantidad, precioUnitario, descuento)

      return {
        id_referencia: detalle.id_servicio ?? (servicio?.id_servicio ?? 0),
        tipo: 'servicio',
        nombre: servicio?.nombre ?? 'Servicio sin nombre',
        codigo: servicio?.codigo_servicio ?? `SERV-${detalle.id_servicio}`,
        cantidad,
        precio_unitario: precioUnitario,
        descuento,
        total,
        oferta: Boolean(servicio?.oferta),
        permiteEditarDescuento: Boolean(servicio?.oferta),
        servicio_ref: undefined
      }
    }

    const producto = detalle.producto
    const cantidad = detalle.cantidad
    const precioUnitario = toNumber(detalle.precio_unitario ?? producto?.precio_venta ?? 0)
    const descuento = toNumber(detalle.descuento ?? producto?.descuento ?? 0)
    const total = calcularTotalLinea(cantidad, precioUnitario, descuento)

    return {
      id_referencia: detalle.id_producto ?? (producto?.id_producto ?? 0),
      tipo: 'producto',
      nombre: producto?.nombre ?? 'Producto sin nombre',
      codigo: producto?.codigo_producto ?? `PROD-${detalle.id_producto}`,
      cantidad,
      precio_unitario: precioUnitario,
      descuento,
      total,
      oferta: Boolean(producto?.oferta),
      permiteEditarDescuento: true,
      servicio_ref: detalle.servicio_ref ?? null
    }
  })
}

export function CotizacionWizard({ onSuccess, onCancel, cotizacion }: CotizacionWizardProps) {
  const isEditing = Boolean(cotizacion)
  const [currentStep, setCurrentStep] = useState<CotizacionStep>(isEditing ? 'items' : 'modo')
  const [loading, setLoading] = useState(false)
  const [modoCotizacion, setModoCotizacion] = useState<CotizacionModo | null>(
    isEditing && cotizacion ? inferirModoDesdeCotizacion(cotizacion) : null
  )

  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteCompleto | null>(null)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoCompleto | null>(null)
  const [items, setItems] = useState<ItemCotizacion[]>(
    isEditing && cotizacion ? mapearDetallesAItems(cotizacion) : []
  )
  const [vigenciaDias, setVigenciaDias] = useState(
    isEditing && cotizacion ? calcularVigenciaInicial(cotizacion) : 7
  )

  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoCompleto[]>([])
  const [productos, setProductos] = useState<ProductoCompleto[]>([])
  const [servicios, setServicios] = useState<ServicioCompleto[]>([])

  const { toast } = useToast()
  const edicionPermitida = !isEditing || cotizacion?.estado === 'borrador'
  const mostrarToastEdicionBloqueada = () => {
    toast({
      title: 'Edición no permitida',
      description: 'Solo puedes editar cotizaciones que estén en estado borrador.',
      variant: 'destructive'
    })
  }

  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientesRes, productosRes, serviciosRes] = await Promise.all([
          fetch('/api/clientes/activos'),
          fetch('/api/productos?estatus=activos'),
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

  useEffect(() => {
    if (!isEditing || edicionPermitida) return
    toast({
      title: 'Cotización no editable',
      description: 'Solo las cotizaciones en estado borrador pueden modificarse.',
      variant: 'destructive'
    })
  }, [isEditing, edicionPermitida, toast])

  useEffect(() => {
    if (!cotizacion) return
    setModoCotizacion(inferirModoDesdeCotizacion(cotizacion))
    setItems(mapearDetallesAItems(cotizacion))
    setVigenciaDias(calcularVigenciaInicial(cotizacion))
  }, [cotizacion])

  useEffect(() => {
    if (!clienteSeleccionado) {
      setVehiculos([])
      setVehiculoSeleccionado(null)
      return
    }

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
  }, [clienteSeleccionado])

  useEffect(() => {
    if (!cotizacion || clientes.length === 0 || clienteSeleccionado) return
    const encontrado = clientes.find((cliente) => cliente.id_cliente === cotizacion.id_cliente)
    if (encontrado) {
      setClienteSeleccionado(encontrado)
    }
  }, [cotizacion, clientes, clienteSeleccionado])

  useEffect(() => {
    if (!cotizacion || vehiculos.length === 0 || vehiculoSeleccionado) return
    const encontrado = vehiculos.find((vehiculo) => vehiculo.id_vehiculo === cotizacion.id_vehiculo)
    if (encontrado) {
      setVehiculoSeleccionado(encontrado)
    }
  }, [cotizacion, vehiculos, vehiculoSeleccionado])

  useEffect(() => {
    if (!modoCotizacion) return

    setItems((prevItems) => {
      const filtrados = prevItems.filter((item) => {
        if (modoCotizacion === 'solo_servicios') return item.tipo === 'servicio'
        if (modoCotizacion === 'solo_productos') return item.tipo === 'producto'
        return true
      })

      let cambios = filtrados.length !== prevItems.length
      const ajustados = filtrados.map((item) => {
        if (modoCotizacion === 'solo_productos' && item.tipo === 'producto' && item.servicio_ref) {
          cambios = true
          return { ...item, servicio_ref: null }
        }
        return item
      })

      if (cambios) {
        toast({
          title: 'Modo actualizado',
          description: 'Se ajustaron los ítems para coincidir con el modo seleccionado.'
        })
      }

      return ajustados
    })
  }, [modoCotizacion, toast])

  const totales = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const impuesto = subtotal * 0.18
    return { subtotal, impuesto, total: subtotal + impuesto }
  }, [items])

  const resumenTiempo = useMemo(() => calcularResumenTiempo(items, servicios), [items, servicios])
  const fechasEstimadas = useMemo(
    () => calcularEstimacion(resumenTiempo.totalMin, resumenTiempo.totalMax),
    [resumenTiempo.totalMin, resumenTiempo.totalMax]
  )

  const canProceed = () => {
    switch (currentStep) {
      case 'modo':
        return modoCotizacion !== null
      case 'cliente':
        return clienteSeleccionado !== null
      case 'vehiculo':
        return vehiculoSeleccionado !== null
      case 'items':
        return items.length > 0
      case 'resumen':
        return true
    }
  }

  const nextStep = () => {
    const nextIndex = Math.min(currentStepIndex + 1, STEPS.length - 1)
    setCurrentStep(STEPS[nextIndex].id)
  }

  const prevStep = () => {
    const prevIndex = Math.max(currentStepIndex - 1, 0)
    setCurrentStep(STEPS[prevIndex].id)
  }

  const agregarItem = (elemento: CatalogoItem) => {
    if (!edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }

    if (modoCotizacion === 'solo_servicios' && elemento.tipo === 'producto') {
      toast({
        title: 'Modo solo servicios',
        description: 'No puedes agregar productos cuando la cotización es solo de servicios.',
        variant: 'destructive'
      })
      return
    }

    if (modoCotizacion === 'solo_productos' && elemento.tipo === 'servicio') {
      toast({
        title: 'Modo solo productos',
        description: 'No puedes agregar servicios cuando la cotización es solo de productos.',
        variant: 'destructive'
      })
      return
    }

    const isProducto = elemento.tipo === 'producto'
    const idReferencia = isProducto ? elemento.producto.id_producto : elemento.servicio.id_servicio
    const nombre = isProducto ? elemento.producto.nombre : elemento.servicio.nombre
    const codigo = isProducto ? elemento.producto.codigo_producto : elemento.servicio.codigo_servicio
    const precioBase = isProducto ? toNumber(elemento.producto.precio_venta) : toNumber(elemento.servicio.precio_base)
    const descuentoBase = isProducto
      ? toNumber(elemento.producto.descuento)
      : elemento.servicio.oferta
        ? toNumber(elemento.servicio.descuento)
        : 0
    const ofertaActiva = isProducto ? Boolean(elemento.producto.oferta) : Boolean(elemento.servicio.oferta)
    const permiteEditarDescuento = isProducto ? true : ofertaActiva

    const existingIndex = items.findIndex(
      (item) => item.id_referencia === idReferencia && item.tipo === (isProducto ? 'producto' : 'servicio')
    )

    if (existingIndex >= 0) {
      const nuevos = [...items]
      const itemActual = { ...nuevos[existingIndex] }
      itemActual.cantidad += 1
      itemActual.total = calcularTotalLinea(itemActual.cantidad, itemActual.precio_unitario, itemActual.descuento)
      nuevos[existingIndex] = itemActual
      setItems(nuevos)
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
      permiteEditarDescuento,
      servicio_ref: isProducto ? null : undefined
    }

    setItems((prev) => [...prev, nuevoItem])
  }

  const actualizarItem = (
    index: number,
    campo: keyof Pick<ItemCotizacion, 'cantidad' | 'precio_unitario' | 'descuento' | 'servicio_ref'>,
    valor: unknown
  ) => {
    if (!edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }

    setItems((prev) => {
      const nuevos = [...prev]
      const item = { ...nuevos[index] }

      if (campo === 'cantidad') {
        const nuevaCantidad = parseInt(String(valor), 10)
        item.cantidad = Number.isFinite(nuevaCantidad) && nuevaCantidad > 0 ? nuevaCantidad : 1
      } else if (campo === 'precio_unitario') {
        const nuevoPrecio = parseFloat(String(valor))
        item.precio_unitario = Number.isFinite(nuevoPrecio) && nuevoPrecio >= 0 ? nuevoPrecio : 0
      } else if (campo === 'descuento') {
        if (!item.permiteEditarDescuento) return prev
        const nuevoDescuento = parseFloat(String(valor))
        item.descuento = Number.isFinite(nuevoDescuento) ? Math.min(Math.max(nuevoDescuento, 0), 100) : 0
      } else if (campo === 'servicio_ref') {
        if (item.tipo !== 'producto') return prev
        if (valor === null) {
          item.servicio_ref = null
        } else {
          const idServicio = typeof valor === 'number' ? valor : parseInt(String(valor), 10)
          item.servicio_ref = Number.isFinite(idServicio) ? idServicio : null
        }
      }

      item.total = calcularTotalLinea(item.cantidad, item.precio_unitario, item.descuento)
      nuevos[index] = item
      return nuevos
    })
  }

  const eliminarItem = (index: number) => {
    if (!edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }

    setItems((prev) => {
      const objetivo = prev[index]
      const filtrados = prev.filter((_, i) => i !== index)
      if (!objetivo || objetivo.tipo !== 'servicio') return filtrados
      return filtrados.map((item) =>
        item.tipo === 'producto' && item.servicio_ref === objetivo.id_referencia
          ? { ...item, servicio_ref: null }
          : item
      )
    })
  }

  const handleModoChange = (modo: CotizacionModo) => {
    if (!edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }
    setModoCotizacion(modo)
  }

  const handleSeleccionCliente = (cliente: ClienteCompleto) => {
    if (isEditing && !edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }
    setClienteSeleccionado(cliente)
  }

  const handleSeleccionVehiculo = (vehiculo: VehiculoCompleto) => {
    if (isEditing && !edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }
    setVehiculoSeleccionado(vehiculo)
  }

  const submitCotizacion = async () => {
    if (!edicionPermitida) {
      mostrarToastEdicionBloqueada()
      return
    }

    if (!clienteSeleccionado || !vehiculoSeleccionado || items.length === 0) {
      toast({
        title: 'Error',
        description: isEditing
          ? 'Faltan datos requeridos para actualizar la cotización.'
          : 'Faltan datos requeridos para crear la cotización.',
        variant: 'destructive'
      })
      return
    }

    if (!modoCotizacion) {
      toast({
        title: 'Selecciona el tipo de cotización',
        description: 'Indica si la cotización es de productos, servicios o ambos antes de continuar.',
        variant: 'destructive'
      })
      return
    }

    if (modoCotizacion === 'solo_servicios' && items.some((item) => item.tipo === 'producto')) {
      toast({
        title: 'Modo solo servicios',
        description: 'Esta cotización solo permite servicios. Elimina los productos para continuar.',
        variant: 'destructive'
      })
      return
    }

    if (modoCotizacion === 'solo_productos' && items.some((item) => item.tipo === 'servicio')) {
      toast({
        title: 'Modo solo productos',
        description: 'Esta cotización solo permite productos. Elimina los servicios para continuar.',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        id_cliente: clienteSeleccionado.id_cliente,
        id_vehiculo: vehiculoSeleccionado.id_vehiculo,
        vigencia_dias: vigenciaDias,
        modo_cotizacion: modoCotizacion,
        items: items.map((item) => {
          // Asegurar tipos y valores válidos para Zod
          return {
            id_producto: Number.isFinite(item.id_referencia) ? Number(item.id_referencia) : 0,
            cantidad: Number.isFinite(item.cantidad) && item.cantidad > 0 ? Number(item.cantidad) : 1,
            precio_unitario: Number.isFinite(item.precio_unitario) && item.precio_unitario >= 0 ? Number(item.precio_unitario) : 0,
            descuento: Number.isFinite(item.descuento) && item.descuento >= 0 ? Number(item.descuento) : 0,
            tipo: item.tipo === 'servicio' ? 'servicio' : 'producto',
            servicio_ref: item.tipo === 'producto' && item.servicio_ref ? Number(item.servicio_ref) : null
          }
        })
      }

      const endpoint = isEditing && cotizacion
        ? `/api/cotizaciones/${cotizacion.id_cotizacion}`
        : '/api/cotizaciones'
      const method = isEditing ? 'PATCH' : 'POST'
      const body = isEditing
        ? JSON.stringify({ action: 'actualizar', payload })
        : JSON.stringify(payload)

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || (isEditing ? 'Error al actualizar cotización' : 'Error al crear cotización'))
      }

      const result = await response.json()
      toast({
        title: isEditing ? 'Cotización actualizada' : 'Cotización creada exitosamente',
        description: isEditing
          ? `Cotización ${result.codigo_cotizacion} actualizada correctamente.`
          : `Cotización ${result.codigo_cotizacion} creada para ${clienteSeleccionado.persona.nombre}`
      })
      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : isEditing
              ? 'Ocurrió un error al actualizar la cotización'
              : 'Ocurrió un error al crear la cotización',
        variant: 'destructive'
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
            <CardTitle>{isEditing ? 'Editar Cotización' : 'Nueva Cotización'}</CardTitle>
            <CardDescription>
              {isEditing
                ? edicionPermitida
                  ? 'Actualiza los detalles de la cotización antes de enviarla al cliente.'
                  : 'Esta cotización no está en estado borrador, por lo que no se pueden realizar cambios.'
                : 'Crea una cotización para mostrar al cliente.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">Paso {currentStepIndex + 1} de {STEPS.length}</div>
            <div className="w-32">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-12 h-px mx-2 ${isCompleted ? 'bg-green-300' : 'bg-gray-300'}`} />
                )}
              </div>
            )
          })}
        </div>
      </CardHeader>

      <CardContent>
  {currentStep === 'modo' && <ModoStep modoActual={modoCotizacion} onChange={handleModoChange} />}

        {currentStep === 'cliente' && (
          <ClienteStep
            clientes={clientes}
            clienteSeleccionado={clienteSeleccionado}
            onSelect={handleSeleccionCliente}
          />
        )}

        {currentStep === 'vehiculo' && (
          <VehiculoStep
            clienteSeleccionado={clienteSeleccionado}
            vehiculos={vehiculos}
            vehiculoSeleccionado={vehiculoSeleccionado}
            onSelect={handleSeleccionVehiculo}
          />
        )}

        {currentStep === 'items' && (
          <ItemsStep
            modo={modoCotizacion ?? 'servicios_y_productos'}
            servicios={servicios}
            productos={productos}
            items={items}
            totales={totales}
            onAgregar={agregarItem}
            onActualizar={actualizarItem}
            onEliminar={eliminarItem}
          />
        )}

        {currentStep === 'resumen' && (
          <ResumenStep
            clienteSeleccionado={clienteSeleccionado}
            vehiculoSeleccionado={vehiculoSeleccionado}
            items={items}
            servicios={servicios}
            vigenciaDias={vigenciaDias}
            onChangeVigencia={setVigenciaDias}
            totales={totales}
            resumenTiempo={resumenTiempo}
            estimacionFechas={fechasEstimadas}
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
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>

            {currentStep === 'resumen' ? (
              <Button onClick={submitCotizacion} disabled={loading || !canProceed() || !edicionPermitida}>
                {loading
                  ? isEditing
                    ? 'Guardando cambios...'
                    : 'Creando Cotización...'
                  : isEditing
                    ? 'Guardar cambios'
                    : 'Crear Cotización'}
              </Button>
            ) : (
              <Button onClick={nextStep} disabled={!canProceed() || !edicionPermitida}>
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