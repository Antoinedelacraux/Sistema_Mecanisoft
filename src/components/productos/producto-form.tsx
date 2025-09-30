'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProductoFormData, ProductoCompleto, CategoriaCompleta, FabricanteCompleto, UnidadCompleta } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface ProductoFormProps {
  producto?: ProductoCompleto
  onSuccess: () => void
  onCancel: () => void
}

export function ProductoForm({ producto, onSuccess, onCancel }: ProductoFormProps) {
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaCompleta[]>([])
  const [fabricantes, setFabricantes] = useState<FabricanteCompleto[]>([])
  const [unidades, setUnidades] = useState<UnidadCompleta[]>([])
  
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<ProductoFormData>({
    defaultValues: producto ? {
      id_categoria: producto.id_categoria,
      id_fabricante: producto.id_fabricante,
      id_unidad: producto.id_unidad,
      tipo: producto.tipo,
      codigo_producto: producto.codigo_producto,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      stock: producto.stock,
      stock_minimo: producto.stock_minimo,
      precio_compra: producto.precio_compra,
      precio_venta: producto.precio_venta,
      descuento: producto.descuento,
      oferta: producto.oferta
    } : {
      stock: 0,
      stock_minimo: 0,
      precio_compra: 0,
      precio_venta: 0,
      descuento: 0,
      oferta: false
    }
  })

  const tipoProducto = watch('tipo')
  const precioCompra = watch('precio_compra')
  const precioVenta = watch('precio_venta')

  // Cargar datos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriasRes, fabricantesRes, unidadesRes] = await Promise.all([
          fetch('/api/categorias'),
          fetch('/api/fabricantes'),
          fetch('/api/unidades')
        ])

        const [categoriasData, fabricantesData, unidadesData] = await Promise.all([
          categoriasRes.json(),
          fabricantesRes.json(),
          unidadesRes.json()
        ])

        setCategorias(categoriasData.categorias || [])
        setFabricantes(fabricantesData.fabricantes || [])
        setUnidades(unidadesData.unidades || [])
      } catch (error) {
        console.error('Error cargando datos:', error)
        toast({
          title: "Error",
          description: "Error al cargar los datos del formulario",
          variant: "destructive",
        })
      }
    }

    fetchData()
  }, [toast])

  const onSubmit = async (data: ProductoFormData) => {
    try {
      setLoading(true)

      const url = producto 
        ? `/api/productos/${producto.id_producto}`
        : '/api/productos'
      
      const method = producto ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar producto')
      }

      const result = await response.json()

      toast({
        title: producto ? "Producto actualizado" : "Producto creado",
        description: `${data.codigo_producto} - ${data.nombre} ha sido ${producto ? 'actualizado' : 'creado'} correctamente`,
      })

      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Calcular margen de ganancia
  const calcularMargen = () => {
    if (precioCompra && precioVenta) {
      const margen = ((precioVenta - precioCompra) / precioCompra) * 100
      return margen.toFixed(2)
    }
    return '0.00'
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {producto ? 'Editar Producto' : 'Nuevo Producto'}
        </CardTitle>
        <CardDescription>
          {producto 
            ? 'Modifica la información del producto'
            : 'Completa los datos para registrar un nuevo producto o servicio'
          }
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información Básica */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Información Básica</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select onValueChange={(value) => setValue('tipo', value)} defaultValue={producto?.tipo || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producto">Producto Físico</SelectItem>
                    <SelectItem value="servicio">Servicio</SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un tipo</p>
                )}
              </div>

              <div>
                <Label htmlFor="codigo_producto">Código del Producto *</Label>
                <Input
                  id="codigo_producto"
                  {...register('codigo_producto', { 
                    required: 'El código es requerido',
                    minLength: { value: 3, message: 'Mínimo 3 caracteres' }
                  })}
                  placeholder="Ej: PROD-001"
                  style={{ textTransform: 'uppercase' }}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase()
                    setValue('codigo_producto', e.target.value)
                  }}
                />
                {errors.codigo_producto && (
                  <p className="text-red-500 text-sm mt-1">{errors.codigo_producto.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="nombre">Nombre del Producto *</Label>
                <Input
                  id="nombre"
                  {...register('nombre', { 
                    required: 'El nombre es requerido',
                    minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                  })}
                  placeholder="Nombre descriptivo del producto"
                />
                {errors.nombre && (
                  <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  {...register('descripcion')}
                  placeholder="Descripción detallada del producto..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Clasificación */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Clasificación</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="id_categoria">Categoría *</Label>
                <Select 
                  onValueChange={(value) => setValue('id_categoria', parseInt(value))} 
                  defaultValue={producto?.id_categoria.toString() || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id_categoria} value={categoria.id_categoria.toString()}>
                        {categoria.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.id_categoria && (
                  <p className="text-red-500 text-sm mt-1">Selecciona una categoría</p>
                )}
              </div>

              <div>
                <Label htmlFor="id_fabricante">Fabricante *</Label>
                <Select 
                  onValueChange={(value) => setValue('id_fabricante', parseInt(value))} 
                  defaultValue={producto?.id_fabricante.toString() || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    {fabricantes.map((fabricante) => (
                      <SelectItem key={fabricante.id_fabricante} value={fabricante.id_fabricante.toString()}>
                        {fabricante.nombre_fabricante}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.id_fabricante && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un fabricante</p>
                )}
              </div>

              <div>
                <Label htmlFor="id_unidad">Unidad de Medida *</Label>
                <Select 
                  onValueChange={(value) => setValue('id_unidad', parseInt(value))} 
                  defaultValue={producto?.id_unidad.toString() || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((unidad) => (
                      <SelectItem key={unidad.id_unidad} value={unidad.id_unidad.toString()}>
                        {unidad.nombre_unidad} ({unidad.abreviatura})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.id_unidad && (
                  <p className="text-red-500 text-sm mt-1">Selecciona una unidad</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Inventario - Solo para productos físicos */}
          {tipoProducto === 'producto' && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4">Control de Inventario</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stock">Stock Actual *</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      {...register('stock', { 
                        required: 'El stock es requerido',
                        min: { value: 0, message: 'El stock no puede ser negativo' }
                      })}
                      placeholder="0"
                    />
                    {errors.stock && (
                      <p className="text-red-500 text-sm mt-1">{errors.stock.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="stock_minimo">Stock Mínimo *</Label>
                    <Input
                      id="stock_minimo"
                      type="number"
                      min="0"
                      {...register('stock_minimo', { 
                        required: 'El stock mínimo es requerido',
                        min: { value: 0, message: 'El stock mínimo no puede ser negativo' }
                      })}
                      placeholder="0"
                    />
                    {errors.stock_minimo && (
                      <p className="text-red-500 text-sm mt-1">{errors.stock_minimo.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Precios */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Precios</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="precio_compra">Precio de Compra *</Label>
                <Input
                  id="precio_compra"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('precio_compra', { 
                    required: 'El precio de compra es requerido',
                    min: { value: 0, message: 'El precio no puede ser negativo' }
                  })}
                  placeholder="0.00"
                />
                {errors.precio_compra && (
                  <p className="text-red-500 text-sm mt-1">{errors.precio_compra.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="precio_venta">Precio de Venta *</Label>
                <Input
                  id="precio_venta"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('precio_venta', { 
                    required: 'El precio de venta es requerido',
                    min: { value: 0, message: 'El precio no puede ser negativo' }
                  })}
                  placeholder="0.00"
                />
                {errors.precio_venta && (
                  <p className="text-red-500 text-sm mt-1">{errors.precio_venta.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="descuento">Descuento (%)</Label>
                <Input
                  id="descuento"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('descuento', { 
                    min: { value: 0, message: 'El descuento no puede ser negativo' },
                    max: { value: 100, message: 'El descuento no puede ser mayor a 100%' }
                  })}
                  placeholder="0.00"
                />
                {errors.descuento && (
                  <p className="text-red-500 text-sm mt-1">{errors.descuento.message}</p>
                )}
              </div>
            </div>

            {/* Información de margen */}
            {precioCompra > 0 && precioVenta > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Margen de Ganancia:</strong> {calcularMargen()}%
                  <span className="ml-4">
                    <strong>Ganancia por unidad:</strong> S/ {(precioVenta - precioCompra).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Configuraciones adicionales */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Configuraciones</h3>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="oferta"
                  checked={watch('oferta') || false}
                  onCheckedChange={(checked) => setValue('oferta', checked)}
                />
                <Label htmlFor="oferta">Producto en Oferta</Label>
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
                ? (producto ? 'Actualizando...' : 'Creando...') 
                : (producto ? 'Actualizar Producto' : 'Crear Producto')
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}