'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Edit, Trash2, Eye, Car, User } from 'lucide-react'
import { VehiculoCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface VehiculosTableProps {
  onEdit: (vehiculo: VehiculoCompleto) => void
  onView: (vehiculo: VehiculoCompleto) => void
  onCreateNew: () => void
  refreshTrigger?: number
}

export function VehiculosTable({ onEdit, onView, onCreateNew, refreshTrigger }: VehiculosTableProps) {
  const [vehiculos, setVehiculos] = useState<VehiculoCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    current: 1,
    limit: 10
  })
  
  const { toast } = useToast()

  const fetchVehiculos = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      })

      const response = await fetch(`/api/vehiculos?${params}`)
      if (!response.ok) throw new Error('Error al cargar vehículos')

      const data = await response.json()
      setVehiculos(data.vehiculos)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "Error al cargar los vehículos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, search, toast])

  useEffect(() => {
    fetchVehiculos()
  }, [fetchVehiculos])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchVehiculos()
    }
  }, [refreshTrigger, fetchVehiculos])

  const handleDelete = async (vehiculo: VehiculoCompleto) => {
    if (!confirm(`¿Estás seguro de eliminar el vehículo ${vehiculo.placa}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/vehiculos/${vehiculo.id_vehiculo}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Error al eliminar vehículo')

      toast({
        title: "Vehículo eliminado",
        description: `${vehiculo.placa} ha sido eliminado correctamente`,
      })

      fetchVehiculos()
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar el vehículo",
        variant: "destructive",
      })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const getVehiculoColor = (tipo: string) => {
    const colors = {
      'Automóvil': 'bg-blue-100 text-blue-800',
      'SUV': 'bg-green-100 text-green-800',
      'Camioneta': 'bg-orange-100 text-orange-800',
      'Motocicleta': 'bg-purple-100 text-purple-800',
      'Camión': 'bg-red-100 text-red-800',
    }
    return colors[tipo as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Vehículos</CardTitle>
            <CardDescription>
              Administra los vehículos de tus clientes
            </CardDescription>
          </div>
          <Button onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Vehículo
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Barra de búsqueda */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por placa, cliente, marca o modelo..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Car className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{vehiculos.length}</div>
            <div className="text-sm text-blue-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {vehiculos.filter(v => v.tipo === 'Automóvil').length}
            </div>
            <div className="text-sm text-green-600">Automóviles</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-lg font-bold text-orange-600">
              {vehiculos.filter(v => v.tipo === 'SUV' || v.tipo === 'Camioneta').length}
            </div>
            <div className="text-sm text-orange-600">SUV/Camionetas</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-lg font-bold text-purple-600">
              {vehiculos.filter(v => v.tipo === 'Motocicleta').length}
            </div>
            <div className="text-sm text-purple-600">Motocicletas</div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Cargando vehículos...</p>
            </div>
          </div>
        ) : vehiculos.length === 0 ? (
          <div className="text-center py-8">
            <Car className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron vehículos</p>
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
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Propietario</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead>Motor</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehiculos.map((vehiculo) => (
                    <TableRow key={vehiculo.id_vehiculo}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-lg">{vehiculo.placa}</div>
                          <div className="text-sm text-gray-600">
                            {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}
                          </div>
                          <Badge 
                            className={`mt-1 ${getVehiculoColor(vehiculo.tipo)}`}
                            variant="secondary"
                          >
                            {vehiculo.tipo}
                          </Badge>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {vehiculo.cliente.persona.nombre} {vehiculo.cliente.persona.apellido_paterno}
                            </div>
                            <div className="text-sm text-gray-500">
                              {vehiculo.cliente.persona.numero_documento}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          <div><strong>Combustible:</strong> {vehiculo.tipo_combustible}</div>
                          <div><strong>Transmisión:</strong> {vehiculo.transmision}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {vehiculo.numero_motor && (
                            <div><strong>Motor:</strong> {vehiculo.numero_motor}</div>
                          )}
                          {vehiculo.numero_chasis && (
                            <div><strong>Chasis:</strong> {vehiculo.numero_chasis}</div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <span className="font-semibold">{vehiculo.año}</span>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(vehiculo)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(vehiculo)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(vehiculo)}
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
                  Mostrando {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} vehículos
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