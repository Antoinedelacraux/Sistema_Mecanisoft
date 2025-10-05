'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Edit, Eye, Clock, User, Car, AlertCircle, Trash2, LayoutGrid } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

// Tipo temporal hasta que definamos OrdenCompleta
export interface OrdenCompleta {
  id_transaccion: number
  codigo_transaccion: string
  fecha: string
  estado_orden: string
  prioridad: string
  total: number
  persona: {
    nombre: string
    apellido_paterno: string
    numero_documento: string
  }
  trabajador_principal?: {
    codigo_empleado: string
    usuario: {
      persona: {
        nombre: string
        apellido_paterno: string
      }
    }
  }
  transaccion_vehiculos: Array<{
    vehiculo: {
      placa: string
      modelo: {
        marca: {
          nombre_marca: string
        }
        nombre_modelo: string
      }
    }
  }>
  detalles_transaccion: Array<{
    producto: {
      nombre: string
      tipo: string
    }
    tareas?: Array<{
      estado: string
    }>
  }>
  _count?: {
    detalles_transaccion: number
  }
  progreso?: {
    total: number
    pendientes: number
    en_proceso: number
    completadas: number
    verificadas: number
    porcentaje: number
  }
}

interface OrdenesTableProps {
  onEdit: (orden: OrdenCompleta) => void
  onView: (orden: OrdenCompleta) => void
  onCreateNew: () => void
  refreshTrigger?: number
}

