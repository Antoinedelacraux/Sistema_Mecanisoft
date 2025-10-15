'use client'

import { useEffect, useState } from 'react'
import type { Rol } from '@prisma/client'
import { TrabajadoresTable } from '@/components/trabajadores/trabajadores-table'
import { TrabajadorForm } from '@/components/trabajadores/trabajador-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TrabajadorCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'

type ModalState = 'closed' | 'create' | 'edit' | 'view'

interface RolesResponse {
  roles: Rol[]
}

const fetchRoles = async (): Promise<Rol[]> => {
  const response = await fetch('/api/roles', {
    credentials: 'include',
    cache: 'no-store'
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.error ?? 'No se pudo obtener la lista de roles'
    throw new Error(message)
  }

  const data: RolesResponse = await response.json()
  return data.roles
}

export default function TrabajadoresPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedTrabajador, setSelectedTrabajador] = useState<TrabajadorCompleto | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [roles, setRoles] = useState<Rol[]>([])

  const { toast } = useToast()

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchRoles()
        setRoles(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al cargar roles'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      }
    }

    loadRoles()
  }, [toast])

  const handleCreateNew = () => {
    setSelectedTrabajador(undefined)
    setModalState('create')
  }

  const handleEdit = (trabajador: TrabajadorCompleto) => {
    setSelectedTrabajador(trabajador)
    setModalState('edit')
  }

  const handleView = (trabajador: TrabajadorCompleto) => {
    setSelectedTrabajador(trabajador)
    setModalState('view')
  }

  const handleSuccess = () => {
    setModalState('closed')
    setSelectedTrabajador(undefined)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancel = () => {
    setModalState('closed')
    setSelectedTrabajador(undefined)
  }

  // Helper para formatear montos que podrían venir como number, string o Prisma.Decimal
  const formatMonto = (valor: any): string => {
    if (valor == null) return '—'
    try {
      if (typeof valor === 'number') return valor.toFixed(2)
      if (typeof valor === 'string') {
        const n = Number(valor)
        return isNaN(n) ? valor : n.toFixed(2)
      }
      if (typeof valor === 'object') {
        if (typeof valor.toNumber === 'function') {
          const n = valor.toNumber()
          return typeof n === 'number' ? n.toFixed(2) : String(n)
        }
        if (typeof valor.toFixed === 'function') {
          return valor.toFixed(2)
        }
      }
    } catch (_) {
      // ignorar y continuar
    }
    return String(valor)
  }

  const renderTrabajadorDetalle = (trabajador: TrabajadorCompleto) => {
    const persona = trabajador.usuario?.persona ?? trabajador.persona
    const fechaIngreso = trabajador.fecha_ingreso ? new Date(trabajador.fecha_ingreso) : null
    const sueldo = trabajador.sueldo_mensual

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold">Detalles del Trabajador</h3>
          <p className="text-gray-600">Información completa del trabajador</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Información personal */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b pb-2">Información Personal</h4>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">Nombre Completo</p>
                <p>{persona.nombre} {persona.apellido_paterno ?? ''} {persona.apellido_materno ?? ''}</p>
              </div>
              <div>
                <p className="font-semibold">Documento</p>
                <p>{persona.tipo_documento}: {persona.numero_documento}</p>
              </div>
              {persona.telefono && (
                <div>
                  <p className="font-semibold">Teléfono</p>
                  <p>{persona.telefono}</p>
                </div>
              )}
              {persona.correo && (
                <div>
                  <p className="font-semibold">Correo</p>
                  <p>{persona.correo}</p>
                </div>
              )}
              {persona.direccion && (
                <div>
                  <p className="font-semibold">Dirección</p>
                  <p>{persona.direccion}</p>
                </div>
              )}
            </div>
          </div>

          {/* Información laboral */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b pb-2">Información Laboral</h4>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">Código de Empleado</p>
                <Badge variant="outline" className="font-mono text-lg">
                  {trabajador.codigo_empleado ?? ''}
                </Badge>
              </div>
              <div>
                <p className="font-semibold">Cargo</p>
                <p>{trabajador.cargo ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold">Rol del Sistema</p>
                <p>{trabajador.usuario?.rol?.nombre_rol ?? trabajador.cargo ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold">Especialidad</p>
                <Badge className="bg-blue-100 text-blue-800">
                  {normalizeEspecialidad(trabajador.especialidad, trabajador.usuario?.rol?.nombre_rol ?? trabajador.cargo)}
                </Badge>
              </div>
              <div>
                <p className="font-semibold">Nivel</p>
                <Badge className="bg-green-100 text-green-800">
                  {trabajador.nivel_experiencia ?? ''}
                </Badge>
              </div>
              <div>
                <p className="font-semibold">Fecha de Ingreso</p>
                <p>{fechaIngreso ? fechaIngreso.toLocaleDateString('es-PE') : '—'}</p>
              </div>
              <div>
                <p className="font-semibold">Sueldo Mensual</p>
                <p>{sueldo ? `S/ ${formatMonto(sueldo)}` : '—'}</p>
              </div>
            </div>
          </div>

          {/* Estadísticas de trabajo */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b pb-2">Estadísticas</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {trabajador._count?.tareas_asignadas ?? 0}
                </div>
                <div className="text-sm text-blue-600">Tareas Asignadas</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {trabajador._count?.ordenes_principales ?? 0}
                </div>
                <div className="text-sm text-green-600">Órdenes Principales</div>
              </div>
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b pb-2">Estado</h4>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${trabajador.activo ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={trabajador.activo ? 'text-green-600' : 'text-red-600'}>
                {trabajador.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trabajadores</h1>
        <p className="text-gray-600 mt-2">
          Gestiona los mecánicos y trabajadores del taller
        </p>
      </div>

      {/* Tabla principal */}
      <TrabajadoresTable
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onView={handleView}
        refreshTrigger={refreshTrigger}
      />

      {/* Modal para formularios */}
      <Dialog open={modalState !== 'closed'} onOpenChange={() => setModalState('closed')}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {/* Título accesible para screen readers (no se duplica visual con el contenido interno) */}
            <DialogTitle className="sr-only">
              {modalState === 'create' && 'Crear trabajador'}
              {modalState === 'edit' && 'Editar trabajador'}
              {modalState === 'view' && 'Detalles del trabajador'}
            </DialogTitle>
          </DialogHeader>
          {(modalState === 'create' || modalState === 'edit') && (
            <TrabajadorForm
              trabajador={selectedTrabajador}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              roles={roles}
            />
          )}
          
          {modalState === 'view' && selectedTrabajador && renderTrabajadorDetalle(selectedTrabajador)}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const normalizeLabel = (value?: string | null) => {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const normalizeEspecialidad = (especialidad?: string | null, rol?: string | null) => {
  const rolNormalizado = normalizeLabel(rol)
  if (rolNormalizado === normalizeLabel('Mecánico')) {
    return especialidad ?? 'General'
  }
  return especialidad ?? 'No aplica'
}