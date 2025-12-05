
"use client";
import { OrdenEditModal } from './table/OrdenEditModal'
import { OrdenDeleteModal } from './table/OrdenDeleteModal'
import { OrdenesTableRow } from './table/OrdenesTableRow'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Edit, Eye, Clock, User, Car, AlertCircle, Trash2, LayoutGrid } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { TrabajadorCompleto } from '@/types'

// Tipo temporal hasta que definamos OrdenCompleta
export interface OrdenCompleta {
  id_transaccion: number
  codigo_transaccion: string
  fecha: string
  estado_orden: string
  prioridad: string
  total: number
  observaciones?: string
  persona: {
    nombre: string
    apellido_paterno: string
    numero_documento: string
  }
  trabajador_principal?: {
    id_trabajador: number
    codigo_empleado: string
    persona?: {
      nombre: string
      apellido_paterno: string
    } | null
    usuario?: {
      persona?: {
        nombre: string
        apellido_paterno: string
      } | null
    } | null
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
  // Estado para edición de orden
  const [showEditModal, setShowEditModal] = useState(false)
  const [ordenAEditar, setOrdenAEditar] = useState<OrdenCompleta | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [trabajadores, setTrabajadores] = useState<TrabajadorCompleto[]>([])
  const [ordenes, setOrdenes] = useState<OrdenCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // Usamos valores centinela en lugar de string vacío para evitar el error de Radix Select
  const ALL_ESTADOS = '__ALL_ESTADOS__'
  const ALL_PRIORIDADES = '__ALL_PRIORIDADES__'
  const [estadoFilter, setEstadoFilter] = useState(ALL_ESTADOS)
  const [prioridadFilter, setPrioridadFilter] = useState(ALL_PRIORIDADES)
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    current: 1,
    limit: 10
  })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [ordenAEliminar, setOrdenAEliminar] = useState<OrdenCompleta | null>(null)
  const [facturacionLoadingId, setFacturacionLoadingId] = useState<number | null>(null)
  const [facturacionDisponible, setFacturacionDisponible] = useState<boolean | null>(null)
  const [facturacionEstadoMensaje, setFacturacionEstadoMensaje] = useState<string | null>(null)
  
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
        ,...(dateFilter && { date: dateFilter })
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

  const fetchTrabajadores = useCallback(async () => {
    try {
      const response = await fetch('/api/trabajadores?solo_activos=true', { credentials: 'include' })
      if (!response.ok) throw new Error('Error al cargar mecánicos')
      const data = await response.json()
      setTrabajadores(Array.isArray(data.trabajadores) ? data.trabajadores : [])
    } catch (error) {
      console.error('Error obteniendo trabajadores:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los mecánicos disponibles.',
        variant: 'destructive'
      })
    }
  }, [toast])

  useEffect(() => {
    fetchTrabajadores()
  }, [fetchTrabajadores])

  useEffect(() => {
    let cancelled = false
    const fetchEstadoFacturacion = async () => {
      try {
        const response = await fetch('/api/facturacion/status', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('No se pudo verificar el estado de facturación')
        }
        const data = await response.json()
        if (!cancelled) {
          setFacturacionDisponible(Boolean(data.habilitada))
          setFacturacionEstadoMensaje(typeof data.reason === 'string' ? data.reason : null)
        }
      } catch (error) {
        console.error('Error verificando estado de facturación', error)
        if (!cancelled) {
          setFacturacionDisponible(null)
          setFacturacionEstadoMensaje(null)
        }
      }
    }

    fetchEstadoFacturacion()
    return () => {
      cancelled = true
    }
  }, [])

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
      'por_hacer': { label: 'Por Hacer', className: 'bg-gray-100 text-gray-800' },
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

  const formatDurationRange = (minMin: number, maxMin: number) => {
    if (!Number.isFinite(minMin) || !Number.isFinite(maxMin) || minMin <= 0 || maxMin <= 0) return '—'
    const units = [
      { label: 'min', factor: 1 },
      { label: 'h', factor: 60 },
      { label: 'd', factor: 60 * 24 },
      { label: 'sem', factor: 60 * 24 * 7 }
    ]
    // escoger unidad que deje números legibles
    const pick = (val: number) => {
      if (val >= units[3].factor) return units[3]
      if (val >= units[2].factor) return units[2]
      if (val >= units[1].factor) return units[1]
      return units[0]
    }
    const unit = pick(maxMin)
    const f = unit.factor
    const minVal = Math.round((minMin / f) * 10) / 10
    const maxVal = Math.round((maxMin / f) * 10) / 10
    return `${minVal}–${maxVal} ${unit.label}`
  }

  // Enviar orden al Kanban: genera tareas faltantes para servicios si hay trabajador principal
  const enviarAlKanban = async (orden: OrdenCompleta) => {
    // Validar que tenga al menos un servicio
    const tieneServicio = orden.detalles_transaccion.some((d:any) => d.producto?.tipo === 'servicio' || d.tareas?.length > 0)
    if (!tieneServicio) {
      toast({
        title: 'Servicios requeridos',
        description: 'La orden debe tener al menos un servicio registrado.',
        variant: 'destructive'
      })
      return
    }
    // Validar que tenga mecánico principal
    if (!orden.trabajador_principal) {
      toast({
        title: 'Asignar mecánico',
        description: 'Primero asigna un mecánico principal antes de enviar al tablero.',
        variant: 'destructive'
      })
      return
    }
    // Solo si está pendiente o asignado
    if (!['pendiente', 'asignado'].includes(orden.estado_orden)) {
      toast({
        title: 'Estado inválido',
        description: 'Solo puedes enviar órdenes pendientes o asignadas al Kanban.',
        variant: 'destructive'
      })
      return
    }
    try {
      const body: any = { id_transaccion: orden.id_transaccion, nuevo_estado: 'por_hacer', generar_tareas_faltantes: true }
      const resp = await fetch('/api/ordenes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({}))
        throw new Error(err.error || 'No se pudo enviar al Kanban')
      }
      toast({ title: 'Orden enviada al Kanban', description: `${orden.codigo_transaccion} ahora está en Por hacer.` })
      fetchOrdenes()
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const enviarAFacturacion = async (orden: OrdenCompleta) => {
    if (orden.estado_orden !== 'completado') {
      toast({
        title: 'Estado inválido',
        description: 'Solo las órdenes completadas pueden enviarse a facturación.',
        variant: 'destructive'
      })
      return
    }

  const tipoComprobante = orden.persona.numero_documento?.length === 11 ? 'FACTURA' : 'BOLETA'
  const tipoComprobanteLabel = tipoComprobante.toLowerCase()

    if (facturacionDisponible === false) {
      toast({
        title: 'Facturación deshabilitada',
        description: facturacionEstadoMensaje ?? 'Habilita FACTURACION_HABILITADA=true y configura las credenciales para usar este módulo.',
        variant: 'destructive'
      })
      return
    }

    try {
      setFacturacionLoadingId(orden.id_transaccion)

      const response = await fetch('/api/facturacion/comprobantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen_tipo: 'ORDEN',
          origen_id: orden.id_transaccion,
          override_tipo: tipoComprobante
        })
      })

      let data: any = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok || !data?.data) {
        let description = 'No se pudo enviar la orden a facturación.'
        if (data?.error) description = data.error
        throw new Error(description)
      }

      const borrador = data.data
      const numeroSerie = borrador?.serie && borrador?.numero
        ? `${borrador.serie}-${String(borrador.numero).padStart(8, '0')}`
        : null

      toast({
        title: 'Orden enviada a facturación',
        description:
          numeroSerie
            ? `Se creó el borrador ${numeroSerie} a partir de ${orden.codigo_transaccion}.`
            : data?.message || `La orden ${orden.codigo_transaccion} fue preparada para facturación (${tipoComprobanteLabel}).`
      })

      await fetchOrdenes()
    } catch (error) {
      console.error('Error enviando orden a facturación', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo conectar con el módulo de facturación.',
        variant: 'destructive'
      })
    } finally {
      setFacturacionLoadingId(null)
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
    <div className="space-y-0">
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
                <SelectItem value="por_hacer">Por Hacer</SelectItem>
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
            {/* Filtro por fecha */}
            <div className="w-36">
              <Input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} />
            </div>
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
              {ordenes.filter(o => o.estado_orden === 'pendiente' || o.estado_orden === 'asignado' || o.estado_orden === 'por_hacer').length}
            </div>
            <div className="text-sm text-yellow-600">Pendientes / Por Hacer</div>
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
                    <TableHead>Duración</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => (
                    <OrdenesTableRow
                      key={orden.id_transaccion}
                      orden={orden}
                      onView={onView}
                      onEdit={(orden) => {
                        setOrdenAEditar(orden)
                        setShowEditModal(true)
                      }}
                      onKanban={enviarAlKanban}
                      onFacturar={enviarAFacturacion}
                      onDelete={solicitarEliminacion}
                      facturacionLoadingId={facturacionLoadingId}
                      facturacionDisponible={facturacionDisponible}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
      </Card>
      <OrdenDeleteModal
      open={showDeleteModal}
      onClose={() => { setShowDeleteModal(false); setOrdenAEliminar(null) }}
      orden={ordenAEliminar}
      onConfirm={async () => { await confirmarEliminacion() }}
      />
      <OrdenEditModal
      open={showEditModal}
      onClose={() => { setShowEditModal(false); setOrdenAEditar(null) }}
      orden={ordenAEditar}
      loading={editLoading}
      trabajadores={trabajadores}
      onSave={async ({ prioridad, observaciones, id_trabajador_principal }) => {
        setEditLoading(true)
        try {
          const body: Record<string, unknown> = {
            id_transaccion: ordenAEditar?.id_transaccion,
            prioridad,
            observaciones
          }
          if (id_trabajador_principal) {
            body.asignar_trabajador = id_trabajador_principal
          }
          const resp = await fetch('/api/ordenes', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
          })
          if (!resp.ok) throw new Error('No se pudo actualizar la orden')
          toast({ title: 'Orden actualizada', description: `Orden ${ordenAEditar?.codigo_transaccion} actualizada correctamente` })
          setShowEditModal(false)
          setOrdenAEditar(null)
          await fetchOrdenes()
        } catch (err: any) {
          toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
          setEditLoading(false)
        }
      }}
      />
    </div>
  )
}