'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Edit, Trash2, Eye, Car, ToggleLeft, ToggleRight } from 'lucide-react'
import { ClienteCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface ClientesTableProps {
  onEdit: (cliente: ClienteCompleto) => void
  onView: (cliente: ClienteCompleto) => void
  onCreateNew: () => void
  refreshTrigger?: number
}

export function ClientesTable({ onEdit, onView, onCreateNew, refreshTrigger }: ClientesTableProps) {
  const [clientes, setClientes] = useState<ClienteCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    current: 1,
    limit: 10
  })
  
  const { toast } = useToast()

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      })

      const response = await fetch(`/api/clientes?${params}`)
      if (!response.ok) throw new Error('Error al cargar clientes')

      const data = await response.json()
      setClientes(data.clientes)
      setPagination(data.pagination)
    } catch (error: unknown) {
      console.error('Error:', error)
      const message = error instanceof Error ? error.message : 'Error al cargar los clientes'
      toast("Error", {
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, search, toast])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  // Refresca la tabla cuando el `refreshTrigger` cambia
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) fetchClientes()
  }, [refreshTrigger, fetchClientes])

  const handleToggleStatus = async (cliente: ClienteCompleto) => {
    const newStatus = !cliente.estatus
    const action = newStatus ? 'activar' : 'desactivar'
    
    const confirmMessage = newStatus 
      ? `¿Activar al cliente ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}? Podrá volver a realizar transacciones.`
      : `¿Desactivar al cliente ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}? No podrá realizar nuevas transacciones.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch(`/api/clientes/${cliente.id_cliente}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'toggle_status',
          estatus: newStatus
        })
      })

      if (!response.ok) throw new Error('Error al cambiar estado')

    toast(`Cliente ${newStatus ? 'activado' : 'desactivado'}`, { 
      description: newStatus 
        ? `${cliente.persona.nombre} puede realizar transacciones nuevamente`
        : `${cliente.persona.nombre} no podrá realizar nuevas transacciones`,
    })

    fetchClientes()
    } catch (error) {
      toast("Error", { description: "Error al cambiar el estado del cliente", variant: "destructive" })
    }
  }

  const handleDelete = async (cliente: ClienteCompleto) => {
    if (!confirm(`¿Estás seguro de eliminar al cliente ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/clientes/${cliente.id_cliente}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Error al eliminar cliente')

      toast(
        "Cliente eliminado",
        { description: "El cliente ha sido eliminado correctamente" }
      )

      fetchClientes()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar el cliente'
      toast("Error", {
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1) // Reset to first page when searching
  }

  // ✅ Filtrar clientes por estado antes de mostrar
  const filteredClientes = clientes.filter(cliente => {
    if (statusFilter === 'active') return cliente.estatus === true
    if (statusFilter === 'inactive') return cliente.estatus === false
    return true // 'all' muestra todos
  })

  const totalActivos = clientes.filter(c => c.estatus).length
  const totalInactivos = clientes.filter(c => !c.estatus).length


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Clientes</CardTitle>
            <CardDescription>
              Administra la información de tus clientes
            </CardDescription>
          </div>
          <Button onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Barra de búsqueda y filtros */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre, documento o correo..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* ✅ Filtro de estado */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Estado:</label>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ✅ Estadísticas rápidas */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{clientes.length}</div>
            <div className="text-sm text-blue-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{totalActivos}</div>
            <div className="text-sm text-green-600">Activos</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{totalInactivos}</div>
            <div className="text-sm text-red-600">Inactivos</div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Cargando clientes...</p>
            </div>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {statusFilter === 'all'
                ? 'No se encontraron clientes'
                : `No hay clientes ${statusFilter === 'active' ? 'activos' : 'inactivos'}`
              }
            </p>
            {search && !loading && (
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Vehículos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.map((cliente) => (
                    <TableRow
                      key={cliente.id_cliente}
                      className={!cliente.estatus ? "bg-gray-50 opacity-75" : ""} // ✅ Estilo visual para inactivos
                    >
                      <TableCell>
                        <div className={!cliente.estatus ? "text-gray-500" : ""}>
                          <div
                            className="font-medium"
                          >
                            {cliente.persona.nombre} {cliente.persona.apellido_paterno}
                          </div>
                          {cliente.persona.empresa && (
                            <div className="text-sm text-gray-500">
                              {cliente.persona.empresa}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={!cliente.estatus ? "text-gray-500" : ""}>
                        <div>
                          <div className="text-sm">{cliente.persona.tipo_documento}</div>
                          <div className="font-mono text-sm">{cliente.persona.numero_documento}</div>
                        </div>
                      </TableCell>
                      <TableCell className={!cliente.estatus ? "text-gray-500" : ""}>
                        <div>
                          {cliente.persona.telefono && (
                            <div className="text-sm">{cliente.persona.telefono}</div>
                          )}
                          {cliente.persona.correo && (
                            <div className="text-sm">{cliente.persona.correo}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={!cliente.estatus ? "text-gray-500" : ""}>
                        <div className="flex items-center gap-2 ">
                          <Car className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{cliente._count.vehiculos}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* ✅ Badge más descriptivo */}
                        <Badge
                          variant={cliente.estatus ? "default" : "secondary"}
                          className={cliente.estatus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                        >
                          {cliente.estatus ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(cliente)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {/* ✅ Solo permitir editar si está activo */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(cliente)}
                            disabled={!cliente.estatus} // ✅ Deshabilitar si está inactivo
                            className={!cliente.estatus ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          {/* ✅ Toggle de estado */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(cliente)}
                            className={cliente.estatus ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                            title={cliente.estatus ? "Desactivar cliente" : "Activar cliente"}
                          >
                            {cliente.estatus ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                          </Button>
                          
                          {/* ✅ Solo permitir eliminar si está inactivo */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cliente)}
                            disabled={cliente.estatus} // ✅ Solo eliminar si está inactivo
                            className={cliente.estatus
                              ? "opacity-50 cursor-not-allowed"
                              : "text-red-600 hover:text-red-700"}
                            title={cliente.estatus ? "Desactiva el cliente antes de eliminarlo" : "Eliminar cliente"}
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
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <span>Mostrando {filteredClientes.length} de {clientes.length} clientes</span>
                  {statusFilter !== 'all' && (
                    <span className="ml-1">({statusFilter === 'active' ? 'activos' : 'inactivos'})</span>
                  )}
                  <span>- Página {page} de {pagination.pages}</span>
                  Mostrando {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} clientes
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