'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea' // ✅ Agregar import:
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { VehiculoFormData, VehiculoCompleto, ClienteCompleto, MarcaCompleta, ModeloCompleto } from '@/types'
import { MarcasModelosManager } from './marcas-modelos-manager' // ✅ Agregar import:
import { useToast } from '@/components/ui/use-toast'

interface VehiculoFormProps {
  vehiculo?: VehiculoCompleto
  onSuccess: () => void
  onCancel: () => void
}

export function VehiculoForm({ vehiculo, onSuccess, onCancel }: VehiculoFormProps) {
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [marcas, setMarcas] = useState<MarcaCompleta[]>([])
  const [modelos, setModelos] = useState<ModeloCompleto[]>([])
  const [selectedMarca, setSelectedMarca] = useState<string>('')
  const [showMarcasManager, setShowMarcasManager] = useState(false) // ✅ Nuevo estado
  
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<VehiculoFormData>({
    defaultValues: vehiculo ? {
      id_cliente: vehiculo.id_cliente,
      id_modelo: vehiculo.id_modelo,
      placa: vehiculo.placa,
      tipo: vehiculo.tipo,
      año: vehiculo.año,
      tipo_combustible: vehiculo.tipo_combustible,
      transmision: vehiculo.transmision,
      numero_chasis: vehiculo.numero_chasis || '',
      numero_motor: vehiculo.numero_motor || '',
      observaciones: vehiculo.observaciones || ''
    } : {
      año: new Date().getFullYear()
    }
  })

  const fetchData = async () => {
    try {
      // Cargar clientes activos
      const clientesResponse = await fetch('/api/clientes/activos')
      const clientesData = await clientesResponse.json()
      setClientes(clientesData.clientes || [])

      // Cargar marcas
      const marcasResponse = await fetch('/api/marcas')
      const marcasData = await marcasResponse.json()
      setMarcas(marcasData.marcas || [])

      // Si estamos editando, cargar modelos de la marca seleccionada
      if (vehiculo) {
        setSelectedMarca(vehiculo.modelo.id_marca.toString())
        const modelosResponse = await fetch(`/api/modelos?marca_id=${vehiculo.modelo.id_marca}`)
        const modelosData = await modelosResponse.json()
        setModelos(modelosData.modelos || [])
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast({
        title: "Error",
        description: "Error al cargar los datos del formulario",
        variant: "destructive",
      })
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    fetchData()
  }, [vehiculo, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar modelos cuando cambia la marca
  useEffect(() => {
    if (selectedMarca) {
      const fetchModelos = async () => {
        try {
          const response = await fetch(`/api/modelos?marca_id=${selectedMarca}`)
          const data = await response.json()
          setModelos(data.modelos || [])
          
          // Limpiar modelo seleccionado si no estamos editando
          if (!vehiculo) {
            setValue('id_modelo', 0)
          }
        } catch (error) {
          console.error('Error cargando modelos:', error)
        }
      }
      fetchModelos()
    } else {
      setModelos([])
    }
  }, [selectedMarca, vehiculo, setValue])

  const onSubmit = async (data: VehiculoFormData) => {
    try {
      setLoading(true)

      const url = vehiculo 
        ? `/api/vehiculos/${vehiculo.id_vehiculo}`
        : '/api/vehiculos'
      
      const method = vehiculo ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar vehículo')
      }

      const result = await response.json()

      toast({
        title: vehiculo ? "Vehículo actualizado" : "Vehículo creado",
        description: `${data.placa} - ${result.modelo.marca.nombre_marca} ${result.modelo.nombre_modelo} ha sido ${vehiculo ? 'actualizado' : 'creado'} correctamente`,
      })

      onSuccess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar vehículo'
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ✅ Función para refrescar datos cuando se cierre el manager
  const handleMarcasManagerClose = () => {
    setShowMarcasManager(false)
    // Recargar marcas y modelos
    fetchData()
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {vehiculo ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        </CardTitle>
        <CardDescription>
          {vehiculo 
            ? 'Modifica la información del vehículo'
            : 'Completa los datos para registrar un nuevo vehículo'
          }
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información del Propietario */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Propietario del Vehículo</h3>
            
            <div>
              <Label htmlFor="id_cliente">Cliente *</Label>
              <Select 
                onValueChange={(value) => setValue('id_cliente', parseInt(value))} 
                defaultValue={vehiculo?.id_cliente.toString() || ''}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id_cliente} value={cliente.id_cliente.toString()}>
                      {cliente.persona.nombre} {cliente.persona.apellido_paterno} - {cliente.persona.numero_documento}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.id_cliente && (
                <p className="text-red-500 text-sm mt-1">Selecciona un cliente</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Información del Vehículo */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Información del Vehículo</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="placa">Placa *</Label>
                <Input
                  id="placa"
                  {...register('placa', { 
                    required: 'La placa es requerida',
                    minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                    maxLength: { value: 10, message: 'Máximo 10 caracteres' }
                  })}
                  placeholder="ABC-123"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase()
                    setValue('placa', e.target.value)
                  }}
                />
                {errors.placa && (
                  <p className="text-red-500 text-sm mt-1">{errors.placa.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tipo">Tipo de Vehículo *</Label>
                <Select onValueChange={(value) => setValue('tipo', value)} defaultValue={vehiculo?.tipo || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Automóvil">Automóvil</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Camioneta">Camioneta</SelectItem>
                    <SelectItem value="Motocicleta">Motocicleta</SelectItem>
                    <SelectItem value="Camión">Camión</SelectItem>
                    <SelectItem value="Bus">Bus</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un tipo</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="marca">Marca *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMarcasManager(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Gestionar
                  </Button>
                </div>
                <Select onValueChange={setSelectedMarca} value={selectedMarca} defaultValue={vehiculo?.modelo.id_marca.toString() || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {marcas.map((marca) => (
                      <SelectItem key={marca.id_marca} value={marca.id_marca.toString()}>
                        {marca.nombre_marca}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="id_modelo">Modelo *</Label>
                <Select 
                  onValueChange={(value) => setValue('id_modelo', parseInt(value))} 
                  defaultValue={vehiculo?.id_modelo.toString() || ''}
                  disabled={!selectedMarca}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedMarca ? "Seleccionar modelo" : "Primero selecciona una marca"} />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((modelo) => (
                      <SelectItem key={modelo.id_modelo} value={modelo.id_modelo.toString()}>
                        {modelo.nombre_modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.id_modelo && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un modelo</p>
                )}
              </div>

              <div>
                <Label htmlFor="año">Año *</Label>
                <Input
                  id="año"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  {...register('año', { 
                    required: 'El año es requerido',
                    min: { value: 1900, message: 'Año mínimo: 1900' },
                    max: { value: new Date().getFullYear() + 1, message: `Año máximo: ${new Date().getFullYear() + 1}` }
                  })}
                  placeholder="2024"
                />
                {errors.año && (
                  <p className="text-red-500 text-sm mt-1">{errors.año.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tipo_combustible">Tipo de Combustible *</Label>
                <Select onValueChange={(value) => setValue('tipo_combustible', value)} defaultValue={vehiculo?.tipo_combustible || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar combustible" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="GLP">GLP (Gas)</SelectItem>
                    <SelectItem value="GNV">GNV</SelectItem>
                    <SelectItem value="Híbrido">Híbrido</SelectItem>
                    <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo_combustible && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un tipo de combustible</p>
                )}
              </div>

              <div>
                <Label htmlFor="transmision">Transmisión *</Label>
                <Select onValueChange={(value) => setValue('transmision', value)} defaultValue={vehiculo?.transmision || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar transmisión" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Automática">Automática</SelectItem>
                    <SelectItem value="Semi-automática">Semi-automática</SelectItem>
                    <SelectItem value="CVT">CVT</SelectItem>
                  </SelectContent>
                </Select>
                {errors.transmision && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un tipo de transmisión</p>
                )}
              </div>

              <div>
                <Label htmlFor="numero_motor">Número de Motor</Label>
                <Input
                  id="numero_motor"
                  {...register('numero_motor')}
                  placeholder="Número del motor (opcional)"
                />
              </div>

              <div>
                <Label htmlFor="numero_chasis">Número de Chasis</Label>
                <Input
                  id="numero_chasis"
                  {...register('numero_chasis')}
                  placeholder="Número del chasis (opcional)"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  {...register('observaciones')}
                  placeholder="Información adicional sobre el vehículo..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading 
                ? (vehiculo ? 'Actualizando...' : 'Creando...') 
                : (vehiculo ? 'Actualizar Vehículo' : 'Crear Vehículo')
              }
            </Button>
          </div>
        </form>
      </CardContent>

      {/* Modal de gestión de marcas */}
      <Dialog open={showMarcasManager} onOpenChange={setShowMarcasManager}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Gestión de Marcas y Modelos</DialogTitle>
          </DialogHeader>
          <MarcasModelosManager onClose={handleMarcasManagerClose} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}