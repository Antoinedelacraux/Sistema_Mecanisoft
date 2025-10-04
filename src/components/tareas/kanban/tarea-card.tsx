'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { TareaCompleta } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import {
  Clock,
  User,
  Car,
  Play,
  Pause,
  Check,
  AlertTriangle,
  MessageSquare,
  Eye,
  Timer,
  GripVertical
} from 'lucide-react'

interface TareaCardProps {
  tarea: TareaCompleta
  isDragging?: boolean
  onUpdateTarea: (partial?: Partial<TareaCompleta>) => void
}

export function TareaCard({ tarea, isDragging = false, onUpdateTarea }: TareaCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notas, setNotas] = useState(tarea.notas_trabajador || '')
  const [loading, setLoading] = useState(false)
  
  const { toast } = useToast()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: tarea.id_tarea.toString(), disabled: tarea.estado === 'completado' })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1
  } as React.CSSProperties

  // Extraer información del vehículo
  const vehiculo = (tarea as any)?.detalle_transaccion?.transaccion?.transaccion_vehiculos?.[0]?.vehiculo
  const cliente = (tarea as any)?.detalle_transaccion?.transaccion?.persona

  const updateTareaEstado = async (nuevoEstado: string, notasAdicionales?: string) => {
    // Optimista
    const prevEstado = tarea.estado
    if (prevEstado !== nuevoEstado) {
      onUpdateTarea({ estado: nuevoEstado })
    }
    setLoading(true)
    try {
      const body = nuevoEstado === 'pausado'
        ? { action: 'pausar' }
        : {
            action: 'cambiar_estado',
            estado: nuevoEstado,
            ...(notasAdicionales && { notas_trabajador: notasAdicionales })
          }
      const response = await fetch(`/api/tareas/${tarea.id_tarea}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Error al actualizar tarea')
      const accion = {
        'en_proceso': 'iniciada',
        'pendiente': 'puesta en espera',
        'pausado': 'pausada',
        'completado': 'completada'
      }[nuevoEstado] || 'actualizada'
      toast({
        title: `Tarea ${accion}`,
        description: `${tarea.detalle_transaccion.producto.nombre} ha sido ${accion}`
      })
      const now = new Date().toISOString() as any
      const partial: Partial<TareaCompleta> = {}
      if (nuevoEstado === 'en_proceso' && !tarea.fecha_inicio) partial.fecha_inicio = now
      if (nuevoEstado === 'completado' && !tarea.fecha_fin) partial.fecha_fin = now
      if (notasAdicionales) partial.notas_trabajador = notasAdicionales
      if (Object.keys(partial).length) onUpdateTarea(partial)
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la tarea', variant: 'destructive' })
      // revertir visual si hicimos cambios locales (por ahora no mutamos tarea local directamente)
      onUpdateTarea({ estado: prevEstado })
    } finally {
      setLoading(false)
    }
  }

  const handleIniciar = () => updateTareaEstado('en_proceso')
  const handlePausar = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tareas/${tarea.id_tarea}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pausar' })
      })
      if (!response.ok) throw new Error('Error al pausar tarea')
      toast({ title: 'Tarea pausada', description: `${tarea.detalle_transaccion.producto.nombre} pausada` })
  onUpdateTarea({ estado: 'pausado' })
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo pausar la tarea', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }
  const handleCompletar = () => {
    if (notas.trim()) {
      updateTareaEstado('completado', notas)
      setShowNotes(false)
    } else {
      setShowNotes(true)
    }
  }

  const handleSaveNotes = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tareas/${tarea.id_tarea}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cambiar_estado',
          estado: 'completado',
          notas_trabajador: notas
        })
      })

      if (!response.ok) throw new Error('Error al guardar notas')

      toast({
        title: "Tarea completada",
        description: "Tarea marcada como completada con notas",
      })

      setShowNotes(false)
  onUpdateTarea({ estado: 'completado', notas_trabajador: notas })
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al completar la tarea",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateProgress = () => {
    if (!tarea.tiempo_estimado) return 0
    return Math.min((tarea.tiempo_real || 0) / tarea.tiempo_estimado * 100, 100)
  }

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={`group hover:shadow-md transition-shadow relative ${isDragging ? 'shadow-lg' : ''} ${tarea.estado === 'completado' ? '' : ''}`}
      >
        {/* Botón de detalles prioridad (esquina superior derecha) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setShowDetails(d => !d) }}
          aria-label={showDetails ? 'Ocultar detalles' : 'Ver detalles'}
          className={`h-8 w-8 p-0 absolute top-1 right-1 rounded-full transition-colors ${showDetails ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'} `}
        >
          <Eye className="w-4 h-4" />
        </Button>

        <CardContent className="p-4 space-y-3">
          {/* Header con prioridad */}
          <div className="flex items-start">
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  #{tarea.detalle_transaccion.transaccion.codigo_transaccion}
                </Badge>
                <Badge 
                  className={`text-xs ${getPriorityColor(tarea.detalle_transaccion.transaccion.prioridad)}`}
                  variant="secondary"
                >
                  {tarea.detalle_transaccion.transaccion.prioridad.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 pt-1">
              {tarea.estado !== 'completado' && (
                <button
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 cursor-grab active:cursor-grabbing"
                  aria-label="Arrastrar tarea"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Cliente y vehículo */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-medium">
                {cliente.nombre} {cliente.apellido_paterno}
              </span>
            </div>
            {vehiculo && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Car className="w-4 h-4 text-gray-400" />
                <span>{vehiculo.placa} - {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}</span>
              </div>
            )}
          </div>

          {/* Servicio/Producto */}
          <div className="bg-white/50 p-2 rounded border">
            <p className="font-medium text-sm">{tarea.detalle_transaccion.producto.nombre}</p>
            <p className="text-xs text-gray-600">
              Cantidad: {tarea.detalle_transaccion.cantidad}
            </p>
          </div>

          {/* Tiempo */}
          {tarea.tiempo_estimado && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Tiempo
                </span>
                <span>
                  {formatTime(tarea.tiempo_real || 0)} / {formatTime(tarea.tiempo_estimado)}
                </span>
              </div>
              
              {/* Barra de progreso */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                {(() => {
                  const pct = Math.min(calculateProgress(), 100)
                  const bucket = Math.round(pct / 5) * 5
                  const widthClasses: Record<number,string> = {
                    0:'w-0',5:'w-1/12',10:'w-1/6',15:'w-[15%]',20:'w-1/5',25:'w-1/4',30:'w-[30%]',35:'w-[35%]',40:'w-2/5',45:'w-[45%]',50:'w-1/2',55:'w-[55%]',60:'w-3/5',65:'w-[65%]',70:'w-[70%]',75:'w-3/4',80:'w-4/5',85:'w-[85%]',90:'w-[90%]',95:'w-[95%]',100:'w-full'
                  }
                  const color = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-orange-500' : 'bg-blue-500'
                  return <div className={`h-2 rounded-full transition-all ${color} ${widthClasses[bucket] || 'w-full'}`} data-progress={pct}></div>
                })()}
              </div>
              
              {calculateProgress() > 100 && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  Excede tiempo estimado
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          {tarea.notas_trabajador && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <MessageSquare className="w-3 h-3" />
              <span>Tiene notas</span>
            </div>
          )}

          {/* Acciones según estado */}
          <div className="flex gap-1 pt-2">
            {(tarea.estado === 'pendiente') && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleIniciar()
                }}
                disabled={loading}
                className="flex-1 text-xs"
              >
                <Play className="w-3 h-3 mr-1" />
                Iniciar
              </Button>
            )}
            {tarea.estado === 'pausado' && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleIniciar()
                }}
                disabled={loading}
                className="flex-1 text-xs"
              >
                <Play className="w-3 h-3 mr-1" />
                Reanudar
              </Button>
            )}
            
            {tarea.estado === 'en_proceso' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePausar()
                  }}
                  disabled={loading}
                  className="flex-1 text-xs"
                >
                  <Pause className="w-3 h-3 mr-1" />
                  Pausar
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCompletar()
                  }}
                  disabled={loading}
                  className="flex-1 text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Completar
                </Button>
              </>
            )}
            
            {tarea.estado === 'completado' && (
              <div className="flex-1 text-center py-1">
                <span className="text-xs text-green-600 font-medium">
                  ✅ Completado
                </span>
              </div>
            )}
            
            {/* Estado verificado removido hasta que el backend lo soporte */}
          </div>
          {/* Detalles inline (toggle con el ojo) */}
          {showDetails && (
            <div className="mt-3 space-y-2 text-xs border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold">Orden:</span> #{tarea.detalle_transaccion.transaccion.codigo_transaccion}
                </div>
                <div>
                  <span className="font-semibold">Prioridad:</span> {tarea.detalle_transaccion.transaccion.prioridad.toUpperCase()}
                </div>
                {tarea.fecha_inicio && (
                  <div>
                    <span className="font-semibold">Inicio:</span> {new Date(tarea.fecha_inicio).toLocaleString('es-PE')}
                  </div>
                )}
                {tarea.fecha_fin && (
                  <div>
                    <span className="font-semibold">Fin:</span> {new Date(tarea.fecha_fin).toLocaleString('es-PE')}
                  </div>
                )}
              </div>
              {vehiculo && (
                <div>
                  <span className="font-semibold">Vehículo:</span> {vehiculo.placa} - {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}
                </div>
              )}
              <div>
                <span className="font-semibold">Servicio:</span> {tarea.detalle_transaccion.producto.nombre}
              </div>
              <div>
                <span className="font-semibold">Tiempo:</span> {formatTime(tarea.tiempo_real || 0)} / {formatTime(tarea.tiempo_estimado || 0)}
              </div>
              <div>
                <span className="font-semibold">Asignado:</span> {tarea.trabajador.usuario.persona.nombre} {tarea.trabajador.usuario.persona.apellido_paterno}
              </div>
              {tarea.notas_trabajador && (
                <div className="bg-blue-50 p-2 rounded">
                  <span className="font-semibold">Notas:</span> {tarea.notas_trabajador}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para notas al completar */}
      <Dialog open={showNotes} onOpenChange={setShowNotes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Tarea</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="mb-2">
                <strong>Servicio:</strong> {tarea.detalle_transaccion.producto.nombre}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Agrega notas sobre el trabajo realizado (opcional):
              </p>
            </div>
            
            <div>
              <Label htmlFor="notas">Notas del Trabajo</Label>
              <Textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Describe el trabajo realizado, piezas reemplazadas, observaciones..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowNotes(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveNotes}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Completar Tarea'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  function formatTime(minutes: number): string {
    if (!minutes) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  function getPriorityColor(prioridad: string): string {
    const colors = {
      'baja': 'bg-gray-100 text-gray-800',
      'media': 'bg-blue-100 text-blue-800', 
      'alta': 'bg-orange-100 text-orange-800',
      'urgente': 'bg-red-100 text-red-800'
    }
    return colors[prioridad as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }
}