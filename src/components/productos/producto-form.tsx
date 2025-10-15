'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, Image } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import CompraRapidaForm from '@/components/inventario/basico/compra-rapida-form'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(producto?.foto || '')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [inventarioCostoPromedio, setInventarioCostoPromedio] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCompraSheetOpen, setCompraSheetOpen] = useState(false)
  const [compraInitialLines, setCompraInitialLines] = useState<any[] | undefined>(undefined)

  const { toast } = useToast()

  // Schema de validación
  const schema = z.object({
    id_categoria: z.number().int().positive(),
    id_fabricante: z.number().int().positive(),
    id_unidad: z.number().int().positive(),
    codigo_producto: z.string().max(50).optional(),
    nombre: z.string().min(1).max(120),
    descripcion: z.string().max(500).optional(),
    // stock inicial ya no es requerido: se registra vía entrada de inventario
    stock: z.number().min(0).optional(),
    stock_minimo: z.number().min(0),
    precio_compra: z.number().min(0),
    precio_venta: z.number().min(0),
    descuento: z.number().min(0).max(100).optional(),
    oferta: z.boolean().optional()
  }).superRefine((data, ctx) => {
    if (producto && !data.codigo_producto) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El código es obligatorio para productos existentes', path: ['codigo_producto'] })
    }
  })
  type SchemaType = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<SchemaType>({
    resolver: zodResolver(schema),
    defaultValues: producto ? {
      id_categoria: producto.id_categoria,
      id_fabricante: producto.id_fabricante,
      id_unidad: producto.id_unidad,
      codigo_producto: producto.codigo_producto,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      stock: Number(producto.stock),
      stock_minimo: Number(producto.stock_minimo),
      precio_compra: Number(producto.precio_compra),
      precio_venta: Number(producto.precio_venta),
      descuento: Number(producto.descuento) || 0,
      oferta: Boolean(producto.oferta)
    } : {
      id_categoria: undefined as unknown as number,
      id_fabricante: undefined as unknown as number,
      id_unidad: undefined as unknown as number,
      codigo_producto: undefined,
      nombre: '',
      descripcion: '',
      // no definimos stock aquí; el stock inicial debe registrarse mediante una entrada de inventario
      stock_minimo: 1,
      precio_compra: 0,
      precio_venta: 0,
      descuento: 0,
      oferta: false
    }
  })

  const precioCompra = watch('precio_compra')
  const precioVenta = watch('precio_venta')

  // Cargar datos para selects
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriasRes, fabricantesRes, unidadesRes] = await Promise.all([
          fetch('/api/categorias'),
          fetch('/api/fabricantes'),
          fetch('/api/unidades')
        ])

        if (!categoriasRes.ok || !fabricantesRes.ok || !unidadesRes.ok) {
          throw new Error('Error al cargar datos de selección')
        }

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
          title: "Error de Carga",
          description: "No se pudieron cargar los datos para el formulario.",
          variant: "destructive",
        })
      }
    }

    fetchData()
  }, [toast])

  // fetch inventario costo_promedio for margen calculation
  useEffect(() => {
    let mounted = true
    const fetchStock = async () => {
      if (!producto) return
      try {
        const res = await fetch(`/api/inventario/stock/${producto.id_producto}`)
        if (!res.ok) return
        const data = await res.json()
        if (!mounted) return
        setInventarioCostoPromedio(data.inventario?.costo_promedio ?? null)
      } catch (e) {
        // ignore - fallback will use producto.precio_compra
      }
    }

    fetchStock()
    return () => { mounted = false }
  }, [producto])

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Tipo de archivo no válido", description: "Solo se permiten archivos JPG, PNG o WEBP", variant: "destructive" })
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast({ title: "Archivo muy grande", description: "El tamaño máximo permitido es 5MB", variant: "destructive" })
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error subiendo imagen')
      }
      const data = await response.json()
      return data.imageUrl
    } finally {
      setUploadingImage(false)
    }
  }

  const onSubmit = async (formData: SchemaType) => {
    setLoading(true)
    try {
      let imageUrl = producto?.foto || imagePreview

      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }

      const finalData: ProductoFormData = { 
        id_categoria: formData.id_categoria,
        id_fabricante: formData.id_fabricante,
        id_unidad: formData.id_unidad,
  tipo: (producto?.tipo ?? 'producto') as ProductoFormData['tipo'],
        codigo_producto: formData.codigo_producto,
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        stock_minimo: formData.stock_minimo,
        precio_compra: formData.precio_compra,
        precio_venta: formData.precio_venta,
        descuento: formData.descuento || 0,
        oferta: formData.oferta || false,
        foto: imageUrl
      };

      const endpoint = producto ? `/api/productos/${producto.id_producto}` : '/api/productos';
      const method = producto ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar el producto');
      }

      const created = await response.json().catch(() => null)

      toast({
        title: producto ? "Producto actualizado" : "Producto creado",
        description: `${formData.nombre} ha sido ${producto ? 'actualizado' : 'creado'} correctamente`,
      })

      if (!producto && created) {
        // Nuevo producto creado: abrir sheet de compra rápida con producto preseleccionado
        const option = {
          producto: {
            id_producto: created.id_producto,
            nombre: created.nombre,
            codigo_producto: created.codigo_producto,
            unidad: created.unidad_medida?.nombre_unidad ?? '',
            stock_disponible: '0',
            stock_comprometido: '0',
            costo_promedio: '0'
          },
          cantidad: '0',
          precio_unitario: '0'
        }
        setCompraInitialLines([option])
        setCompraSheetOpen(true)
        return
      }

      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calcularMargen = () => {
    const costo = inventarioCostoPromedio ? Number.parseFloat(inventarioCostoPromedio) : precioCompra
    if (costo > 0 && precioVenta > 0) {
      const margen = ((precioVenta - costo) / costo) * 100
      return margen.toFixed(2)
    }
    return '0.00'
  }

  const handleSyncPrecioCompra = useCallback(async () => {
    if (!producto) return
    if (!confirm('¿Actualizar precio de compra del producto con el costo promedio del inventario?')) return
    try {
      const res = await fetch(`/api/productos/${producto.id_producto}/usar-costo-promedio`, { method: 'PATCH' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'No se pudo sincronizar')
      }
      const body = await res.json()
      setValue('precio_compra', Number(body.precio_compra))
      setInventarioCostoPromedio(body.precio_compra?.toString() ?? inventarioCostoPromedio)
      toast({ title: 'Precio sincronizado', description: 'El precio de compra fue actualizado con el costo promedio.' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'destructive' })
    }
  }, [producto, setValue, toast, inventarioCostoPromedio])

  return (
    <Card className="w-full max-w-7xl mx-auto">
      <CardHeader>
        <CardTitle>{producto ? 'Editar Producto' : 'Nuevo Producto'}</CardTitle>
        <CardDescription>
          {producto ? 'Modifica la información del producto' : 'Completa los datos para registrar un nuevo producto'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Sección básica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <Label>Código *</Label>
              <Input
                placeholder={producto ? 'COD-001' : 'Se generará automáticamente'}
                readOnly={!producto}
                disabled={!producto}
                {...register('codigo_producto')}
              />
              {errors.codigo_producto && <p className="text-sm text-red-600">{errors.codigo_producto.message}</p>}
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Nombre *</Label>
              <Input placeholder="Nombre del producto" {...register('nombre')} />
              {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
            </div>
          </div>

          {/* Clasificación */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <Label>Categoría *</Label>
              <Select value={watch('id_categoria')?.toString() || ''} onValueChange={(v) => setValue('id_categoria', parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id_categoria} value={cat.id_categoria.toString()}>{cat.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.id_categoria && <p className="text-sm text-red-600">Seleccione una categoría</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Fabricante *</Label>
              <Select value={watch('id_fabricante')?.toString() || ''} onValueChange={(v) => setValue('id_fabricante', parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {fabricantes.map(f => (
                    <SelectItem key={f.id_fabricante} value={f.id_fabricante.toString()}>{f.nombre_fabricante}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.id_fabricante && <p className="text-sm text-red-600">Seleccione un fabricante</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Unidad *</Label>
              <Select value={watch('id_unidad')?.toString() || ''} onValueChange={(v) => setValue('id_unidad', parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map(u => (
                    <SelectItem key={u.id_unidad} value={u.id_unidad.toString()}>{u.nombre_unidad} ({u.abreviatura})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.id_unidad && <p className="text-sm text-red-600">Seleccione una unidad</p>}
            </div>
          </div>

          {/* Descripción */}
            <div className="flex flex-col gap-2">
              <Label>Descripción</Label>
              <Textarea rows={4} placeholder="Descripción breve" {...register('descripcion')} />
            </div>

          {/* Inventario (producto) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <Label>Stock Inicial</Label>
              <div className="text-sm text-gray-600">El stock inicial no se asigna directamente al crear el producto. Registra una entrada de inventario para definir la cantidad inicial y mantener el historial de movimientos.</div>
              <div className="mt-2">
                    <div className="flex gap-2 items-center">
                      <button type="button" className="text-sm text-primary underline" onClick={() => { setCompraInitialLines([{ producto: { id_producto: producto?.id_producto ?? 0, nombre: producto?.nombre ?? '', codigo_producto: producto?.codigo_producto ?? '', unidad: producto?.unidad_medida?.nombre_unidad ?? '', stock_disponible: '0', stock_comprometido: '0', costo_promedio: '0' }, cantidad: '1', precio_unitario: (watch('precio_compra') ?? 0).toString() }]); setCompraSheetOpen(true); }}>
                        Registrar stock inicial
                      </button>
                      <a href="/dashboard/inventario" className="text-sm text-muted-foreground underline">Ir a inventario</a>
                    </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Stock Mínimo</Label>
              <Input type="number" min={0} {...register('stock_minimo', { valueAsNumber: true })} />
              {errors.stock_minimo && <p className="text-sm text-red-600">{errors.stock_minimo.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Descuento (%)</Label>
              <Input type="number" min={0} max={100} {...register('descuento', { valueAsNumber: true })} />
            </div>
          </div>

          {/* Precios */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex flex-col gap-2">
              <Label>Precio Compra *</Label>
              <Input type="number" step="0.01" min={0} {...register('precio_compra', { valueAsNumber: true })} />
              {errors.precio_compra && <p className="text-sm text-red-600">{errors.precio_compra.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Precio Venta *</Label>
              <Input type="number" step="0.01" min={0} {...register('precio_venta', { valueAsNumber: true })} />
              {errors.precio_venta && <p className="text-sm text-red-600">{errors.precio_venta.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Margen (%)</Label>
              <div className="px-3 py-2 rounded border bg-gray-50 text-sm font-mono">{calcularMargen()}%</div>
              {producto && inventarioCostoPromedio && (
                <div className="mt-2">
                  <button type="button" onClick={handleSyncPrecioCompra} className="text-sm text-primary underline">Sincronizar precio con costo promedio</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Switch checked={watch('oferta')} onCheckedChange={(v) => setValue('oferta', v)} />
              <span className="text-sm">En Oferta</span>
            </div>
          </div>

          {/* Imagen */}
          <div className="space-y-3">
            <Label>Imagen (opcional)</Label>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative">
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Previsualización" className="object-cover w-full h-full" />
                    <button type="button" aria-label="Quitar imagen" title="Quitar imagen" onClick={handleRemoveImage} className="absolute top-1 right-1 bg-white/80 rounded-full p-1 shadow"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <div className="text-gray-400 flex flex-col items-center text-sm">
                    <Image className="w-8 h-8 mb-2" />
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} />
                <p className="text-xs text-gray-500">Formatos: JPG, PNG, WEBP. Máx 5MB.</p>
                {uploadingImage && <p className="text-xs text-blue-600">Subiendo imagen...</p>}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading || uploadingImage}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || uploadingImage}
            >
              {loading || uploadingImage
                ? (producto ? 'Actualizando...' : 'Creando...') 
                : (producto ? 'Actualizar Producto' : 'Crear Producto')
              }
            </Button>
          </div>
        </form>
      </CardContent>
      <Sheet open={isCompraSheetOpen} onOpenChange={setCompraSheetOpen}>
        <SheetContent side="right" className="w-full max-w-4xl lg:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Registrar entrada inicial de inventario</SheetTitle>
          </SheetHeader>
          <div className="p-4 w-full">
            <CompraRapidaForm
              initialLines={compraInitialLines}
              onSuccess={() => {
                setCompraSheetOpen(false)
                onSuccess()
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}