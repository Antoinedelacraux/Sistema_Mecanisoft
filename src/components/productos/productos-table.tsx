'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Edit, Trash2, Eye, Package, AlertTriangle, Settings } from 'lucide-react'
import { ProductoCompleto, CategoriaCompleta } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface ProductosTableProps {
  onEdit: (producto: ProductoCompleto) => void
  onView: (producto: ProductoCompleto) => void
  onCreateNew: () => void
  onManageCategories: () => void
  refreshTrigger?: number
}

export function ProductosTable({ onEdit, onView, onCreateNew, onManageCategories, refreshTrigger }: ProductosTableProps) {
  const [productos, setProductos] = useState<ProductoCompleto[]>([])
  const [categorias, setCategorias] = useState<CategoriaCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('all')
  const [tipoFilter, setTipoFilter] = useState('all')
  const [stockBajo, setStockBajo] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    current: 1,
    limit: 10
  })
  
  const { toast } = useToast()

  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(categoriaFilter && categoriaFilter !== 'all' && { categoria: categoriaFilter }),
        ...(tipoFilter && tipoFilter !== 'all' && { tipo: tipoFilter }),
        ...(stockBajo && { stock_bajo: 'true' })
      })

      const response = await fetch(`/api/productos?${params}`)
      if (!response.ok) throw new Error('Error al cargar productos')

      const data = await response.json()
      setProductos(data.productos)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "Error al cargar los productos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, search, categoriaFilter, tipoFilter, stockBajo, toast])

  const fetchCategorias = useCallback(async () => {
    try {
      const response = await fetch('/api/categorias')
      const data = await response.json()
      setCategorias(data.categorias || [])
    } catch (error) {
      console.error('Error cargando categorías:', error)
    }
  }, [])

  useEffect(() => {
    fetchProductos()
    fetchCategorias()
  }, [fetchProductos, fetchCategorias])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchProductos()
    }
  }, [refreshTrigger, fetchProductos])

  const handleDelete = async (producto: ProductoCompleto) => {
    if (!confirm(`¿Estás seguro de eliminar el producto ${producto.nombre}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/productos/${producto.id_producto}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Error al eliminar producto')

      toast({
        title: "Producto eliminado",
        description: `${producto.nombre} ha sido eliminado correctamente`,
      })

      fetchProductos()
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar el producto",
        variant: "destructive",
      })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const getStockBadge = (stock: number, stockMinimo: number) => {
    if (stock === 0) {
      return <Badge variant="destructive">Sin Stock</Badge>
    } else if (stock <= stockMinimo) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Stock Bajo</Badge>
    } else {
      return <Badge className="bg-green-100 text-green-800">Disponible</Badge>
    }
  }

  const getTipoBadge = (tipo: string) => {
    return tipo === 'producto' 
      ? <Badge variant="outline">Producto</Badge>
      : <Badge variant="secondary">Servicio</Badge>
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(price)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Productos e Inventario</CardTitle>
            <CardDescription>
              Administra productos, servicios y controla el inventario
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onManageCategories}
            >
              <Settings className="w-4 h-4 mr-2" />
              Categorías
            </Button>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre, código, categoría..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria.id_categoria} value={categoria.id_categoria.toString()}>
                    {categoria.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="producto">Productos</SelectItem>
                <SelectItem value="servicio">Servicios</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={stockBajo ? "default" : "outline"}
              onClick={() => setStockBajo(!stockBajo)}
              className="whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Stock Bajo
            </Button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Package className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{productos.length}</div>
            <div className="text-sm text-blue-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {productos.filter(p => p.tipo === 'producto').length}
            </div>
            <div className="text-sm text-green-600">Productos</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-lg font-bold text-purple-600">
              {productos.filter(p => p.tipo === 'servicio').length}
            </div>
            <div className="text-sm text-purple-600">Servicios</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">
              {productos.filter(p => p.stock === 0).length}
            </div>
            <div className="text-sm text-red-600">Sin Stock</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-lg font-bold text-orange-600">
              {productos.filter(p => p.stock > 0 && p.stock <= p.stock_minimo).length}
            </div>
            <div className="text-sm text-orange-600">Stock Bajo</div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Cargando productos...</p>
            </div>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron productos</p>
            {search && (
              <Button 
                variant="ghost" 
                onClick={() => setSearch('')}
                className="mt-2"
              >
                Limpiar búsqueda
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Precios</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((producto) => (
                    <TableRow key={producto.id_producto}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{producto.nombre}</div>
                          <div className="text-sm text-gray-500">{producto.codigo_producto}</div>
                          <div className="text-sm text-gray-500">{producto.fabricante.nombre_fabricante}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline">
                          {producto.categoria.nombre}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {getStockBadge(producto.stock, producto.stock_minimo)}
                          <div className="text-sm text-gray-600">
                            {producto.stock} {producto.unidad_medida.abreviatura}
                          </div>
                          {producto.stock <= producto.stock_minimo && producto.stock > 0 && (
                            <div className="text-xs text-orange-600">
                              Min: {producto.stock_minimo}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          <div><strong>Venta:</strong> {formatPrice(producto.precio_venta)}</div>
                          <div className="text-gray-500">Compra: {formatPrice(producto.precio_compra)}</div>
                          {producto.descuento > 0 && (
                            <div className="text-green-600">Desc: {producto.descuento}%</div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getTipoBadge(producto.tipo)}
                        {producto.oferta && (
                          <div className="mt-1">
                            <Badge className="bg-yellow-100 text-yellow-800">Oferta</Badge>
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(producto)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(producto)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(producto)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Mostrando {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} productos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {page} de {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}