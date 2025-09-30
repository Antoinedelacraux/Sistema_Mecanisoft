'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Package, Factory, Ruler } from 'lucide-react'
import { CategoriaCompleta, FabricanteCompleto, UnidadCompleta } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface CategoriasManagerProps {
  onClose: () => void
}

export function CategoriasManager({ onClose }: CategoriasManagerProps) {
  // Estados para datos
  const [categorias, setCategorias] = useState<CategoriaCompleta[]>([])
  const [fabricantes, setFabricantes] = useState<FabricanteCompleto[]>([])
  const [unidades, setUnidades] = useState<UnidadCompleta[]>([])
  const [loading, setLoading] = useState(false)
  
  // Estados para formularios
  const [categoriaForm, setCategoriaForm] = useState({ nombre: '' })
  const [fabricanteForm, setFabricanteForm] = useState({ nombre_fabricante: '', descripcion: '' })
  const [unidadForm, setUnidadForm] = useState({ nombre_unidad: '', abreviatura: '' })

  const { toast } = useToast()

  // Cargar datos
  const fetchCategorias = async () => {
    try {
      const response = await fetch('/api/categorias')
      const data = await response.json()
      setCategorias(data.categorias || [])
    } catch (error) {
      console.error('Error cargando categorías:', error)
    }
  }

  const fetchFabricantes = async () => {
    try {
      const response = await fetch('/api/fabricantes')
      const data = await response.json()
      setFabricantes(data.fabricantes || [])
    } catch (error) {
      console.error('Error cargando fabricantes:', error)
    }
  }

  const fetchUnidades = async () => {
    try {
      const response = await fetch('/api/unidades')
      const data = await response.json()
      setUnidades(data.unidades || [])
    } catch (error) {
      console.error('Error cargando unidades:', error)
    }
  }

  useEffect(() => {
    fetchCategorias()
    fetchFabricantes()
    fetchUnidades()
  }, [])

  // Funciones para categorías
  const handleCreateCategoria = async () => {
    if (!categoriaForm.nombre.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la categoría es requerido",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoriaForm)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast({
        title: "Categoría creada",
        description: `${categoriaForm.nombre} ha sido creada correctamente`,
      })

      setCategoriaForm({ nombre: '' })
      fetchCategorias()
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

  // Funciones para fabricantes
  const handleCreateFabricante = async () => {
    if (!fabricanteForm.nombre_fabricante.trim()) {
      toast({
        title: "Error",
        description: "El nombre del fabricante es requerido",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/fabricantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fabricanteForm)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast({
        title: "Fabricante creado",
        description: `${fabricanteForm.nombre_fabricante} ha sido creado correctamente`,
      })

      setFabricanteForm({ nombre_fabricante: '', descripcion: '' })
      fetchFabricantes()
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

  // Funciones para unidades
  const handleCreateUnidad = async () => {
    if (!unidadForm.nombre_unidad.trim() || !unidadForm.abreviatura.trim()) {
      toast({
        title: "Error",
        description: "Nombre y abreviatura son requeridos",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/unidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unidadForm)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast({
        title: "Unidad creada",
        description: `${unidadForm.nombre_unidad} ha sido creada correctamente`,
      })

      setUnidadForm({ nombre_unidad: '', abreviatura: '' })
      fetchUnidades()
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

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Categorías y Clasificaciones</h2>
          <p className="text-gray-600">Administra categorías, fabricantes y unidades de medida</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <Tabs defaultValue="categorias" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="fabricantes">Fabricantes</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
        </TabsList>

        {/* Tab de Categorías */}
        <TabsContent value="categorias">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de categoría */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Nueva Categoría
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre de la Categoría *</Label>
                  <Input
                    value={categoriaForm.nombre}
                    onChange={(e) => setCategoriaForm({ nombre: e.target.value })}
                    placeholder="Ej: Aceites y Lubricantes"
                  />
                </div>
                <Button
                  onClick={handleCreateCategoria}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Categoría
                </Button>
              </CardContent>
            </Card>

            {/* Lista de categorías */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Categorías Registradas ({categorias.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {categorias.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No hay categorías registradas
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categorias.map((categoria) => (
                          <TableRow key={categoria.id_categoria}>
                            <TableCell>
                              <div className="font-medium">{categoria.nombre}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {categoria._count.productos} producto{categoria._count.productos !== 1 ? 's' : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">
                                Activa
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab de Fabricantes */}
        <TabsContent value="fabricantes">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de fabricante */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="w-5 h-5" />
                  Nuevo Fabricante
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre del Fabricante *</Label>
                  <Input
                    value={fabricanteForm.nombre_fabricante}
                    onChange={(e) => setFabricanteForm(prev => ({ ...prev, nombre_fabricante: e.target.value }))}
                    placeholder="Ej: Castrol"
                  />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={fabricanteForm.descripcion}
                    onChange={(e) => setFabricanteForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Descripción opcional..."
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleCreateFabricante}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Fabricante
                </Button>
              </CardContent>
            </Card>

            {/* Lista de fabricantes */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fabricantes Registrados ({fabricantes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {fabricantes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No hay fabricantes registrados
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fabricante</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fabricantes.map((fabricante) => (
                          <TableRow key={fabricante.id_fabricante}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{fabricante.nombre_fabricante}</div>
                                {fabricante.descripcion && (
                                  <div className="text-sm text-gray-500">{fabricante.descripcion}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {fabricante._count.productos} producto{fabricante._count.productos !== 1 ? 's' : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">
                                Activo
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab de Unidades */}
        <TabsContent value="unidades">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de unidad */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="w-5 h-5" />
                  Nueva Unidad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre de la Unidad *</Label>
                  <Input
                    value={unidadForm.nombre_unidad}
                    onChange={(e) => setUnidadForm(prev => ({ ...prev, nombre_unidad: e.target.value }))}
                    placeholder="Ej: Metros"
                  />
                </div>
                <div>
                  <Label>Abreviatura *</Label>
                  <Input
                    value={unidadForm.abreviatura}
                    onChange={(e) => setUnidadForm(prev => ({ ...prev, abreviatura: e.target.value.toUpperCase() }))}
                    placeholder="Ej: M"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <Button
                  onClick={handleCreateUnidad}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Unidad
                </Button>
              </CardContent>
            </Card>

            {/* Lista de unidades */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Unidades Registradas ({unidades.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {unidades.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No hay unidades registradas
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Unidad</TableHead>
                          <TableHead>Abreviatura</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unidades.map((unidad) => (
                          <TableRow key={unidad.id_unidad}>
                            <TableCell>
                              <div className="font-medium">{unidad.nombre_unidad}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {unidad.abreviatura}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {unidad._count.productos} producto{unidad._count.productos !== 1 ? 's' : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">
                                Activa
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}