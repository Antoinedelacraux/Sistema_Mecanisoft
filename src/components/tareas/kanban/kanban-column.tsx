'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TareaCompleta } from '@/types'
import { TareaCard } from './tarea-card'

interface KanbanColumnProps {
  columna: { id: string; title: string; color: string; textColor: string; icon: string }
  tareas: TareaCompleta[]
  onUpdateTareaLocal: (id: number, partial: Partial<TareaCompleta>) => void
  onRefetch: () => void
}

export function KanbanColumn({ columna, tareas, onUpdateTareaLocal, onRefetch }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columna.id,
  })

  return (
    <Card className={`${columna.color} ${isOver ? 'ring-2 ring-blue-400' : ''} transition-all`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-sm font-medium ${columna.textColor} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{columna.icon}</span>
            {columna.title}
          </div>
          <Badge variant="secondary" className="ml-2">
            {tareas.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div
          ref={setNodeRef}
          className="space-y-3 min-h-[200px] pb-4"
        >
          <SortableContext 
            items={tareas.map(t => t.id_tarea.toString())} 
            strategy={verticalListSortingStrategy}
          >
            {tareas.map((tarea) => (
              <TareaCard
                key={tarea.id_tarea}
                tarea={tarea}
                onUpdateTarea={(partial) => {
                  if (partial) onUpdateTareaLocal(tarea.id_tarea, partial)
                  // Sincronizar tiempos y otros campos desde backend (ligero)
                  onRefetch()
                }}
              />
            ))}
          </SortableContext>
          
          {tareas.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">{columna.icon}</div>
              <p className="text-sm">No hay tareas</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}