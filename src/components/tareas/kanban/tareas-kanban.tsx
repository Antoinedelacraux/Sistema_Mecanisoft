'use client'

import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from '@dnd-kit/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TareaCompleta, TrabajadorCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import { KanbanColumn } from './kanban-column'
import { TareaCard } from './tarea-card'
import { Clock, User, Filter } from 'lucide-react'

// Estados válidos actuales (deben coincidir con backend)
export const ESTADOS_TAREA = ['pendiente', 'en_proceso', 'pausado', 'completado'] as const
type EstadoTarea = typeof ESTADOS_TAREA[number]

const COLUMNAS_KANBAN: { id: EstadoTarea; title: string; color: string; textColor: string; icon: string }[] = [
  {
    id: 'pendiente',
    title: 'Por Hacer',
    color: 'bg-gray-50 border-gray-200',
    textColor: 'text-gray-700',
    icon: '⏳'
  },
  {
    id: 'en_proceso',
    title: 'En Proceso',
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
    icon: '🔧'
  },
  {
    id: 'pausado',
    title: 'Pausado',
    color: 'bg-yellow-50 border-yellow-200',
    textColor: 'text-yellow-700',
    icon: '⏸️'
  },
  {
    id: 'completado',
    title: 'Completado',
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    icon: '✅'
  }
]

interface TareasKanbanProps {
  trabajadorId?: number
  vistaPersonal?: boolean
}

export function TareasKanban({ trabajadorId, vistaPersonal = false }: TareasKanbanProps) {
  const ALL_TRABAJADORES = '__ALL__'
  const [tareas, setTareas] = useState<TareaCompleta[]>([])
  const [trabajadores, setTrabajadores] = useState<TrabajadorCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filtroTrabajador, setFiltroTrabajador] = useState<string>(
    trabajadorId?.toString() || ALL_TRABAJADORES
  )
  
  const { toast } = useToast()

  const fetchTareas = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams(
        filtroTrabajador && filtroTrabajador !== ALL_TRABAJADORES
          ? { trabajador_id: filtroTrabajador }
          : {}
      )

      const response = await fetch(`/api/tareas?${params.toString()}`)
      if (!response.ok) throw new Error('Error al cargar tareas')

      const data = await response.json()
      setTareas(data.tareas || [])
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "Error al cargar las tareas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [filtroTrabajador, toast])

  const fetchTrabajadores = useCallback(async () => {
    try {
      const response = await fetch('/api/trabajadores?solo_activos=true')
      const data = await response.json()
      setTrabajadores(data.trabajadores || [])
    } catch (error) {
      console.error('Error cargando trabajadores:', error)
    }
  }, [])

  useEffect(() => {
    fetchTareas()
    if (!vistaPersonal) {
      fetchTrabajadores()
    }
  }, [fetchTareas, fetchTrabajadores, vistaPersonal])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const tareaId = parseInt(active.id as string)
    const nuevoEstado = over.id as string
    if (!ESTADOS_TAREA.includes(nuevoEstado as EstadoTarea)) {
      toast({ title: 'Estado no válido', description: 'No se puede mover la tarea a esta columna', variant: 'destructive' })
      return
    }
    const tarea = tareas.find(t => t.id_tarea === tareaId)
    if (!tarea || tarea.estado === nuevoEstado) return
    // Validar transición permitida (evita mostrar error genérico desde backend)
    const transicionesPermitidas: Record<string, EstadoTarea[]> = {
      pendiente: ['en_proceso','pausado'],
      en_proceso: ['pausado','completado'],
      pausado: ['en_proceso','completado'],
      completado: []
    }
    if (!transicionesPermitidas[tarea.estado]?.includes(nuevoEstado as EstadoTarea)) {
      toast({
        title: 'Transición no permitida',
        description: `${tarea.estado} → ${nuevoEstado} no es válida`,
        variant: 'destructive'
      })
      return
    }
    // Optimistic update
    const previo = tareas
    setTareas(prev => prev.map(t => t.id_tarea === tareaId ? { ...t, estado: nuevoEstado } : t))
    try {
      const body = nuevoEstado === 'pausado'
        ? { action: 'pausar' }
        : { action: 'cambiar_estado', estado: nuevoEstado }
      const response = await fetch(`/api/tareas/${tareaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('fail')
      toast({ title: 'Estado actualizado', description: `Tarea movida a ${COLUMNAS_KANBAN.find(c => c.id === nuevoEstado)?.title}` })
      // Opcional: refetch para sync datos de tiempos
      fetchTareas()
    } catch (e) {
      // revert
      setTareas(previo)
      toast({ title: 'Error', description: 'No se pudo cambiar el estado', variant: 'destructive' })
    }
  }

  const getTareasPorEstado = (estado: EstadoTarea) => {
    const lista = tareas.filter(t => t.estado === estado)
    if (estado === 'completado') {
      return [...lista].sort((a,b) => {
        const fa = a.fecha_fin ? new Date(a.fecha_fin as any).getTime() : 0
        const fb = b.fecha_fin ? new Date(b.fecha_fin as any).getTime() : 0
        if (fb !== fa) return fb - fa
        return b.id_tarea - a.id_tarea
      })
    }
    return lista
  }

  // Actualización local parcial (optimista) de una tarea
  const updateTareaLocal = useCallback((id: number, partial: Partial<TareaCompleta>) => {
    setTareas(prev => prev.map(t => t.id_tarea === id ? { ...t, ...partial } : t))
  }, [])

  const activeTarea = activeId ? tareas.find(t => t.id_tarea === parseInt(activeId)) : null

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-6 h-6" />
                {vistaPersonal ? 'Mis Tareas' : 'Tablero de Tareas'}
              </CardTitle>
              <CardDescription>
                {vistaPersonal 
                  ? 'Gestiona tus tareas asignadas'
                  : 'Vista general de todas las tareas del taller'
                }
              </CardDescription>
            </div>

            {/* Filtros - Solo en vista general */}
            {!vistaPersonal && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Select value={filtroTrabajador} onValueChange={setFiltroTrabajador}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos los mecánicos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TRABAJADORES}>Todos los mecánicos</SelectItem>
                      {trabajadores.map((trabajador) => (
                        <SelectItem key={trabajador.id_trabajador} value={trabajador.id_trabajador.toString()}>
                          {trabajador.codigo_empleado} - {trabajador.usuario.persona.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-4 gap-4">
            {COLUMNAS_KANBAN.map((columna) => {
              const tareasEnColumna = getTareasPorEstado(columna.id)
              return (
                <div key={columna.id} className={`text-center p-3 rounded-lg border ${columna.color}`}>
                  <div className="text-2xl">{columna.icon}</div>
                  <div className="text-2xl font-bold">{tareasEnColumna.length}</div>
                  <div className="text-sm">{columna.title}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {COLUMNAS_KANBAN.map((columna) => {
            const tareasColumna = getTareasPorEstado(columna.id)
            
            return (
              <KanbanColumn
                key={columna.id}
                columna={columna}
                tareas={tareasColumna}
                onUpdateTareaLocal={updateTareaLocal}
                onRefetch={fetchTareas}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeTarea ? (
            <TareaCard 
              tarea={activeTarea} 
              isDragging={true}
              onUpdateTarea={() => fetchTareas()}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Actualizando tareas...</p>
          </div>
        </div>
      )}
    </div>
  )
}