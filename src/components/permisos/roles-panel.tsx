"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Shield, ShieldCheck, ShieldQuestion } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { PermisoCatalogoDTO } from '@/types/permisos'

interface RolResumen {
  id_rol: number
  nombre_rol: string
}

interface RolesResponse {
  roles: RolResumen[]
}

interface RolPermisoResponse {
  permisos: Array<{
    codigo: string
  }>
}

interface CatalogoResponse {
  permisos: PermisoCatalogoDTO[]
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

  if (!response.ok) {
    const fallback = await response.text().catch(() => '')
    throw new Error(fallback || 'Error al comunicarse con el servidor')
  }

  return (await response.json()) as T
}

const normalizarTexto = (valor: string) => valor.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function RolesPermissionsPanel() {
  const [roles, setRoles] = useState<RolResumen[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [selectedRole, setSelectedRole] = useState<RolResumen | null>(null)
  const [catalogo, setCatalogo] = useState<PermisoCatalogoDTO[]>([])
  const [catalogoCargado, setCatalogoCargado] = useState(false)
  const [codigosRol, setCodigosRol] = useState<string[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [filterModulo, setFilterModulo] = useState<string>('todos')
  const [search, setSearch] = useState('')
  const [nota, setNota] = useState('')
  const [guardarLoading, setGuardarLoading] = useState(false)
  const [permisosRoleLoading, setPermisosRoleLoading] = useState(false)

  const { toast } = useToast()

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true)
      const data = await fetchJSON<RolesResponse>('/api/roles')
      setRoles(data.roles)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible cargar los roles'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoadingRoles(false)
    }
  }, [toast])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  const openEditor = useCallback(
    async (rol: RolResumen) => {
      setSelectedRole(rol)
      setEditorOpen(true)
      setNota('')
      try {
        setPermisosRoleLoading(true)
        if (!catalogoCargado) {
          const dataCatalogo = await fetchJSON<CatalogoResponse>('/api/permisos/catalogo')
          setCatalogo(dataCatalogo.permisos)
          setCatalogoCargado(true)
        }

        const dataRol = await fetchJSON<RolPermisoResponse>(`/api/permisos/roles/${rol.id_rol}`)
        setCodigosRol(dataRol.permisos.map((permiso) => permiso.codigo))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible cargar los permisos del rol'
        toast({ title: 'Error', description: message, variant: 'destructive' })
        setEditorOpen(false)
        setSelectedRole(null)
      } finally {
        setPermisosRoleLoading(false)
      }
    },
    [catalogoCargado, toast]
  )

  const closeEditor = () => {
    setEditorOpen(false)
    setSelectedRole(null)
    setCodigosRol([])
    setFilterModulo('todos')
    setSearch('')
    setNota('')
  }

  const modulosDisponibles = useMemo(() => {
    const modulos = Array.from(new Set(catalogo.map((permiso) => permiso.modulo))).filter(Boolean)
    return ['todos', ...modulos]
  }, [catalogo])

  const catalogoFiltrado = useMemo(() => {
    const termino = normalizarTexto(search.trim())
    return catalogo.filter((permiso) => {
      if (filterModulo !== 'todos' && permiso.modulo !== filterModulo) {
        return false
      }
      if (!termino) return true
      const texto = normalizarTexto(`${permiso.codigo} ${permiso.nombre} ${permiso.descripcion ?? ''}`)
      return texto.includes(termino)
    })
  }, [catalogo, filterModulo, search])

  const togglePermiso = (codigo: string, conceder: boolean) => {
    setCodigosRol((prev) => {
      if (conceder) {
        if (prev.includes(codigo)) {
          return prev
        }
        return [...prev, codigo]
      }
      return prev.filter((item) => item !== codigo)
    })
  }

  const handleGuardar = async () => {
    if (!selectedRole) return
    try {
      setGuardarLoading(true)
      await fetchJSON(`/api/permisos/roles/${selectedRole.id_rol}`, {
        method: 'PUT',
        body: JSON.stringify({ codigos: codigosRol, descripcion: nota || undefined })
      })
      toast({
        title: 'Permisos actualizados',
        description: `Se actualizaron ${codigosRol.length} permisos para el rol ${selectedRole.nombre_rol}`
      })
      closeEditor()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar los permisos'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setGuardarLoading(false)
    }
  }

  const totalCatalogo = catalogo.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Shield className="h-6 w-6 text-primary" /> Permisos por rol
        </CardTitle>
        <CardDescription>
          Configura las plantillas de permisos que se asignarán automáticamente a cada rol del taller.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingRoles ? (
          <p className="text-sm text-gray-500">Cargando roles…</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-gray-500">No se encontraron roles activos.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((rol) => (
              <div key={rol.id_rol} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{rol.nombre_rol}</h3>
                    <p className="text-sm text-gray-600">Plantilla de permisos aplicada a este rol</p>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Asignado
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => openEditor(rol)}>
                    Administrar permisos
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              <ShieldQuestion className="h-5 w-5 text-primary" />
              Permisos del rol {selectedRole?.nombre_rol ?? ''}
            </DialogTitle>
          </DialogHeader>

          {permisosRoleLoading ? (
            <p className="text-sm text-gray-500">Cargando permisos del rol…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Buscar por código o nombre"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select value={filterModulo} onValueChange={setFilterModulo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulosDisponibles.map((modulo) => (
                      <SelectItem key={modulo} value={modulo}>
                        {modulo === 'todos' ? 'Todos los módulos' : modulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                {catalogoFiltrado.map((permiso) => {
                  const concedido = codigosRol.includes(permiso.codigo)
                  return (
                    <div
                      key={permiso.id_permiso}
                      className="flex items-start justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{permiso.nombre}</span>
                          <Badge variant="outline">{permiso.modulo}</Badge>
                          <Badge variant="secondary">{permiso.codigo}</Badge>
                        </div>
                        {permiso.descripcion && (
                          <p className="mt-1 text-sm text-gray-600">{permiso.descripcion}</p>
                        )}
                      </div>
                      <Switch checked={concedido} onCheckedChange={(value) => togglePermiso(permiso.codigo, value)} />
                    </div>
                  )
                })}

                {catalogoFiltrado.length === 0 && (
                  <p className="text-sm text-gray-500">No hay permisos que coincidan con los filtros seleccionados.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="nota-permisos-rol">
                  Nota u observación (opcional)
                </label>
                <Textarea
                  id="nota-permisos-rol"
                  placeholder="Describe el motivo de la actualización para la bitácora"
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                <span>{codigosRol.length} permisos activos de {totalCatalogo}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeEditor} disabled={guardarLoading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleGuardar} disabled={guardarLoading}>
                    {guardarLoading ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
