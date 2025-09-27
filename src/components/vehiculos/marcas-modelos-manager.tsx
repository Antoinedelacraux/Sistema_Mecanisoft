'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Car } from 'lucide-react'
import { MarcaCompleta, ModeloCompleto, MarcaFormData, ModeloFormData } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface MarcasModelosManagerProps {
  onClose: () => void
}

export function MarcasModelosManager({ onClose }: MarcasModelosManagerProps) {
  const [marcas, setMarcas] = useState<MarcaCompleta[]>([])
  const [modelos, setModelos] = useState<ModeloCompleto[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMarca, setSelectedMarca] = useState<MarcaCompleta | null>(null)
  const [selectedModelo, setSelectedModelo] = useState<ModeloCompleto | null>(null)
  const [showMarcaForm, setShowMarcaForm] = useState(false)
  const [showModeloForm, setShowModeloForm] = useState(false)
  
  // Estados para formularios
  const [marcaForm, setMarcaForm] = useState<MarcaFormData>({
    nombre_marca: '',
    descripcion: ''
  })
  
  const [modeloForm, setModeloForm] = useState<ModeloFormData>({
    id_marca: 0,
    nombre_modelo: '',
    descripcion: ''
  })

  const { toast } = useToast()

  // Cargar datos
  const fetchMarcas = async () => {
    try {
      const response = await fetch('/api/marcas')
      const data = await response.json()
      setMarcas(data.marcas || [])
    } catch (error) {
      console.error('Error cargando marcas:', error)
    }
  }

  const fetchModelos = async () => {
    try {
      const response = await fetch('/api/modelos')
      const data = await response.json()
      setModelos(data.modelos || [])
    } catch (error) {
      console.error('Error cargando modelos:', error)
    }
  }

  useEffect(() => {
    fetchMarcas()
    fetchModelos()
  }, [])

  // Funciones para marcas
  const handleCreateMarca = async () => {
    if (!marcaForm.nombre_marca.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la marca es requerido",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/marcas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marcaForm)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast({
        title: "Marca creada",
        description: `${marcaForm.nombre_marca} ha sido creada correctamente`,
      })

      setMarcaForm({ nombre_marca: '', descripcion: '' })
      setShowMarcaForm(false)
      fetchMarcas()
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

  const handleEditMarca = (marca: MarcaCompleta) => {
    setSelectedMarca(marca)
    setMarcaForm({
      nombre_marca: marca.nombre_marca,
      descripcion: marca.descripcion || ''
    })
    setShowMarcaForm(true)
  }

  const handleUpdateMarca = async () => {
    if (!selectedMarca) return

    setLoading(true)
    try {
      const response = await fetch(`/api/marcas/${selectedMarca.id_marca}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marcaForm)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast({ // ✅ Corregido
        title: "Marca actualizada",
        description: `${marcaForm.nombre_marca} ha sido actualizada correctamente`,
      }) 

      setMarcaForm({ nombre_marca: '', descripcion: '' })
      setSelectedMarca(null)
      setShowMarcaForm(false)
      fetchMarcas()
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

  const handleUpdateModelo = async () => {
    if (!selectedModelo) return
  
    setLoading(true)
    try {
      const response = await fetch(`/api/modelos/${selectedModelo.id_modelo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modeloForm)
      })
  
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
  
      toast({
        title: "Modelo actualizado",
        description: `${modeloForm.nombre_modelo} ha sido actualizado correctamente`,
      })
  
      setModeloForm({ id_marca: 0, nombre_modelo: '', descripcion: '' })
      setSelectedModelo(null)
      setShowModeloForm(false)
      fetchModelos()
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

  // Funciones para modelos
  const handleCreateModelo = async () => {
    if (!modeloForm.nombre_modelo.trim() || !modeloForm.id_marca) {
      toast({
        title: "Error",
        description: "El nombre del modelo y la marca son requeridos",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modeloForm)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast({
        title: "Modelo creado",
        description: `${modeloForm.nombre_modelo} ha sido creado correctamente`,
      })

      setModeloForm({ id_marca: 0, nombre_modelo: '', descripcion: '' })
      setShowModeloForm(false)
      fetchModelos()
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

  const handleEditModelo = (modelo: ModeloCompleto) => {
    setSelectedModelo(modelo)
    setModeloForm({
      id_marca: modelo.id_marca,
      nombre_modelo: modelo.nombre_modelo,
      descripcion: modelo.descripcion || ''
    })
    setShowModeloForm(true)
  }

  const resetForms = () => {
    setMarcaForm({ nombre_marca: '', descripcion: '' })
    setModeloForm({ id_marca: 0, nombre_modelo: '', descripcion: '' })
    setSelectedMarca(null)
    setSelectedModelo(null)
    setShowMarcaForm(false)
    setShowModeloForm(false)
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Marcas y Modelos</h2>
          <p className="text-gray-600">Administra las marcas y modelos de vehículos</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <Tabs defaultValue="marcas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marcas">Marcas</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        {/* Tab de Marcas */}
        <TabsContent value="marcas">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de marca */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedMarca ? 'Editar Marca' : 'Nueva Marca'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre de la Marca *</Label>
                  <Input
                    value={marcaForm.nombre_marca}
                    onChange={(e) => setMarcaForm(prev => ({ ...prev, nombre_marca: e.target.value }))}
                    placeholder="Ej: Toyota"
                  />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={marcaForm.descripcion}
                    onChange={(e) => setMarcaForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Descripción opcional..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={selectedMarca ? handleUpdateMarca : handleCreateMarca}
                    disabled={loading}
                    className="flex-1"
                  >
                    {selectedMarca ? 'Actualizar' : 'Crear'} Marca
                  </Button>
                  {selectedMarca && (
                    <Button variant="outline" onClick={resetForms}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de marcas */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Marcas Registradas ({marcas.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {marcas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No hay marcas registradas
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelos</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marcas.map((marca) => (
                          <TableRow key={marca.id_marca}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{marca.nombre_marca}</div>
                                {marca.descripcion && (
                                  <div className="text-sm text-gray-500">{marca.descripcion}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {marca._count.modelos} modelo{marca._count.modelos !== 1 ? 's' : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditMarca(marca)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
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

        {/* Tab de Modelos */}
        <TabsContent value="modelos">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulario de modelo */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedModelo ? 'Editar Modelo' : 'Nuevo Modelo'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Marca *</Label>
                  <Select 
                    value={modeloForm.id_marca.toString()} 
                    onValueChange={(value) => setModeloForm(prev => ({ ...prev, id_marca: parseInt(value) }))}
                  >
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
                  <Label>Nombre del Modelo *</Label>
                  <Input
                    value={modeloForm.nombre_modelo}
                    onChange={(e) => setModeloForm(prev => ({ ...prev, nombre_modelo: e.target.value }))}
                    placeholder="Ej: Corolla"
                  />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={modeloForm.descripcion}
                    onChange={(e) => setModeloForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Descripción opcional..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={selectedModelo ? handleUpdateModelo : handleCreateModelo} // ✅ Cambio aquí
                    disabled={loading}
                    className="flex-1"
                  >
                    {selectedModelo ? 'Actualizar' : 'Crear'} Modelo
                  </Button>
                  {selectedModelo && (
                    <Button variant="outline" onClick={resetForms}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de modelos */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Modelos Registrados ({modelos.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {modelos.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No hay modelos registrados
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Vehículos</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modelos.map((modelo) => (
                          <TableRow key={modelo.id_modelo}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{modelo.nombre_modelo}</div>
                                {modelo.descripcion && (
                                  <div className="text-sm text-gray-500">{modelo.descripcion}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {modelo.marca.nombre_marca}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Car className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">{modelo._count.vehiculos}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditModelo(modelo)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
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