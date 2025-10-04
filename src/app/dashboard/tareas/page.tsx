'use client'

import { TareasKanban } from '@/components/tareas/kanban/tareas-kanban'

export default function TareasPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Tareas</h1>
        <p className="text-gray-600 mt-2">
          Tablero Kanban para gestionar las tareas del taller
        </p>
      </div>

      {/* Kanban Board */}
      <TareasKanban />
    </div>
  )
}