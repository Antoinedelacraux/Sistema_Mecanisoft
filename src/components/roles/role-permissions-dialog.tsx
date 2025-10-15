'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, ShieldQuestion, Search } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { ModuloPermisosDTO, PermisoRolDTO } from '@/types/permisos'

interface RolePermissionsDialogProps {
  open: boolean
  roleId: number | null
  roleName?: string
  onClose: () => void
  onSaved?: () => void
}

interface ModulesResponse {
  modulos: ModuloPermisosDTO[]
}

interface RolePermissionsResponse {
  permisos: PermisoRolDTO[]
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
    // Ignorar cuerpos vacíos
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

export function RolePermissionsDialog({ open, roleId, roleName, onClose, onSaved }: RolePermissionsDialogProps) {
  const [modules, setModules] = useState<ModuloPermisosDTO[]>([])
  const [modulesLoaded, setModulesLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [filterModule, setFilterModule] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [note, setNote] = useState('')

  const { toast } = useToast()

  const loadModules = useCallback(async () => {
    if (modulesLoaded) return
    try {
      const data = await fetchJSON<ModulesResponse>('/api/roles/permisos')
      setModules(data.modulos)
      setModulesLoaded(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible obtener el catálogo de permisos'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }, [modulesLoaded, toast])

  const loadRolePermissions = useCallback(async () => {
    if (!roleId) return
    try {
      setLoading(true)
      await loadModules()
      const data = await fetchJSON<RolePermissionsResponse>(`/api/roles/${roleId}/permisos`)
      const concedidos = data.permisos.filter((permiso) => permiso.concedido).map((permiso) => permiso.codigo)
      setSelectedCodes(concedidos)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible obtener los permisos del rol'
      toast({ title: 'Error', description: message, variant: 'destructive' })
      onClose()
    } finally {
      setLoading(false)
    }
  }, [loadModules, onClose, roleId, toast])

  useEffect(() => {
    if (open) {
      setNote('')
      setSearchTerm('')
      setFilterModule('todos')
      loadRolePermissions()
    } else {
      setSelectedCodes([])
    }
  }, [loadRolePermissions, open])

  const permisosFiltrados = useMemo(() => {
    if (!modules.length) return [] as Array<{ modulo: ModuloPermisosDTO; permiso: ModuloPermisosDTO['permisos'][number] }>
    const termino = normalizarTexto(searchTerm.trim())
    const resultado: Array<{ modulo: ModuloPermisosDTO; permiso: ModuloPermisosDTO['permisos'][number] }> = []

    modules.forEach((modulo) => {
      if (filterModule !== 'todos' && modulo.clave !== filterModule) {
        return
      }
      modulo.permisos.forEach((permiso) => {
        if (!termino) {
          resultado.push({ modulo, permiso })
          return
        }
        const texto = normalizarTexto(`${permiso.codigo} ${permiso.nombre} ${permiso.descripcion ?? ''}`)
        if (texto.includes(termino)) {
          resultado.push({ modulo, permiso })
        }
      })
    })

    return resultado
  }, [filterModule, modules, searchTerm])

  const modulesOptions = useMemo(() => {
    const base = modules.map((modulo) => ({ clave: modulo.clave, nombre: modulo.nombre }))
    return [{ clave: 'todos', nombre: 'Todos los módulos' }, ...base]
  }, [modules])

  const isSelected = useCallback((codigo: string) => selectedCodes.includes(codigo), [selectedCodes])

  const togglePermission = (codigo: string, conceder: boolean) => {
    setSelectedCodes((prev) => {
      if (conceder) {
        if (prev.includes(codigo)) return prev
        return [...prev, codigo]
      }
      return prev.filter((item) => item !== codigo)
    })
  }

  const toggleModule = (modulo: ModuloPermisosDTO, conceder: boolean) => {
    setSelectedCodes((prev) => {
      const codigosModulo = modulo.permisos.map((permiso) => permiso.codigo)
      if (conceder) {
        const conjunto = new Set(prev)
        codigosModulo.forEach((codigo) => conjunto.add(codigo))
        return Array.from(conjunto)
      }
      return prev.filter((codigo) => !codigosModulo.includes(codigo))
    })
  }

  const handleSubmit = async () => {
    if (!roleId) return
    if (selectedCodes.length === 0) {
      const continuar = typeof window === 'undefined' ? true : window.confirm('El rol quedará sin permisos. ¿Deseas continuar?')
      if (!continuar) return
    }
    try {
      setSaving(true)
      await fetchJSON(`/api/roles/${roleId}/permisos`, {
        method: 'POST',
        body: JSON.stringify({ permisos: selectedCodes, nota: note || undefined })
      })
      toast({
        title: 'Permisos actualizados',
        description: `Se guardaron ${selectedCodes.length} permisos para ${roleName ?? 'el rol'}`
      })
      onSaved?.()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible guardar los permisos'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <ShieldQuestion className="h-5 w-5 text-primary" />
            Permisos del rol {roleName ?? ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando permisos del rol…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">
                  {selectedCodes.length} permisos seleccionados de {modules.reduce((acc, modulo) => acc + modulo.permisos.length, 0)} disponibles
                </p>
                <p className="text-xs text-gray-500">Agrupa por módulo para asignar de forma masiva.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCodes(modules.flatMap((modulo) => modulo.permisos.map((permiso) => permiso.codigo)))}
                >
                  Seleccionar todo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCodes([])}>
                  Limpiar selección
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre o código"
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por módulo" />
                </SelectTrigger>
                <SelectContent>
                  {modulesOptions.map((modulo) => (
                    <SelectItem key={modulo.clave} value={modulo.clave}>
                      {modulo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-2">
              {modules.map((modulo) => {
                const permisosModulo = permisosFiltrados.filter((item) => item.modulo.clave === modulo.clave)
                if (filterModule !== 'todos' && modulo.clave !== filterModule) {
                  return null
                }
                if (permisosModulo.length === 0 && searchTerm.trim()) {
                  return null
                }
                const totalSeleccionados = modulo.permisos.filter((permiso) => isSelected(permiso.codigo)).length
                const todosSeleccionados = totalSeleccionados === modulo.permisos.length && modulo.permisos.length > 0
                const tieneSeleccion = totalSeleccionados > 0

                return (
                  <div key={modulo.clave} className="rounded-lg border border-gray-200 bg-white">
                    <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{modulo.nombre}</h3>
                        {modulo.descripcion && (
                          <p className="text-xs text-gray-500">{modulo.descripcion}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {totalSeleccionados}/{modulo.permisos.length} permisos seleccionados
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleModule(modulo, true)}>
                          Asignar todos
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleModule(modulo, false)} disabled={!tieneSeleccion}>
                          Quitar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 px-4 py-3">
                      {permisosModulo.length === 0 ? (
                        <p className="text-xs text-gray-500">No hay permisos que coincidan con el filtro.</p>
                      ) : (
                        permisosModulo.map(({ permiso }) => {
                          const concedido = isSelected(permiso.codigo)
                          return (
                            <div
                              key={permiso.id_permiso}
                              className={`flex items-start justify-between rounded-md border px-3 py-3 transition ${
                                concedido ? 'border-primary/60 bg-primary/5' : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-gray-900">{permiso.nombre}</span>
                                  <Badge variant="outline">{modulo.nombre}</Badge>
                                  <Badge variant="secondary">{permiso.codigo}</Badge>
                                </div>
                                {permiso.descripcion && (
                                  <p className="text-sm text-gray-600">{permiso.descripcion}</p>
                                )}
                              </div>
                              <Switch checked={concedido} onCheckedChange={(value) => togglePermission(permiso.codigo, value)} />
                            </div>
                          )
                        })
                      )}
                    </div>

                    {todosSeleccionados && (
                      <p className="border-t border-primary/40 bg-primary/5 px-4 py-2 text-xs text-primary">
                        Todos los permisos del módulo están asignados.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="space-y-2">
              <label htmlFor="nota-permisos-rol" className="text-sm font-medium text-gray-700">
                Nota para bitácora (opcional)
              </label>
              <Textarea
                id="nota-permisos-rol"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Describe el motivo de la actualización para el registro en la bitácora"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {selectedCodes.length === 0
                  ? 'El rol quedará sin permisos asignados.'
                  : `Se asignarán ${selectedCodes.length} permisos.`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
