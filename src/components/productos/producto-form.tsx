'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, Image } from 'lucide-react'
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(producto?.foto || '')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      nombre: '',
      codigo_producto: '',
      id_categoria: undefined,
      id_fabricante: undefined,
      id_unidad: undefined,
      tipo: 'producto',
      descripcion: '',
      stock: 0,
      stock_minimo: 1,
      precio_compra: 0,
      precio_venta: 0,
      descuento: 0,
      oferta: false
    }
  })

  const tipoProducto = watch('tipo')
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

  const onSubmit = async (data: ProductoFormData) => {
    setLoading(true)
    try {
      let imageUrl = producto?.foto || imagePreview

      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }

      const finalData = { ...data, foto: imageUrl };

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

      toast({
        title: producto ? "Producto actualizado" : "Producto creado",
        description: `${data.nombre} ha sido ${producto ? 'actualizado' : 'creado'} correctamente`,
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

  const calcularMargen = () => {
    if (precioCompra > 0 && precioVenta > 0) {
      const margen = ((precioVenta - precioCompra) / precioCompra) * 100
      return margen.toFixed(2)
    }
    return '0.00'
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{producto ? 'Editar Producto' : 'Nuevo Producto'}</CardTitle>
        <CardDescription>
          {producto ? 'Modifica la información del producto' : 'Completa los datos para registrar un nuevo producto o servicio'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ... (resto del formulario sin cambios) ... */}
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
    </Card>
  )
}