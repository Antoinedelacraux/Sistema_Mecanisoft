'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'natural' | 'ruc' | 'juridica'>('all')
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

      const response = await fetch(`/api/clientes?${params}`, {
        credentials: 'include',
        cache: 'no-store'
      })

      if (!response.ok) {
        let message = 'Error al cargar clientes'
        try {
          const errorBody = await response.json()
          if (errorBody?.error) {
            message = `${message}: ${errorBody.error}`
          } else if (typeof errorBody === 'string' && errorBody.trim().length > 0) {
            message = `${message}: ${errorBody}`
          }
        } catch {
          const errorText = await response.text().catch(() => '')
          if (errorText) {
            message = `${message}: ${errorText}`
          } else if (response.statusText) {
            message = `${message}: ${response.statusText}`
          }
        }

        message = `${message} (HTTP ${response.status})`
        throw new Error(message)
      }

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

  const getClienteTipo = useCallback((cliente: ClienteCompleto): 'natural' | 'ruc' | 'juridica' => {
    if (cliente.persona.tipo_documento === 'RUC') return 'ruc'
    if (cliente.persona.empresa_persona) return 'juridica'
    return 'natural'
  }, [])

  const clientePuedeFacturar = useCallback((cliente: ClienteCompleto) => {
    return cliente.persona.tipo_documento === 'RUC' || Boolean(cliente.persona.empresa_persona)
  }, [])

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
        credentials: 'include',
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
        method: 'DELETE',
        credentials: 'include'
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
    if (statusFilter === 'active' && !cliente.estatus) return false
    if (statusFilter === 'inactive' && cliente.estatus) return false
    if (typeFilter !== 'all' && getClienteTipo(cliente) !== typeFilter) return false
    return true
  })

  const totalActivos = clientes.filter(c => c.estatus).length
  const totalInactivos = clientes.filter(c => !c.estatus).length
  const totalNaturales = clientes.filter(c => getClienteTipo(c) === 'natural').length
  const totalRuc = clientes.filter(c => getClienteTipo(c) === 'ruc').length
  const totalJuridicas = clientes.filter(c => getClienteTipo(c) === 'juridica').length
  const totalFacturan = clientes.filter(clientePuedeFacturar).length


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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre, documento o correo..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Estado:</label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
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

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Tipo:</label>
              <Select
                value={typeFilter}
                onValueChange={(value: 'all' | 'natural' | 'ruc' | 'juridica') => {
                  setTypeFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="natural">Persona natural</SelectItem>
                  <SelectItem value="ruc">Persona con RUC</SelectItem>
                  <SelectItem value="juridica">Persona jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ✅ Estadísticas rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="rounded-lg border bg-blue-50 p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{clientes.length}</div>
            <div className="text-sm text-blue-600">Clientes</div>
          </div>
          <div className="rounded-lg border bg-green-50 p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{totalActivos}</div>
            <div className="text-sm text-green-600">Activos</div>
          </div>
          <div className="rounded-lg border bg-red-50 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{totalInactivos}</div>
            <div className="text-sm text-red-600">Inactivos</div>
          </div>
          <div className="rounded-lg border bg-amber-50 p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{totalFacturan}</div>
            <div className="text-sm text-amber-600">Pueden facturar</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 text-sm text-slate-600">
          <span className="px-2 py-1 rounded-full bg-slate-100">Naturales: {totalNaturales}</span>
          <span className="px-2 py-1 rounded-full bg-slate-100">Con RUC: {totalRuc}</span>
          <span className="px-2 py-1 rounded-full bg-slate-100">Con empresa: {totalJuridicas}</span>
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Facturación</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Vehículos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.map((cliente) => {
                    const tipo = getClienteTipo(cliente)
                    const puedeFacturar = clientePuedeFacturar(cliente)
                    const persona = cliente.persona

                    const tipoLabel =
                      tipo === 'natural'
                        ? 'Persona natural'
                        : tipo === 'ruc'
                          ? 'Persona con RUC'
                          : 'Persona jurídica'

                    const tipoBadgeClass =
                      tipo === 'natural'
                        ? 'bg-slate-100 text-slate-700'
                        : tipo === 'ruc'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-purple-100 text-purple-700'

                    const facturacionBadgeClass = puedeFacturar
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'

                    return (
                      <TableRow
                        key={cliente.id_cliente}
                        className={!cliente.estatus ? 'bg-gray-50 opacity-75' : ''}
                      >
                        <TableCell>
                          <div className={!cliente.estatus ? 'text-gray-500 flex flex-col gap-1' : 'flex flex-col gap-1'}>
                            <div className="font-medium">
                              {persona.nombre} {persona.apellido_paterno}
                            </div>
                            {tipo === 'ruc' && persona.nombre_comercial && (
                              <div className="text-sm text-sky-600">
                                {persona.nombre_comercial}
                              </div>
                            )}
                            {persona.empresa_persona && (
                              <div className="text-sm text-gray-500">
                                {persona.empresa_persona.razon_social}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={!cliente.estatus ? 'text-gray-500' : ''}>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">{persona.tipo_documento}</div>
                            <div className="font-mono text-sm">{persona.numero_documento}</div>
                          </div>
                          {persona.empresa_persona && (
                            <div className="text-xs text-muted-foreground">
                              Empresa RUC: {persona.empresa_persona.ruc}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={tipoBadgeClass}>{tipoLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={facturacionBadgeClass}>
                            {puedeFacturar ? 'Factura' : 'Boleta'}
                          </Badge>
                        </TableCell>
                        <TableCell className={!cliente.estatus ? 'text-gray-500' : ''}>
                          <div className="flex flex-col gap-1">
                            {persona.telefono && (
                              <div className="text-sm">{persona.telefono}</div>
                            )}
                            {persona.correo && (
                              <div className="text-sm">{persona.correo}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={!cliente.estatus ? 'text-gray-500' : ''}>
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{cliente._count.vehiculos}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={cliente.estatus ? 'default' : 'secondary'}
                            className={cliente.estatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {cliente.estatus ? 'Activo' : 'Inactivo'}
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

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(cliente)}
                              disabled={!cliente.estatus}
                              className={!cliente.estatus ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(cliente)}
                              className={cliente.estatus ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                              title={cliente.estatus ? 'Desactivar cliente' : 'Activar cliente'}
                            >
                              {cliente.estatus ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(cliente)}
                              disabled={cliente.estatus}
                              className={cliente.estatus
                                ? 'opacity-50 cursor-not-allowed'
                                : 'text-red-600 hover:text-red-700'}
                              title={cliente.estatus ? 'Desactiva el cliente antes de eliminarlo' : 'Eliminar cliente'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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