'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Search, Plus, Edit, Eye, FileText, Check, X, ArrowRight } from 'lucide-react'
import { CotizacionCompleta } from '@/types'
// Nota: evitamos importar Decimal del runtime de Prisma en componentes cliente para no romper el bundling
import { useToast } from '@/components/ui/use-toast'

interface CotizacionesTableProps {
  onEdit: (cotizacion: CotizacionCompleta) => void
  onView: (cotizacion: CotizacionCompleta) => void
  onCreateNew: () => void
  refreshTrigger?: number
}

export function CotizacionesTable({ onEdit, onView, onCreateNew, refreshTrigger }: CotizacionesTableProps) {
  const [cotizaciones, setCotizaciones] = useState<CotizacionCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // Valores centinela para evitar usar value="" en SelectItem (Radix lo reserva para limpiar selección)
  const ALL_ESTADOS = '__ALL_ESTADOS__'
  const NO_TRABAJADOR = '__NO_TRABAJADOR__'
  const [estadoFilter, setEstadoFilter] = useState(ALL_ESTADOS)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedCotizacion, setSelectedCotizacion] = useState<CotizacionCompleta | null>(null)
  const [comentarios, setComentarios] = useState('')
  // null => modo aprobar; string (incl "") => modo rechazar
  const [razonRechazo, setRazonRechazo] = useState<string | null>(null)
  const [trabajadorAsignado, setTrabajadorAsignado] = useState('')
  const [prioridadOrden, setPrioridadOrden] = useState('media')
  
  const { toast } = useToast()

  const fetchCotizaciones = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        ...(search && { search }),
        ...(estadoFilter !== ALL_ESTADOS && { estado: estadoFilter })
      })

      const response = await fetch(`/api/cotizaciones?${params}`)
      if (!response.ok) throw new Error('Error al cargar cotizaciones')

      const data = await response.json()
      setCotizaciones(data.cotizaciones)
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "Error al cargar las cotizaciones",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [search, estadoFilter, toast])

  useEffect(() => {
    fetchCotizaciones()
  }, [fetchCotizaciones])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchCotizaciones()
    }
  }, [refreshTrigger, fetchCotizaciones])

  // Helper único para convertir valores numéricos (evita usar Decimal del runtime)
  const toNumber = (v: any): number => {
    if (v == null) return 0
    if (typeof v === 'number') return isNaN(v) ? 0 : v
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
    // Intentar toString seguro
    if (typeof v === 'object' && v.toString) {
      const s = v.toString()
      const n = Number(s)
      if (!isNaN(n)) return n
    }
    const fallback = Number(v)
    return isNaN(fallback) ? 0 : fallback
  }

  const handleAprobar = (cotizacion: CotizacionCompleta) => {
    setSelectedCotizacion(cotizacion)
    setComentarios('')
    setRazonRechazo(null) // asegurar modo aprobar
    setShowApprovalModal(true)
  }

  const handleRechazar = (cotizacion: CotizacionCompleta) => {
    setSelectedCotizacion(cotizacion)
    setComentarios('')
    setRazonRechazo('') // cualquier string indica modo rechazar
    setShowApprovalModal(true)
  }

  const handleConvertirOrden = (cotizacion: CotizacionCompleta) => {
    setSelectedCotizacion(cotizacion)
    setTrabajadorAsignado('')
    setPrioridadOrden('media')
    setShowConvertModal(true)
  }

  const confirmarAprobacion = async (accion: 'aprobar' | 'rechazar') => {
    if (!selectedCotizacion) return
    try {
      const body: any = { action: accion, comentarios }
      if (accion === 'rechazar') body.razon_rechazo = razonRechazo
      const response = await fetch(`/api/cotizaciones/${selectedCotizacion.id_cotizacion}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Error al actualizar cotización')
      toast({
        title: accion === 'aprobar' ? 'Cotización aprobada' : 'Cotización rechazada',
        description: `${selectedCotizacion.codigo_cotizacion} ${accion === 'aprobar' ? 'ha sido aprobada' : 'ha sido rechazada'}`
      })
      setShowApprovalModal(false)
      fetchCotizaciones()
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' })
    }
  }

  const enviarCotizacion = async (cotizacion: CotizacionCompleta) => {
    try {
      const response = await fetch(`/api/cotizaciones/${cotizacion.id_cotizacion}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar' })
      })
      if (!response.ok) throw new Error('Error al enviar cotización')
      toast({ title: 'Cotización enviada', description: `${cotizacion.codigo_cotizacion} ha pasado a estado ENVIADA` })
      fetchCotizaciones()
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo enviar la cotización', variant: 'destructive' })
    }
  }

  const confirmarConversion = async () => {
    if (!selectedCotizacion) return

    try {
      const response = await fetch(`/api/cotizaciones/${selectedCotizacion.id_cotizacion}/convertir-orden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_trabajador_principal: trabajadorAsignado || null,
          prioridad: prioridadOrden,
          observaciones: comentarios
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al convertir cotización')
      }

      const result = await response.json()

      toast({
        title: "Orden creada exitosamente",
        description: `Cotización ${selectedCotizacion.codigo_cotizacion} convertida a orden ${result.orden_codigo}`,
      })

      setShowConvertModal(false)
      fetchCotizaciones()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges = {
      'borrador': { label: 'Borrador', className: 'bg-gray-100 text-gray-800' },
      'enviada': { label: 'Enviada', className: 'bg-blue-100 text-blue-800' },
      'aprobada': { label: 'Aprobada', className: 'bg-green-100 text-green-800' },
      'rechazada': { label: 'Rechazada', className: 'bg-red-100 text-red-800' },
      'vencida': { label: 'Vencida', className: 'bg-orange-100 text-orange-800' }
    }
    const badge = badges[estado as keyof typeof badges] || { label: estado, className: 'bg-gray-100 text-gray-800' }
    return <Badge className={badge.className} variant="secondary">{badge.label}</Badge>
  }

  const formatPrice = (priceLike: any) => {
    const price = toNumber(priceLike) || 0
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(price)
  }

  const isVencida = (vigenciaHastaLike: any) => {
    const date = vigenciaHastaLike instanceof Date ? vigenciaHastaLike : new Date(vigenciaHastaLike)
    return date < new Date()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cotizaciones</CardTitle>
              <CardDescription>
                Gestiona las cotizaciones y convierte a órdenes de trabajo
              </CardDescription>
            </div>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cotización
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filtros */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por código, cliente, placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ESTADOS}>Todos</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{cotizaciones.length}</div>
              <div className="text-sm text-blue-600">Total</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-lg font-bold text-yellow-600">
                {cotizaciones.filter(c => c.estado === 'enviada').length}
              </div>
              <div className="text-sm text-yellow-600">Enviadas</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {cotizaciones.filter(c => c.estado === 'aprobada').length}
              </div>
              <div className="text-sm text-green-600">Aprobadas</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">
                {cotizaciones.filter(c => c.estado === 'rechazada').length}
              </div>
              <div className="text-sm text-red-600">Rechazadas</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                {cotizaciones.filter(c => isVencida(c.vigencia_hasta)).length}
              </div>
              <div className="text-sm text-orange-600">Vencidas</div>
            </div>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Cargando cotizaciones...</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cotización</TableHead>
                    <TableHead>Cliente / Vehículo</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizaciones.map((cotizacion) => (
                    <TableRow key={cotizacion.id_cotizacion}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{cotizacion.codigo_cotizacion}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(cotizacion.created_at).toLocaleDateString('es-PE')}
                          </div>
                          <div className="text-xs text-gray-500">
                            Por: {cotizacion.usuario.persona.nombre}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {cotizacion.cliente.persona.nombre} {cotizacion.cliente.persona.apellido_paterno}
                          </div>
                          <div className="text-sm text-gray-500">
                            {cotizacion.cliente.persona.numero_documento}
                          </div>
                          <div className="text-sm text-blue-600">
                            🚗 {cotizacion.vehiculo.placa} - {cotizacion.vehiculo.modelo.marca.nombre_marca}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-semibold text-lg">{formatPrice(cotizacion.total)}</div>
                          <div className="text-xs text-gray-500">
                            {(cotizacion as any)._count?.detalle_cotizacion ?? cotizacion.detalle_cotizacion.length} item{(((cotizacion as any)._count?.detalle_cotizacion) ?? cotizacion.detalle_cotizacion.length) !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="text-sm">
                            {new Date(cotizacion.vigencia_hasta).toLocaleDateString('es-PE')}
                          </div>
                          {isVencida(cotizacion.vigencia_hasta) && cotizacion.estado === 'enviada' && (
                            <Badge variant="destructive" className="text-xs mt-1">
                              Vencida
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {getEstadoBadge(cotizacion.estado)}
                        {cotizacion.estado === 'aprobada' && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800">
                              Lista para orden
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(cotizacion)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {cotizacion.estado === 'borrador' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => enviarCotizacion(cotizacion)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          )}
                          {cotizacion.estado === 'enviada' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAprobar(cotizacion)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRechazar(cotizacion)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          
                          {cotizacion.estado === 'aprobada' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConvertirOrden(cotizacion)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {cotizacion.estado === 'borrador' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(cotizacion)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de aprobación/rechazo */}
      <Dialog open={showApprovalModal} onOpenChange={(o) => { if(!o) { setRazonRechazo(null); } setShowApprovalModal(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {razonRechazo === null ? 'Aprobar Cotización' : 'Rechazar Cotización'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
                  {selectedCotizacion && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedCotizacion.codigo_cotizacion}</p>
                <p className="text-sm text-gray-600">
                  {selectedCotizacion.cliente.persona.nombre} {selectedCotizacion.cliente.persona.apellido_paterno} - {formatPrice(selectedCotizacion.total)}
                </p>
              </div>
            )}

            {razonRechazo !== null && (
              <div>
                <Label>Razón del Rechazo</Label>
                <Select value={razonRechazo} onValueChange={setRazonRechazo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar razón" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="precio_alto">Precio muy alto</SelectItem>
                    <SelectItem value="no_urgente">No es urgente</SelectItem>
                    <SelectItem value="busca_opciones">Buscará otras opciones</SelectItem>
                    <SelectItem value="sin_presupuesto">Sin presupuesto</SelectItem>
                    <SelectItem value="otro">Otro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Comentarios del Cliente</Label>
              <Textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Observaciones del cliente sobre la cotización..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowApprovalModal(false); setRazonRechazo(null); }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => confirmarAprobacion(razonRechazo !== null ? 'rechazar' : 'aprobar')}
                variant={razonRechazo !== null ? 'destructive' : 'default'}
              >
                {razonRechazo !== null ? 'Rechazar' : 'Aprobar'} Cotización
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de conversión a orden */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Orden de Trabajo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
                {selectedCotizacion && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="font-medium text-green-800">{selectedCotizacion.codigo_cotizacion}</p>
                <p className="text-sm text-green-600">
                  Cotización aprobada - {formatPrice(selectedCotizacion.total)}
                </p>
              </div>
            )}

            <div>
              <Label>Mecánico Responsable (Opcional)</Label>
              <Select value={trabajadorAsignado} onValueChange={setTrabajadorAsignado}>
                <SelectTrigger>
                  <SelectValue placeholder="Asignar después" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRABAJADOR}>Sin asignar</SelectItem>
                  {/* Aquí cargaremos trabajadores */}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridad de la Orden</Label>
              <Select value={prioridadOrden} onValueChange={setPrioridadOrden}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observaciones Adicionales</Label>
              <Textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Observaciones adicionales para la orden de trabajo..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConvertModal(false)}
              >
                Cancelar
              </Button>
              <Button onClick={confirmarConversion}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Crear Orden
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  // Eliminadas funciones duplicadas al final (uso helpers internos arriba)
}