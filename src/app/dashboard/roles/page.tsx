'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shield } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { RolesTable, type RoleTableItem } from '@/components/roles/roles-table'
import { RoleForm, type RoleFormValues } from '@/components/roles/role-form'
import { RolePermissionsDialog } from '@/components/roles/role-permissions-dialog'
import type { PermisoRolDTO } from '@/types/permisos'

interface RolesListResponse {
  roles: RoleTableItem[]
}

interface RoleDetailResponse {
  role: RoleTableItem
  permisos: PermisoRolDTO[]
  totalUsuarios: number
}

const fetchJSON = async <T,>(input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // Puede no haber cuerpo
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? ((data as { error?: string }).error ?? '')
      : typeof data === 'string'
      ? data
      : ''
    throw new Error(message || 'Error al comunicarse con el servidor')
  }

  return (data ?? ({} as unknown)) as T
}

const normalizarTexto = (valor: string) => valor.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleTableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [includeInactive, setIncludeInactive] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formDefaults, setFormDefaults] = useState<RoleFormValues | undefined>(undefined)
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [viewDetail, setViewDetail] = useState<RoleDetailResponse | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [permissionsState, setPermissionsState] = useState<{ open: boolean; roleId: number | null; roleName?: string }>(
    { open: false, roleId: null, roleName: undefined }
  )
  const [detailLoading, setDetailLoading] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    const handler = window.setTimeout(() => setSearchTerm(searchInput.trim()), 350)
    return () => window.clearTimeout(handler)
  }, [searchInput])

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('includeStats', 'true')
      if (includeInactive) params.set('includeInactive', 'true')
      if (searchTerm) params.set('search', searchTerm)

      const data = await fetchJSON<RolesListResponse>(`/api/roles?${params.toString()}`)
      setRoles(data.roles)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible cargar la lista de roles'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [includeInactive, searchTerm, toast])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  const filteredRoles = useMemo(() => {
    if (!searchTerm) return roles
    const termino = normalizarTexto(searchTerm)
    return roles.filter((rol) => {
      const texto = normalizarTexto(`${rol.nombre_rol} ${rol.descripcion ?? ''}`)
      return texto.includes(termino)
    })
  }, [roles, searchTerm])

  const handleCreate = () => {
    setFormMode('create')
    setFormDefaults({ nombre: '', descripcion: '', activo: true })
    setEditingRoleId(null)
    setFormOpen(true)
  }

  const handleEdit = async (roleId: number) => {
    try {
      setDetailLoading(true)
      const data = await fetchJSON<RoleDetailResponse>(`/api/roles/${roleId}`)
      setFormMode('edit')
      setFormDefaults({
        nombre: data.role.nombre_rol,
        descripcion: data.role.descripcion ?? '',
        activo: data.role.estatus
      })
      setEditingRoleId(roleId)
      setFormOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible cargar el rol seleccionado'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleView = async (roleId: number) => {
    try {
      setDetailLoading(true)
      const data = await fetchJSON<RoleDetailResponse>(`/api/roles/${roleId}`)
      setViewDetail(data)
      setViewOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible obtener el detalle del rol'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleManagePermissions = (roleId: number) => {
    const role = roles.find((item) => item.id_rol === roleId)
    setPermissionsState({ open: true, roleId, roleName: role?.nombre_rol })
  }

  const handleToggleActive = async (role: RoleTableItem, nextStatus: boolean) => {
    if (nextStatus === role.estatus) return
    try {
      if (!nextStatus) {
        const confirmar = typeof window === 'undefined' ? true : window.confirm(`¿Deshabilitar el rol ${role.nombre_rol}?`)
        if (!confirmar) return
        await fetchJSON(`/api/roles/${role.id_rol}`, { method: 'DELETE' })
        toast({ title: 'Rol deshabilitado', description: `${role.nombre_rol} ya no estará disponible para nuevos usuarios.` })
      } else {
        await fetchJSON(`/api/roles/${role.id_rol}`, {
          method: 'PUT',
          body: JSON.stringify({ activo: true })
        })
        toast({ title: 'Rol reactivado', description: `${role.nombre_rol} está nuevamente disponible.` })
      }
      await loadRoles()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible actualizar el estado del rol'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const submitRole = async (values: RoleFormValues) => {
    try {
      setFormSubmitting(true)
      if (formMode === 'create') {
        await fetchJSON(`/api/roles`, {
          method: 'POST',
          body: JSON.stringify({
            nombre: values.nombre,
            descripcion: values.descripcion?.trim() ? values.descripcion.trim() : null,
            activo: values.activo
          })
        })
        toast({ title: 'Rol creado', description: `Se registró el rol ${values.nombre}.` })
      } else if (editingRoleId) {
        await fetchJSON(`/api/roles/${editingRoleId}`, {
          method: 'PUT',
          body: JSON.stringify({
            nombre: values.nombre,
            descripcion: values.descripcion?.trim() ? values.descripcion.trim() : null,
            activo: values.activo
          })
        })
        toast({ title: 'Rol actualizado', description: `Se guardaron los cambios de ${values.nombre}.` })
      }
      setFormOpen(false)
      await loadRoles()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar el rol'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setFormSubmitting(false)
    }
  }

  const permisosAgrupados = useMemo(() => {
    if (!viewDetail) return [] as Array<{ modulo: string; permisos: PermisoRolDTO[] }>
    const mapa = new Map<string, PermisoRolDTO[]>()
    viewDetail.permisos.forEach((permiso) => {
      const lista = mapa.get(permiso.modulo) ?? []
      lista.push(permiso)
      mapa.set(permiso.modulo, lista)
    })
    return Array.from(mapa.entries()).map(([modulo, permisos]) => ({ modulo, permisos }))
  }, [viewDetail])

  const permisosCount = useMemo(() => viewDetail?.permisos.length ?? 0, [viewDetail])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Roles y permisos</h1>
        <p className="text-gray-600">Define los perfiles de acceso que utilizarán los usuarios y trabajadores del taller.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr,auto] md:items-center">
        <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-2">
          <Shield className="h-5 w-5 text-primary" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por nombre o descripción"
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="include-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
          <Label htmlFor="include-inactive">Incluir roles inactivos</Label>
        </div>
      </div>

      <RolesTable
        roles={filteredRoles}
        loading={loading}
        onCreate={handleCreate}
        onRefresh={loadRoles}
        onView={handleView}
        onEdit={handleEdit}
        onManagePermissions={handleManagePermissions}
        onToggleActive={handleToggleActive}
      />

      <Dialog open={formOpen} onOpenChange={(value) => !value && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Crear nuevo rol' : 'Editar rol'}</DialogTitle>
          </DialogHeader>
          {detailLoading && formMode === 'edit' ? (
            <p className="text-sm text-gray-500">Cargando información…</p>
          ) : (
            <RoleForm
              mode={formMode}
              defaultValues={formDefaults}
              submitting={formSubmitting}
              onSubmit={submitRole}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={(value) => !value && setViewOpen(false)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <Shield className="h-5 w-5 text-primary" />
              {viewDetail?.role.nombre_rol ?? 'Detalle del rol'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-gray-500">Cargando detalle…</p>
          ) : viewDetail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={viewDetail.role.estatus ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  {viewDetail.role.estatus ? 'Activo' : 'Inactivo'}
                </Badge>
                <Badge variant="outline">Usuarios asignados: {viewDetail.totalUsuarios}</Badge>
                <Badge variant="secondary">Permisos: {permisosCount}</Badge>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Descripción</h3>
                <p className="text-sm text-gray-600">{viewDetail.role.descripcion ?? 'Sin descripción registrada.'}</p>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Permisos asociados</h3>
                {permisosAgrupados.length === 0 ? (
                  <p className="text-sm text-gray-500">El rol no tiene permisos asignados.</p>
                ) : (
                  permisosAgrupados.map((grupo) => (
                    <div key={grupo.modulo} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <h4 className="text-sm font-semibold text-gray-800">{grupo.modulo}</h4>
                      <div className="mt-2 space-y-1">
                        {grupo.permisos.map((permiso) => (
                          <div key={permiso.codigo} className="flex items-start justify-between rounded-md bg-white px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{permiso.nombre}</p>
                              <p className="text-xs text-gray-500">{permiso.codigo}</p>
                              {permiso.descripcion && (
                                <p className="text-xs text-gray-500">{permiso.descripcion}</p>
                              )}
                            </div>
                            <Badge variant="outline">{permiso.modulo}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Selecciona un rol para ver su detalle.</p>
          )}
        </DialogContent>
      </Dialog>

      <RolePermissionsDialog
        open={permissionsState.open}
        roleId={permissionsState.roleId}
        roleName={permissionsState.roleName}
        onClose={() => setPermissionsState({ open: false, roleId: null })}
        onSaved={() => loadRoles()}
      />
    </div>
  )
}
