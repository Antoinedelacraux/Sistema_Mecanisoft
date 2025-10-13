"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ShieldBan, ShieldCheck, ShieldPlus, UserSearch } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { UsuarioCompleto } from '@/types'
import type {
  PermisoCatalogoDTO,
  PermisoPersonalizadoDTO,
  PermisoResueltoDTO,
  PermisosUsuarioResponse
} from '@/types/permisos'

interface UsuariosResponse {
  usuarios: UsuarioCompleto[]
}

interface PermisosUsuarioApiResponse {
  permisos: PermisosUsuarioResponse
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

type UsuarioResumen = Pick<UsuarioCompleto, 'id_usuario' | 'nombre_usuario'> & {
  persona: {
    nombre: string
    apellido_paterno: string
    apellido_materno: string | null
    correo: string | null
    numero_documento: string
  }
  rol: {
    id_rol: number
    nombre_rol: string
  }
}

type PersonalizacionInput = {
  codigo: string
  concedido: boolean
  origen: string
  comentario?: string | null
}

const ORIGEN_EXTRA = 'EXTRA_MANUAL'
const ORIGEN_REVOCADO = 'REVOCADO_MANUAL'

const nombreCompleto = (usuario: UsuarioResumen) =>
  `${usuario.persona.nombre} ${usuario.persona.apellido_paterno}${usuario.persona.apellido_materno ? ` ${usuario.persona.apellido_materno}` : ''}`.trim()

export function UsuariosPermissionsPanel() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioResumen | null>(null)
  const [permisosUsuario, setPermisosUsuario] = useState<PermisosUsuarioResponse | null>(null)
  const [personalizaciones, setPersonalizaciones] = useState<PermisoPersonalizadoDTO[]>([])
  const [catalogo, setCatalogo] = useState<PermisoCatalogoDTO[]>([])
  const [catalogoCargado, setCatalogoCargado] = useState(false)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [seleccionExtras, setSeleccionExtras] = useState<string[]>([])
  const [sincronizando, setSincronizando] = useState(false)

  const { toast } = useToast()