export function OrdenesTable({ onEdit, onView, onCreateNew, refreshTrigger }: OrdenesTableProps) {
  const [ordenes, setOrdenes] = useState<OrdenCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // Usamos valores centinela en lugar de string vacío para evitar el error de Radix Select
  const ALL_ESTADOS = '__ALL_ESTADOS__'
  const ALL_PRIORIDADES = '__ALL_PRIORIDADES__'
  const [estadoFilter, setEstadoFilter] = useState(ALL_ESTADOS)
  const [prioridadFilter, setPrioridadFilter] = useState(ALL_PRIORIDADES)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    current: 1,
    limit: 10
  })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [ordenAEliminar, setOrdenAEliminar] = useState<OrdenCompleta | null>(null)
  
  const { toast } = useToast()

  const fetchOrdenes = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        modo: 'full',
        include_tareas: 'true',
        include_progreso: 'true',
        ...(search && { search }),
        ...(estadoFilter !== ALL_ESTADOS && { estado: estadoFilter }),
        ...(prioridadFilter !== ALL_PRIORIDADES && { prioridad: prioridadFilter })
      })

      const response = await fetch(`/api/ordenes?${params}`)
      if (!response.ok) throw new Error('Error al cargar órdenes')

      const data = await response.json()
      setOrdenes(data.ordenes)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "Error al cargar las órdenes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, search, estadoFilter, prioridadFilter, toast])

  useEffect(() => {
    fetchOrdenes()
  }, [fetchOrdenes])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchOrdenes()
    }
  }, [refreshTrigger, fetchOrdenes])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const getEstadoBadge = (estado: string) => {
    const badges = {
      'pendiente': { label: 'Pendiente', className: 'bg-gray-100 text-gray-800' },
      'asignado': { label: 'Asignado', className: 'bg-blue-100 text-blue-800' },
      'en_proceso': { label: 'En Proceso', className: 'bg-yellow-100 text-yellow-800' },
      'completado': { label: 'Completado', className: 'bg-green-100 text-green-800' },
      'entregado': { label: 'Entregado', className: 'bg-purple-100 text-purple-800' },
      'pausado': { label: 'Pausado', className: 'bg-orange-100 text-orange-800' }
    }
    const badge = badges[estado as keyof typeof badges] || { label: estado, className: 'bg-gray-100 text-gray-800' }
    return <Badge className={badge.className} variant="secondary">{badge.label}</Badge>
  }

  const getPrioridadBadge = (prioridad: string) => {
    const badges = {
      'baja': { label: 'Baja', className: 'bg-gray-100 text-gray-800' },
      'media': { label: 'Media', className: 'bg-blue-100 text-blue-800' },
      'alta': { label: 'Alta', className: 'bg-orange-100 text-orange-800' },
      'urgente': { label: 'Urgente', className: 'bg-red-100 text-red-800' }
    }
    const badge = badges[prioridad as keyof typeof badges] || { label: prioridad, className: 'bg-gray-100 text-gray-800' }
    return <Badge className={badge.className} variant="secondary">{badge.label}</Badge>
  }

  const calcularProgreso = (orden: OrdenCompleta) => {
    if (orden.progreso) return orden.progreso.porcentaje || 0
    const todasLasTareas = orden.detalles_transaccion.flatMap(d => d.tareas || [])
    if (todasLasTareas.length === 0) return 0
    const tareasCompletadas = todasLasTareas.filter(t => t.estado === 'completado' || t.estado === 'verificado').length
    return Math.round((tareasCompletadas / todasLasTareas.length) * 100)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(price)
  }

  // Enviar orden al Kanban: genera tareas faltantes para servicios si hay trabajador principal
  const enviarAlKanban = async (orden: OrdenCompleta) => {
    // Verificar trabajador principal
    if (!orden.trabajador_principal) {
      toast({
        title: 'Asignar mecánico',
        description: 'Primero asigna un mecánico principal antes de enviar al tablero.',
        variant: 'destructive'
      })
      return
    }
    try {
      const body: any = { id_transaccion: orden.id_transaccion, generar_tareas_faltantes: true }
      if (orden.estado_orden === 'pendiente') body.nuevo_estado = 'asignado'
      const resp = await fetch('/api/ordenes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}))
        throw new Error(err.error || 'No se pudo generar tareas')
      }
      toast({ title: 'Orden enviada al Kanban', description: `${orden.codigo_transaccion} ahora tiene tareas visibles.` })
      fetchOrdenes()
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const solicitarEliminacion = (orden: OrdenCompleta) => {
    setOrdenAEliminar(orden)
    setShowDeleteModal(true)
  }

  const confirmarEliminacion = async () => {
    if (!ordenAEliminar) return
    try {
      const resp = await fetch(`/api/ordenes/${ordenAEliminar.id_transaccion}`, { method: 'DELETE' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'No se pudo eliminar')
      }
      toast({ title: 'Orden eliminada', description: `${ordenAEliminar.codigo_transaccion} fue eliminada` })
      setShowDeleteModal(false)
      setOrdenAEliminar(null)
      // Refrescar manteniendo página actual, si al borrar queda vacía y no es la primera, retroceder
      await fetchOrdenes()
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Órdenes de Trabajo</CardTitle>
            <CardDescription>
              Gestiona las órdenes de trabajo del taller
            </CardDescription>
          </div>
          <Button onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por código, cliente, placa..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ESTADOS}>Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="asignado">Asignado</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="entregado">Entregado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PRIORIDADES}>Todas</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">{ordenes.length}</div>
            <div className="text-sm text-blue-600">Total</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-lg font-bold text-yellow-600">
              {ordenes.filter(o => o.estado_orden === 'pendiente' || o.estado_orden === 'asignado').length}
            </div>
            <div className="text-sm text-yellow-600">Pendientes</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-lg font-bold text-orange-600">
              {ordenes.filter(o => o.estado_orden === 'en_proceso').length}
            </div>
            <div className="text-sm text-orange-600">En Proceso</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {ordenes.filter(o => o.estado_orden === 'completado').length}
            </div>
            <div className="text-sm text-green-600">Completadas</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">
              {ordenes.filter(o => o.prioridad === 'urgente').length}
            </div>
            <div className="text-sm text-red-600">Urgentes</div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Cargando órdenes...</p>
            </div>
          </div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron órdenes</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente / Vehículo</TableHead>
                    <TableHead>Mecánico</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => {
                    const vehiculo = orden.transaccion_vehiculos[0]?.vehiculo
                    const progreso = calcularProgreso(orden)
                    const detallesCount = orden._count?.detalles_transaccion ?? orden.detalles_transaccion.length
                    
                    return (
                      <TableRow key={orden.id_transaccion}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{orden.codigo_transaccion}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(orden.fecha).toLocaleDateString('es-PE')}
                            </div>
                            <div className="mt-1">
                              {getPrioridadBadge(orden.prioridad)}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">
                                {orden.persona.nombre} {orden.persona.apellido_paterno}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {orden.persona.numero_documento}
                            </div>
                            {vehiculo && (
                              <div className="flex items-center gap-2 mt-1">
                                <Car className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  {vehiculo.placa} - {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {orden.trabajador_principal ? (
                            <div>
                              <div className="font-medium text-sm">
                                {orden.trabajador_principal.usuario.persona.nombre} {orden.trabajador_principal.usuario.persona.apellido_paterno}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {orden.trabajador_principal.codigo_empleado}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Sin asignar
                            </Badge>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>Progreso</span>
                              <span>{progreso}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              {(() => {
                                const bucket = Math.min(100, Math.max(0, Math.round(progreso / 5) * 5))
                                const widthClasses: Record<number,string> = {
                                  0:'w-0',5:'w-1/12',10:'w-1/6',15:'w-1/5',20:'w-1/5',25:'w-1/4',30:'w-1/3',35:'w-[35%]',40:'w-2/5',45:'w-[45%]',50:'w-1/2',55:'w-[55%]',60:'w-3/5',65:'w-[65%]',70:'w-7/10',75:'w-3/4',80:'w-4/5',85:'w-[85%]',90:'w-9/10',95:'w-[95%]',100:'w-full'
                                }
                                const colorClass = progreso === 100 ? 'bg-green-500' : progreso > 50 ? 'bg-blue-500' : 'bg-gray-400'
                                const widthClass = widthClasses[bucket] || 'w-full'
                                return <div className={`h-2 rounded-full transition-all ${colorClass} ${widthClass}`} data-progress={progreso} />
                              })()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {detallesCount} item{detallesCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-right">
                            <div className="font-semibold">{formatPrice(orden.total)}</div>
                            <div className="text-xs text-gray-500">
                              Incluye IGV
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {getEstadoBadge(orden.estado_orden)}
                          {orden.prioridad === 'urgente' && (
                            <div className="mt-1">
                              <AlertCircle className="w-4 h-4 text-red-500 inline" />
                            </div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onView(orden)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(orden)}
                              disabled={orden.estado_orden === 'entregado'}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {/* Botón enviar al Kanban si hay servicios sin tareas */}
                            {(() => {
                              const tieneServicioSinTarea = orden.detalles_transaccion.some((d:any) => d.producto?.tipo === 'servicio' && (!d.tareas || d.tareas.length === 0))
                              return tieneServicioSinTarea ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => enviarAlKanban(orden)}
                                  disabled={orden.estado_orden === 'entregado'}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <LayoutGrid className="w-4 h-4" />
                                </Button>
                              ) : null
                            })()}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => solicitarEliminacion(orden)}
                              disabled={orden.estado_orden === 'entregado'}
                              className="text-red-600 hover:text-red-700"
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
                <div className="text-sm text-gray-500">
                  Mostrando {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} de {pagination.total} órdenes
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
    <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar Orden</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {ordenAEliminar && (
            <div className="p-3 bg-red-50 rounded border border-red-200 text-sm">
              ¿Seguro que deseas eliminar la orden
              {' '}<span className="font-semibold">{ordenAEliminar.codigo_transaccion}</span>?<br />
              Esta acción la ocultará de la lista (borrado lógico).
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setOrdenAEliminar(null) }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarEliminacion}>Eliminar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}