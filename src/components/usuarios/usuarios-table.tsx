'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Eye,
  Lock,
  Mail,
  Pencil,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Users as UsersIcon,
  KeyRound
} from 'lucide-react'
import type { Rol } from '@prisma/client'
import type { UsuarioCompleto } from '@/types'

interface UsuariosTableProps {
  roles: Pick<Rol, 'id_rol' | 'nombre_rol'>[]
  onCreateNew: () => void
  onEdit: (usuario: UsuarioCompleto) => void
  onView: (usuario: UsuarioCompleto) => void
  refreshTrigger?: number
  onRequireRefresh?: () => void
}

interface PaginationState {
  total: number
  limit: number
  current: number
  pages: number
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

const buildQueryParams = (params: Record<string, string | number | boolean | null | undefined>) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, String(value))
  })
  return searchParams.toString()
}

export function UsuariosTable({ roles, onCreateNew, onEdit, onView, refreshTrigger, onRequireRefresh }: UsuariosTableProps) {
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    limit: 20,
    current: 1,
    pages: 1
  })
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos')
  const [rolFilter, setRolFilter] = useState<string>('todos')
  const [requiereCambio, setRequiereCambio] = useState<'todos' | 'si' | 'no'>('todos')
  const [pendientesEnvio, setPendientesEnvio] = useState<'todos' | 'si' | 'no'>('todos')
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null)

  const { toast } = useToast()

  const fetchUsuarios = useCallback(async () => {
    try {
      setLoading(true)
      const query = buildQueryParams({
        page,
        limit: pagination.limit,
        search: search.trim() || undefined,
        estado: estado === 'todos' ? undefined : estado,
  rol: rolFilter === 'todos' ? undefined : rolFilter,
        requiere_cambio: requiereCambio === 'todos' ? undefined : (requiereCambio === 'si'),
        pendientes_envio: pendientesEnvio === 'todos' ? undefined : (pendientesEnvio === 'si')
      })

      const response = await fetch(`/api/usuarios?${query}`, {
        credentials: 'include',
        cache: 'no-store'
      })

      if (!response.ok) {
        let message = 'No fue posible cargar los usuarios'
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch {
          const text = await response.text().catch(() => '')
          if (text) message = text
        }
        throw new Error(message)
      }

      const data = await response.json() as { usuarios: UsuarioCompleto[]; pagination: PaginationState }
      setUsuarios(data.usuarios)
      setPagination(data.pagination)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cargar los usuarios'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [estado, page, pagination.limit, pendientesEnvio, requiereCambio, rolFilter, search, toast])

  useEffect(() => {
    fetchUsuarios()
  }, [fetchUsuarios])

  useEffect(() => {
    if (!refreshTrigger) return
    fetchUsuarios()
  }, [refreshTrigger, fetchUsuarios])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleEstadoChange = (value: 'todos' | 'activos' | 'inactivos') => {
    setEstado(value)
    setPage(1)
  }

  const handleRolChange = (value: string) => {
    setRolFilter(value)
    setPage(1)
  }

  const handleRequiereCambioChange = (value: 'todos' | 'si' | 'no') => {
    setRequiereCambio(value)
    setPage(1)
  }

  const handlePendientesEnvioChange = (value: 'todos' | 'si' | 'no') => {
    setPendientesEnvio(value)
    setPage(1)
  }

  const handleRefetch = () => {
    fetchUsuarios()
    onRequireRefresh?.()
  }

  const confirmar = (mensaje: string) => {
    if (typeof window === 'undefined') return false
    return window.confirm(mensaje)
  }

  const promptInput = (mensaje: string, valorPorDefecto?: string | null) => {
    if (typeof window === 'undefined') return valorPorDefecto ?? ''
    const value = window.prompt(mensaje, valorPorDefecto ?? undefined)
    return value ?? ''
  }

  const handleToggleEstado = async (usuario: UsuarioCompleto) => {
    const nuevoEstado = !usuario.estado
    const accion = nuevoEstado ? 'activar' : 'bloquear'

    let motivo: string | null | undefined
    if (!nuevoEstado) {
      motivo = promptInput('Ingresa el motivo del bloqueo:', usuario.motivo_bloqueo ?? 'Bloqueo manual')
      if (!motivo) {
        toast({ title: 'Acción cancelada', description: 'Debes indicar un motivo para el bloqueo.' })
        return
      }
    }

    if (!confirmar(`¿Deseas ${accion} al usuario ${usuario.nombre_usuario}?`)) {
      return
    }

    try {
      setActionLoadingId(usuario.id_usuario)
      const response = await fetch(`/api/usuarios/${usuario.id_usuario}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'estado',
          estado: nuevoEstado,
          motivo
        })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? 'No se pudo actualizar el estado'
        throw new Error(message)
      }

      toast({
        title: `Usuario ${nuevoEstado ? 'habilitado' : 'bloqueado'}`,
        description: nuevoEstado
          ? `${usuario.nombre_usuario} ahora puede iniciar sesión`
          : `${usuario.nombre_usuario} fue bloqueado`
      })

      handleRefetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al cambiar estado'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleResetPassword = async (usuario: UsuarioCompleto) => {
    if (!confirmar(`Se generará una nueva contraseña temporal para ${usuario.nombre_usuario}. ¿Continuar?`)) {
      return
    }

    try {
      setActionLoadingId(usuario.id_usuario)
      const response = await fetch(`/api/usuarios/${usuario.id_usuario}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reset_password',
          enviar_correo: false
        })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? 'No se pudo regenerar la contraseña'
        throw new Error(message)
      }

      const result = await response.json() as { passwordTemporal: string }
      toast({
        title: 'Contraseña temporal generada',
        description: `La nueva contraseña es: ${result.passwordTemporal}`
      })

      handleRefetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al reiniciar la contraseña'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleSendCredentials = async (usuario: UsuarioCompleto) => {
    const mensajeAdicional = promptInput('Mensaje adicional para el correo (opcional):', '')

    if (!confirmar(`Se enviará un correo con nuevas credenciales a ${usuario.persona.nombre}. ¿Deseas continuar?`)) {
      return
    }

    try {
      setActionLoadingId(usuario.id_usuario)
      const response = await fetch(`/api/usuarios/${usuario.id_usuario}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'enviar_credenciales',
          asunto: 'Credenciales de acceso',
          mensaje_adicional: mensajeAdicional || undefined
        })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? 'No se pudo enviar el correo'
        throw new Error(message)
      }

      toast({
        title: 'Correo enviado',
        description: `Se registró el envío de credenciales a ${usuario.persona.correo || 'el usuario'}`
      })

      handleRefetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al enviar las credenciales'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (usuario: UsuarioCompleto) => {
    if (!confirmar(`¿Deseas dar de baja al usuario ${usuario.nombre_usuario}? Esta acción puede revertirse asignando nuevas credenciales.`)) {
      return
    }

    try {
      setDeleteLoadingId(usuario.id_usuario)
      const response = await fetch(`/api/usuarios/${usuario.id_usuario}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error ?? 'No se pudo dar de baja al usuario'
        throw new Error(message)
      }

      toast({
        title: 'Usuario dado de baja',
        description: `${usuario.nombre_usuario} ya no podrá iniciar sesión`
      })

      handleRefetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al dar de baja al usuario'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleteLoadingId(null)
    }
  }

  const stats = useMemo(() => {
    const totalPagina = usuarios.length
    const activos = usuarios.filter((u) => u.estado && u.estatus).length
    const bloqueados = usuarios.filter((u) => !u.estado).length
    const pendientes = usuarios.filter((u) => u.envio_credenciales_pendiente).length
    const requiereCambioCount = usuarios.filter((u) => u.requiere_cambio_password).length

    return { totalPagina, activos, bloqueados, pendientes, requiereCambio: requiereCambioCount }
  }, [usuarios])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Gestión de usuarios</CardTitle>
            <CardDescription>Administra las credenciales y roles del personal del taller</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefetch} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={onCreateNew}>
              <UsersIcon className="mr-2 h-4 w-4" />
              Nuevo usuario
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <LabelledInput
              icon={null}
              placeholder="Buscar por usuario, nombre o correo"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectFilter
              label="Estado"
              value={estado}
              onChange={(value) => handleEstadoChange(value as 'todos' | 'activos' | 'inactivos')}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'activos', label: 'Activos' },
                { value: 'inactivos', label: 'Bloqueados' }
              ]}
            />
            <SelectFilter
              label="Requiere cambio"
              value={requiereCambio}
              onChange={(value) => handleRequiereCambioChange(value as 'todos' | 'si' | 'no')}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'si', label: 'Sí' },
                { value: 'no', label: 'No' }
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectFilter
              label="Pendientes de envío"
              value={pendientesEnvio}
              onChange={(value) => handlePendientesEnvioChange(value as 'todos' | 'si' | 'no')}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'si', label: 'Sí' },
                { value: 'no', label: 'No' }
              ]}
            />
            <SelectFilter
              label="Rol"
              value={rolFilter}
              onChange={handleRolChange}
              options={[{ value: 'todos', label: 'Todos' }, ...roles.map((rol) => ({ value: rol.nombre_rol, label: rol.nombre_rol }))]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Usuarios en página" value={stats.totalPagina} variant="default" />
          <StatCard label="Activos" value={stats.activos} variant="success" />
          <StatCard label="Bloqueados" value={stats.bloqueados} variant="danger" />
          <StatCard label="Pendientes / Cambio" value={`${stats.pendientes} / ${stats.requiereCambio}`} variant="warning" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="mt-2 text-sm text-gray-600">Cargando usuarios...</p>
            </div>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center text-sm text-gray-500">
            No encontramos usuarios con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Credenciales</TableHead>
                  <TableHead className="w-48">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((usuario) => (
                  <TableRow key={usuario.id_usuario} className={!usuario.estado ? 'bg-gray-50' : undefined}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{usuario.persona.nombre} {usuario.persona.apellido_paterno ?? ''}</div>
                        <div className="text-sm text-gray-500">{usuario.nombre_usuario}</div>
                        <div className="text-xs text-gray-500">{usuario.persona.correo ?? 'Sin correo registrado'}</div>
                        <div className="text-xs text-gray-500">Documento: {usuario.persona.tipo_documento} {usuario.persona.numero_documento}</div>
                        {usuario.trabajador && (
                          <div className="text-xs text-gray-500">
                            Trabajador: {usuario.trabajador.codigo_empleado} · {usuario.trabajador.cargo}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800" variant="secondary">
                        {usuario.rol.nombre_rol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={usuario.estado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {usuario.estado ? 'Activo' : 'Bloqueado'}
                        </Badge>
                        {usuario.requiere_cambio_password && (
                          <Badge variant="outline" className="border-amber-400 text-amber-600">
                            Requiere cambio
                          </Badge>
                        )}
                        {usuario.envio_credenciales_pendiente && (
                          <Badge variant="outline" className="border-sky-400 text-sky-600">
                            Envío pendiente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>
                          Último envío: {formatDate(usuario.ultimo_envio_credenciales)}
                        </div>
                        <div>
                          Último error: {usuario.ultimo_error_envio ?? '—'}
                        </div>
                        <div>
                          Bloqueado en: {formatDate(usuario.bloqueado_en)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onView(usuario)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(usuario)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={actionLoadingId === usuario.id_usuario}
                          onClick={() => handleToggleEstado(usuario)}
                        >
                          {usuario.estado ? <Lock className="h-4 w-4 text-orange-600" /> : <Unlock className="h-4 w-4 text-green-600" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={actionLoadingId === usuario.id_usuario}
                          onClick={() => handleResetPassword(usuario)}
                        >
                          <KeyRound className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={actionLoadingId === usuario.id_usuario}
                          onClick={() => handleSendCredentials(usuario)}
                        >
                          <Mail className="h-4 w-4 text-sky-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleteLoadingId === usuario.id_usuario}
                          onClick={() => handleDelete(usuario)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex flex-col items-center gap-2 border-t pt-4 text-sm text-gray-600 md:flex-row md:justify-between">
            <div>
              Página {pagination.current} de {pagination.pages}. Mostrando {((pagination.current - 1) * pagination.limit) + 1} -
              {' '}
              {Math.min(pagination.current * pagination.limit, pagination.total)} de {pagination.total} usuarios
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={pagination.current === 1}
              >
                Anterior
              </Button>
              <span className="font-medium">{pagination.current}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
                disabled={pagination.current === pagination.pages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface LabelledInputProps {
  icon: ReactNode | null
  placeholder: string
  value: string
  onChange: (value: string) => void
}

function LabelledInput({ icon, placeholder, value, onChange }: LabelledInputProps) {
  return (
    <div className="relative">
      {icon}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={icon ? 'pl-10' : undefined}
      />
    </div>
  )
}

interface SelectFilterProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  variant: 'default' | 'success' | 'danger' | 'warning'
}

function StatCard({ label, value, variant }: StatCardProps) {
  const classes = {
    default: 'bg-gray-50 text-gray-700 border-gray-200',
    success: 'bg-green-50 text-green-700 border-green-100',
    danger: 'bg-red-50 text-red-700 border-red-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100'
  }[variant]

  const Icon = {
    default: ShieldCheck,
    success: ShieldCheck,
    danger: ShieldAlert,
    warning: ShieldAlert
  }[variant]

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${classes}`}>
      <Icon className="h-5 w-5" />
      <div>
        <p className="text-xs uppercase tracking-wide">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  )
}
