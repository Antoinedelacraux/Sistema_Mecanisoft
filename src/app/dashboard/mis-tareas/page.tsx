'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { TareasKanban } from '@/components/tareas/kanban/tareas-kanban'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrabajadorCompleto } from '@/types'

export default function MisTareasPage() {
  const { data: session } = useSession()
  const [trabajador, setTrabajador] = useState<TrabajadorCompleto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrabajador = async () => {
      if (!session?.user?.id) return

      try {
        // Buscar si el usuario actual es un trabajador
        const response = await fetch(`/api/trabajadores?usuario_id=${session.user.id}`)
        const data = await response.json()
        
        if (data.trabajadores && data.trabajadores.length > 0) {
          setTrabajador(data.trabajadores[0])
        }
      } catch (error) {
        console.error('Error cargando trabajador:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrabajador()
  }, [session])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Cargando tus tareas...</p>
        </div>
      </div>
    )
  }

  if (!trabajador) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso Restringido</CardTitle>
          <CardDescription>
            Esta sección es solo para trabajadores del taller
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Tu usuario no tiene un perfil de trabajador asignado. 
            Contacta al administrador para obtener acceso.
          </p>
        </CardContent>
      </Card>
    )
  }

  const persona = trabajador.usuario?.persona ?? trabajador.persona

  return (
    <div className="space-y-6">
      {/* Header personalizado */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Mis Tareas - {trabajador.codigo_empleado}
        </h1>
        <p className="text-gray-600 mt-2">
          Hola {persona.nombre}, aquí están tus tareas asignadas
        </p>
        
        {/* Info del trabajador */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Especialidad:</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
              {trabajador.especialidad}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Nivel:</span>
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
              {trabajador.nivel_experiencia}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban personalizado */}
      <TareasKanban 
        trabajadorId={trabajador.id_trabajador}
        vistaPersonal={true}
      />
    </div>
  )
}