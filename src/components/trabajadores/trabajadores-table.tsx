'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Plus, Edit, Eye, ToggleLeft, ToggleRight, Wrench, User, Clock } from 'lucide-react'
import { TrabajadorCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface TrabajadoresTableProps {
  onEdit: (trabajador: TrabajadorCompleto) => void
  onView: (trabajador: TrabajadorCompleto) => void
  onCreateNew: () => void
  refreshTrigger?: number
}

export function TrabajadoresTable({ onEdit, onView, onCreateNew, refreshTrigger }: TrabajadoresTableProps) {
  const [trabajadores, setTrabajadores] = useState<TrabajadorCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  const { toast } = useToast()

  const fetchTrabajadores = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/trabajadores?include_inactive=true')
      if (!response.ok) throw new Error('Error al cargar trabajadores')

      const data = await response.json()
      setTrabajadores(data.trabajadores)
    } catch (error) {
      console.error('Error:', error)
      toast({
        title: "Error",
        description: "Error al cargar los trabajadores",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchTrabajadores()
  }, [fetchTrabajadores])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchTrabajadores()
    }
  }, [refreshTrigger, fetchTrabajadores])

  const handleToggleStatus = async (trabajador: TrabajadorCompleto) => {
    const newStatus = !trabajador.activo
    
    if (!confirm(`¿${newStatus ? 'Activar' : 'Desactivar'} al trabajador ${trabajador.usuario.persona.nombre}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/trabajadores/${trabajador.id_trabajador}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_status',
          activo: newStatus
        })
      })

      if (!response.ok) throw new Error('Error al cambiar estado')

      toast({
        title: `Trabajador ${newStatus ? 'activado' : 'desactivado'}`,
        description: `${trabajador.usuario.persona.nombre} ha sido ${newStatus ? 'activado' : 'desactivado'}`,
      })

      fetchTrabajadores()
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cambiar el estado",
        variant: "destructive",
      })
    }
  }

  const filteredTrabajadores = trabajadores.filter((trabajador) => {
    const nombre = (trabajador.usuario?.persona?.nombre ?? '').toLowerCase()
    const apellido = (trabajador.usuario?.persona?.apellido_paterno ?? '').toLowerCase()
    const codigo = (trabajador.codigo_empleado ?? '').toLowerCase()
    const especialidad = (trabajador.especialidad ?? '').toLowerCase()
    const q = search.toLowerCase()

    return (
      nombre.includes(q) ||
      apellido.includes(q) ||
      codigo.includes(q) ||
      especialidad.includes(q)
    )
  })

  const getEspecialidadBadge = (especialidad: string) => {
    const colores = {
      'Motor': 'bg-blue-100 text-blue-800',
      'Frenos': 'bg-red-100 text-red-800',
      'Eléctrico': 'bg-yellow-100 text-yellow-800',
      'Suspensión': 'bg-green-100 text-green-800',
      'Transmisión': 'bg-purple-100 text-purple-800',
      'General': 'bg-gray-100 text-gray-800'
    }
    return colores[especialidad as keyof typeof colores] || 'bg-gray-100 text-gray-800'
  }

  const getNivelBadge = (nivel: string) => {
    const colores = {
      'Junior': 'bg-blue-100 text-blue-800',
      'Senior': 'bg-green-100 text-green-800',
      'Especialista': 'bg-purple-100 text-purple-800'
    }
    return colores[nivel as keyof typeof colores] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Trabajadores</CardTitle>
            <CardDescription>
              Administra los mecánicos y trabajadores del taller
            </CardDescription>
          </div>
          <Button onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Trabajador
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Barra de búsqueda */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre, código o especialidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <User className="w-6 h-6 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{trabajadores.length}</div>
            <div className="text-sm text-blue-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {trabajadores.filter(t => t.activo).length}
            </div>
            <div className="text-sm text-green-600">Activos</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <Wrench className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-yellow-600">
              {trabajadores.reduce((sum, t) => sum + t._count.tareas_asignadas, 0)}
            </div>
            <div className="text-sm text-yellow-600">Tareas Asignadas</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Clock className="w-6 h-6 text-purple-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-purple-600">
              {trabajadores.filter(t => t.nivel_experiencia === 'Especialista').length}
            </div>
            <div className="text-sm text-purple-600">Especialistas</div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Cargando trabajadores...</p>
            </div>
          </div>
        ) : filteredTrabajadores.length === 0 ? (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron trabajadores</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Carga Trabajo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrabajadores.map((trabajador) => (
                  <TableRow 
                    key={trabajador.id_trabajador}
                    className={!trabajador.activo ? "bg-gray-50 opacity-75" : ""}
                  >
                    <TableCell className={!trabajador.activo ? "text-gray-500" : ""}>
                      <div>
                        <div className="font-medium">
                          {trabajador.usuario?.persona?.nombre ?? ''} {trabajador.usuario?.persona?.apellido_paterno ?? ''}
                        </div>
                        <div className="text-sm text-gray-500">
                          {trabajador.usuario?.nombre_usuario ?? ''}
                        </div>
                        {trabajador.usuario.persona.telefono && (
                          <div className="text-sm text-gray-500">
                            📞 {trabajador.usuario.persona.telefono}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {trabajador.codigo_empleado ?? ''}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        className={getEspecialidadBadge(trabajador.especialidad)}
                        variant="secondary"
                      >
                        {trabajador.especialidad}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        className={getNivelBadge(trabajador.nivel_experiencia)}
                        variant="secondary"
                      >
                        {trabajador.nivel_experiencia}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div>{trabajador._count?.tareas_asignadas ?? 0} tareas</div>
                        <div className="text-gray-500">
                          {trabajador._count?.ordenes_principales ?? 0} órdenes
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant={trabajador.activo ? "default" : "secondary"}
                        className={trabajador.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                      >
                        {trabajador.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(trabajador)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(trabajador)}
                          disabled={!trabajador.activo}
                          className={!trabajador.activo ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(trabajador)}
                          className={trabajador.activo ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                        >
                          {trabajador.activo ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        </Button>
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
  )
}