  const loadCatalogo = useCallback(async () => {
    if (catalogoCargado) return
    try {
      const data = await fetchJSON<CatalogoResponse>('/api/permisos/catalogo')
      setCatalogo(data.permisos)
      setCatalogoCargado(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible cargar el catálogo'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }, [catalogoCargado, toast])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      toast({ title: 'Atención', description: 'Ingresa un término de búsqueda (usuario, nombre o documento).' })
      return
    }

    try {
      setSearching(true)
      const data = await fetchJSON<UsuariosResponse>(`/api/usuarios?search=${encodeURIComponent(query.trim())}&limit=8`)
      const resultados = data.usuarios.map((usuario) => ({
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        persona: {
          nombre: usuario.persona.nombre,
          apellido_paterno: usuario.persona.apellido_paterno,
          apellido_materno: usuario.persona.apellido_materno ?? null,
          correo: usuario.persona.correo ?? null,
          numero_documento: usuario.persona.numero_documento
        },
        rol: {
          id_rol: usuario.rol.id_rol,
          nombre_rol: usuario.rol.nombre_rol
        }
      }))
      setUsuarios(resultados)
      if (resultados.length === 0) {
        toast({ title: 'Sin resultados', description: 'No se encontraron usuarios con ese criterio.' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible buscar usuarios'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSearching(false)
    }
  }, [query, toast])

  const fetchDetalle = useCallback(
    async (usuario: UsuarioResumen) => {
      try {
        setDetalleLoading(true)
        await loadCatalogo()
        const data = await fetchJSON<PermisosUsuarioApiResponse>(`/api/permisos/usuarios/${usuario.id_usuario}`)
        setPermisosUsuario(data.permisos)
        setPersonalizaciones(data.permisos.personalizados)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible obtener los permisos del usuario'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      } finally {
        setDetalleLoading(false)
      }
    },
    [loadCatalogo, toast]
  )

  const handleSelectUsuario = async (usuario: UsuarioResumen) => {
    setSelectedUsuario(usuario)
    setDescripcion('')
    await fetchDetalle(usuario)
  }

  const buildPersonalizacion = (codigo: string, concedido: boolean, origen: string, comentario?: string | null) => {
    const permiso = catalogo.find((item) => item.codigo === codigo)
    if (!permiso) {
      throw new Error(`Permiso ${codigo} no encontrado en el catálogo`)
    }
    return {
      codigo,
      concedido,
      origen,
      comentario: comentario ?? null,
      permiso
    }
  }

  const payloadFromPersonalizaciones = (lista: PermisoPersonalizadoDTO[]): PersonalizacionInput[] =>
    lista.map((item) => ({
      codigo: item.codigo,
      concedido: item.concedido,
      origen: item.origen,
      comentario: item.comentario
    }))

  const guardarPersonalizaciones = async (lista: PermisoPersonalizadoDTO[], descripcionBitacora?: string) => {
    if (!selectedUsuario) return
    try {
      setSaving(true)
      const data = await fetchJSON<PermisosUsuarioApiResponse>(`/api/permisos/usuarios/${selectedUsuario.id_usuario}`, {
        method: 'PUT',
        body: JSON.stringify({
          personalizaciones: payloadFromPersonalizaciones(lista),
          descripcion: descripcionBitacora || undefined
        })
      })
      setPersonalizaciones(data.permisos.personalizados)
      setPermisosUsuario((prev) => ({
        base: prev?.base ?? data.permisos.base,
        personalizados: data.permisos.personalizados,
        resueltos: data.permisos.resueltos
      }))
      setDescripcion('')
      toast({
        title: 'Permisos actualizados',
        description: `Se guardaron ${data.permisos.personalizados.length} personalizaciones`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible actualizar los permisos'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRevocar = async (codigo: string) => {
    try {
      const nuevaLista = personalizaciones
        .filter((item) => item.codigo !== codigo)
        .concat(buildPersonalizacion(codigo, false, ORIGEN_REVOCADO))
      await guardarPersonalizaciones(nuevaLista, descripcion || `Revocación manual del permiso ${codigo}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible revocar el permiso'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleRestaurar = async (codigo: string) => {
    try {
      const nuevaLista = personalizaciones.filter((item) => item.codigo !== codigo)
      await guardarPersonalizaciones(nuevaLista, descripcion || `Restauración del permiso ${codigo}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible restaurar el permiso'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const extras = useMemo(
    () => personalizaciones.filter((item) => item.concedido),
    [personalizaciones]
  )

  const revocados = useMemo(
    () => personalizaciones.filter((item) => !item.concedido),
    [personalizaciones]
  )

  const disponibleParaExtra = useMemo(() => {
    const usados = new Set([
      ...extras.map((item) => item.codigo),
      ...revocados.map((item) => item.codigo)
    ])
    return catalogo.filter((permiso) => !usados.has(permiso.codigo))
  }, [catalogo, extras, revocados])

  const handleAgregarExtras = async () => {
    if (seleccionExtras.length === 0) {
      toast({ title: 'Atención', description: 'Selecciona al menos un permiso para agregar.' })
      return
    }

    try {
      const nuevos = seleccionExtras.map((codigo) => buildPersonalizacion(codigo, true, ORIGEN_EXTRA))
      const nuevaLista = personalizaciones
        .filter((item) => !seleccionExtras.includes(item.codigo))
        .concat(nuevos)
      await guardarPersonalizaciones(nuevaLista, descripcion || 'Asignación de permisos adicionales')
      setAddModalOpen(false)
      setSeleccionExtras([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible agregar los permisos'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleEliminarExtra = async (codigo: string) => {
    try {
      const nuevaLista = personalizaciones.filter((item) => item.codigo !== codigo)
      await guardarPersonalizaciones(nuevaLista, descripcion || `Remoción del permiso extra ${codigo}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible remover el permiso extra'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleSincronizar = async (conservarPersonalizaciones: boolean) => {
    if (!selectedUsuario) return
    try {
      setSincronizando(true)
      await fetchJSON(`/api/permisos/usuarios/${selectedUsuario.id_usuario}/sincronizar`, {
        method: 'POST',
        body: JSON.stringify({ conservarPersonalizaciones })
      })
      await fetchDetalle(selectedUsuario)
      toast({
        title: 'Sincronización completada',
        description: conservarPersonalizaciones
          ? 'Se actualizaron los permisos base manteniendo las personalizaciones vigentes.'
          : 'Se restauraron los permisos base del rol y se eliminaron las personalizaciones.'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible sincronizar los permisos'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSincronizando(false)
    }
  }

  const renderPermisoResuelto = (permiso: PermisoResueltoDTO) => (
    <div
      key={permiso.codigo}
      className="flex items-start justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{permiso.permiso.nombre}</span>
          <Badge variant="outline">{permiso.permiso.modulo}</Badge>
          <Badge variant="secondary">{permiso.codigo}</Badge>
          {permiso.fuente === 'ROL' && <Badge>Rol</Badge>}
          {permiso.fuente === 'EXTRA' && <Badge className="bg-emerald-100 text-emerald-700">Extra</Badge>}
          {permiso.fuente === 'REVOCADO' && <Badge variant="destructive">Revocado</Badge>}
        </div>
        {permiso.permiso.descripcion && (
          <p className="mt-1 text-sm text-gray-600">{permiso.permiso.descripcion}</p>
        )}
        {permiso.comentarioPersonalizacion && (
          <p className="mt-2 text-xs text-gray-500">
            Comentario: {permiso.comentarioPersonalizacion}
          </p>
        )}
      </div>
      <Switch checked={permiso.concedido} disabled className="opacity-80" />
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <UserSearch className="h-6 w-6 text-primary" /> Permisos por usuario
        </CardTitle>
        <CardDescription>
          Ajusta excepciones individuales y sincroniza usuarios específicos con la plantilla de su rol.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Buscar usuario</h3>
              <p className="mt-1 text-sm text-gray-600">
                Escribe el usuario, nombre o documento y selecciona a la persona a personalizar.
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Ej: juan.perez o 12345678"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSearch()
                    }
                  }}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  <Search className="mr-2 h-4 w-4" /> Buscar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Resultados</h4>
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                {usuarios.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">Sin resultados.</p>
                ) : (
                  <ul>
                    {usuarios.map((usuario) => (
                      <li key={usuario.id_usuario}>
                        <button
                          type="button"
                          onClick={() => handleSelectUsuario(usuario)}
                          className={`flex w-full flex-col items-start gap-1 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${
                            selectedUsuario?.id_usuario === usuario.id_usuario ? 'bg-primary/5' : ''
                          }`}
                        >
                          <span className="text-sm font-semibold text-gray-900">{nombreCompleto(usuario)}</span>
                          <span className="text-xs text-gray-600">Usuario: {usuario.nombre_usuario}</span>
                          <span className="text-xs text-gray-500">Rol: {usuario.rol.nombre_rol}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {selectedUsuario ? (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{nombreCompleto(selectedUsuario)}</h3>
                      <p className="text-sm text-gray-600">
                        Usuario <strong>{selectedUsuario.nombre_usuario}</strong> • Rol {selectedUsuario.rol.nombre_rol}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSincronizar(true)}
                        disabled={sincronizando || detalleLoading}
                      >
                        Mantener extras
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleSincronizar(false)}
                        disabled={sincronizando || detalleLoading}
                      >
                        Restaurar desde rol
                      </Button>
                    </div>
                  </div>
                  {descripcion && (
                    <p className="mt-2 text-xs text-gray-500">Descripción temporal: {descripcion}</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <ShieldBan className="h-4 w-4 text-amber-500" /> Permisos heredados del rol
                      </h4>
                      <Badge variant="outline">{permisosUsuario?.base.length ?? 0}</Badge>
                    </div>
                    <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                      {detalleLoading ? (
                        <p className="text-sm text-gray-500">Cargando permisos…</p>
                      ) : (
                        permisosUsuario?.base.map((permiso) => {
                          const revocado = revocados.find((item) => item.codigo === permiso.codigo)
                          return (
                            <div key={permiso.codigo} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">{permiso.nombre}</span>
                                <Badge variant="outline">{permiso.modulo}</Badge>
                                <Badge variant="secondary">{permiso.codigo}</Badge>
                                {revocado && <Badge variant="destructive">Revocado</Badge>}
                              </div>
                              {permiso.descripcion && (
                                <p className="mt-1 text-xs text-gray-600">{permiso.descripcion}</p>
                              )}
                              <div className="mt-2 flex gap-2">
                                {revocado ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestaurar(permiso.codigo)}
                                    disabled={saving}
                                  >
                                    Restaurar
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRevocar(permiso.codigo)}
                                    disabled={saving}
                                  >
                                    Revocar
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <ShieldPlus className="h-4 w-4 text-emerald-500" /> Permisos personalizados
                      </h4>
                      <Badge variant="outline">{personalizaciones.length}</Badge>
                    </div>

                    <div className="mt-3 space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddModalOpen(true)
                          setSeleccionExtras([])
                        }}
                        disabled={detalleLoading || saving}
                      >
                        Agregar permiso extra
                      </Button>

                      <div className="max-h-[220px] space-y-3 overflow-y-auto pr-1">
                        {personalizaciones.length === 0 ? (
                          <p className="text-sm text-gray-500">No hay personalizaciones registradas.</p>
                        ) : (
                          personalizaciones.map((item) => (
                            <div key={`${item.codigo}-${item.origen}`} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">{item.permiso.nombre}</span>
                                <Badge variant="outline">{item.permiso.modulo}</Badge>
                                <Badge variant="secondary">{item.codigo}</Badge>
                                <Badge variant={item.concedido ? 'default' : 'destructive'}>
                                  {item.concedido ? 'Extra' : 'Revocado'}
                                </Badge>
                              </div>
                              {item.permiso.descripcion && (
                                <p className="mt-1 text-xs text-gray-600">{item.permiso.descripcion}</p>
                              )}
                              {item.comentario && (
                                <p className="mt-1 text-xs text-gray-500">Comentario: {item.comentario}</p>
                              )}
                              <div className="mt-2 flex gap-2">
                                {item.concedido ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEliminarExtra(item.codigo)}
                                    disabled={saving}
                                  >
                                    Quitar extra
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestaurar(item.codigo)}
                                    disabled={saving}
                                  >
                                    Restaurar
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Panorama resultante
                    </h4>
                    <Badge variant="outline">{permisosUsuario?.resueltos.length ?? 0}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {detalleLoading ? (
                      <p className="text-sm text-gray-500">Cargando permisos resultantes…</p>
                    ) : (
                      permisosUsuario?.resueltos.map(renderPermisoResuelto)
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-800">Comentario para bitácora (opcional)</h4>
                  <p className="mt-1 text-xs text-gray-500">
                    El texto se enviará con la próxima acción que guardes (revocar, agregar o eliminar extras).
                  </p>
                  <Textarea
                    value={descripcion}
                    onChange={(event) => setDescripcion(event.target.value)}
                    placeholder="Ej. Permisos ajustados por requerimiento del área de inventario."
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
                Selecciona un usuario en la barra lateral para visualizar y personalizar sus permisos.
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={addModalOpen} onOpenChange={(open) => !open && setAddModalOpen(open)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Agregar permisos adicionales</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Selecciona los permisos que deseas asignar manualmente. Se crearán como extras sobre el rol actual.
            </p>
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
              {disponibleParaExtra.length === 0 ? (
                <p className="text-sm text-gray-500">No hay permisos adicionales disponibles.</p>
              ) : (
                disponibleParaExtra.map((permiso) => {
                  const checked = seleccionExtras.includes(permiso.codigo)
                  return (
                    <div
                      key={permiso.codigo}
                      className="flex items-start justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{permiso.nombre}</span>
                          <Badge variant="outline">{permiso.modulo}</Badge>
                          <Badge variant="secondary">{permiso.codigo}</Badge>
                        </div>
                        {permiso.descripcion && (
                          <p className="mt-1 text-xs text-gray-600">{permiso.descripcion}</p>
                        )}
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(value) =>
                          setSeleccionExtras((prev) =>
                            value ? [...prev, permiso.codigo] : prev.filter((item) => item !== permiso.codigo)
                          )
                        }
                      />
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAgregarExtras} disabled={saving}>
                Asignar seleccionados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
