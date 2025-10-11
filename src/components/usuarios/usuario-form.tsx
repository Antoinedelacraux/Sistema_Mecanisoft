'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, UserCog, UserPlus } from 'lucide-react'
import type { Rol } from '@prisma/client'
import type {
  TrabajadorCompleto,
  UsuarioCrearFormData,
  UsuarioActualizarFormData,
  UsuarioCompleto
} from '@/types'

type RoleOption = Pick<Rol, 'id_rol' | 'nombre_rol'>

interface UsuarioCreateFormProps {
  roles: RoleOption[]
  onSuccess: () => void
  onCancel: () => void
  onPasswordGenerated?: (password: string) => void
}

interface UsuarioEditFormProps {
  roles: RoleOption[]
  usuario: UsuarioCompleto
  onSuccess: () => void
  onCancel: () => void
}

const defaultExpirationHours = 72

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init
  })

  if (!response.ok) {
    let message = 'Solicitud al servidor falló'
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      const text = await response.text().catch(() => '')
      if (text) message = text
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function UsuarioCreateForm({ roles, onSuccess, onCancel, onPasswordGenerated }: UsuarioCreateFormProps) {
  const [trabajadores, setTrabajadores] = useState<TrabajadorCompleto[]>([])
  const [trabajadoresLoading, setTrabajadoresLoading] = useState(true)
  const [manualPassword, setManualPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<UsuarioCrearFormData>({
    defaultValues: {
      id_trabajador: undefined as unknown as number,
      nombre_usuario: '',
      correo: '',
      rol: roles[0]?.nombre_rol ?? '',
      estado: true,
      enviar_correo: true,
      password: '',
      confirmar_password: '',
      password_expira_en_horas: defaultExpirationHours
    }
  })

  const selectedTrabajadorId = watch('id_trabajador')
  const enviarCorreo = watch('enviar_correo')
  const estadoActual = watch('estado')
  const rolActual = watch('rol')

  useEffect(() => {
    register('id_trabajador', { required: true })
    register('rol', { required: true })
  }, [register])

  useEffect(() => {
    if (!rolActual && roles[0]) {
      setValue('rol', roles[0].nombre_rol)
    }
  }, [rolActual, roles, setValue])

  useEffect(() => {
    const controller = new AbortController()

    const loadTrabajadores = async () => {
      try {
        setTrabajadoresLoading(true)
        const data = await fetchJson<{ trabajadores: TrabajadorCompleto[] }>(
          '/api/trabajadores?solo_activos=true&include_inactive=false',
          { signal: controller.signal }
        )
        const disponibles = data.trabajadores.filter((trabajador) => !trabajador.usuario)
        disponibles.sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre))
        setTrabajadores(disponibles)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          const message = error instanceof Error ? error.message : 'No fue posible cargar los trabajadores disponibles'
          toast({
            title: 'Error',
            description: message,
            variant: 'destructive'
          })
        }
      } finally {
        if (!controller.signal.aborted) {
          setTrabajadoresLoading(false)
        }
      }
    }

    loadTrabajadores()

    return () => controller.abort()
  }, [toast])

  useEffect(() => {
    if (!selectedTrabajadorId) return
    const trabajador = trabajadores.find((item) => item.id_trabajador === Number(selectedTrabajadorId))
    if (!trabajador) return

    if (trabajador.persona.correo) {
      setValue('correo', trabajador.persona.correo)
    }
  }, [selectedTrabajadorId, trabajadores, setValue])

  const onSubmit = async (data: UsuarioCrearFormData) => {
    try {
      setSubmitting(true)
      const payload: Record<string, unknown> = {
        id_trabajador: Number(data.id_trabajador),
        nombre_usuario: data.nombre_usuario.trim(),
        correo: data.correo?.trim() || undefined,
        rol: data.rol ? data.rol.trim() : undefined,
        estado: Boolean(data.estado),
        enviar_correo: Boolean(data.enviar_correo),
        password_expira_en_horas: Number(data.password_expira_en_horas) || defaultExpirationHours
      }

      if (manualPassword && data.password) {
        payload.password = data.password
        payload.confirmar_password = data.confirmar_password
      }

      const result = await fetchJson<{ usuario: UsuarioCompleto; passwordTemporal: string }>(
        '/api/usuarios',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      )

      toast({
        title: 'Usuario creado',
        description: `Se generó la contraseña temporal: ${result.passwordTemporal}`
      })

      onPasswordGenerated?.(result.passwordTemporal)
      reset()
      setManualPassword(false)
      onSuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el usuario'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const trabajadorResumen = useMemo(() => {
    if (!selectedTrabajadorId) return null
    return trabajadores.find((item) => item.id_trabajador === Number(selectedTrabajadorId)) ?? null
  }, [selectedTrabajadorId, trabajadores])

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UserPlus className="h-5 w-5" />
          Crear usuario
        </CardTitle>
        <CardDescription>Asigna credenciales a un trabajador activo del taller</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id_trabajador">Trabajador</Label>
              <Select
                value={selectedTrabajadorId ? String(selectedTrabajadorId) : ''}
                onValueChange={(value) => setValue('id_trabajador', Number(value), { shouldValidate: true })}
                disabled={trabajadoresLoading || submitting}
              >
                <SelectTrigger id="id_trabajador">
                  <SelectValue placeholder={trabajadoresLoading ? 'Cargando trabajadores...' : 'Selecciona un trabajador'} />
                </SelectTrigger>
                <SelectContent>
                  {trabajadores.length === 0 && !trabajadoresLoading && (
                    <SelectItem value="" disabled>
                      No hay trabajadores disponibles
                    </SelectItem>
                  )}
                  {trabajadores.map((trabajador) => (
                    <SelectItem key={trabajador.id_trabajador} value={String(trabajador.id_trabajador)}>
                      {trabajador.persona.nombre} {trabajador.persona.apellido_paterno ?? ''} · {trabajador.cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.id_trabajador && (
                <p className="text-sm text-red-600">Selecciona un trabajador</p>
              )}
            </div>

            {trabajadorResumen && (
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm">
                <p className="font-medium text-blue-900">{trabajadorResumen.persona.nombre} {trabajadorResumen.persona.apellido_paterno}</p>
                <p className="text-blue-800">Cargo: {trabajadorResumen.cargo}</p>
                <p className="text-blue-800">Especialidad: {trabajadorResumen.especialidad ?? '—'}</p>
                <p className="text-blue-800">Correo: {trabajadorResumen.persona.correo ?? '—'}</p>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre_usuario">Nombre de usuario</Label>
              <Input
                id="nombre_usuario"
                placeholder="usuario"
                {...register('nombre_usuario', {
                  required: 'El nombre de usuario es obligatorio',
                  minLength: { value: 4, message: 'Al menos 4 caracteres' }
                })}
                disabled={submitting}
              />
              {errors.nombre_usuario && (
                <p className="text-sm text-red-600">{errors.nombre_usuario.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo">Correo</Label>
              <Input
                id="correo"
                type="email"
                placeholder="correo@ejemplo.com"
                {...register('correo', {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Correo inválido'
                  }
                })}
                disabled={submitting}
              />
              {errors.correo && (
                <p className="text-sm text-red-600">{errors.correo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <Select
                value={watch('rol') ?? ''}
                onValueChange={(value) => setValue('rol', value, { shouldValidate: true })}
                disabled={submitting}
              >
                <SelectTrigger id="rol">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((rol) => (
                    <SelectItem key={rol.id_rol} value={rol.nombre_rol}>
                      {rol.nombre_rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.rol && (
                <p className="text-sm text-red-600">{errors.rol.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password_expira_en_horas">Vigencia contraseña temporal (horas)</Label>
              <Input
                id="password_expira_en_horas"
                type="number"
                min={1}
                max={336}
                {...register('password_expira_en_horas', {
                  valueAsNumber: true,
                  min: { value: 1, message: 'Mínimo 1 hora' },
                  max: { value: 336, message: 'Máximo 336 horas (14 días)' }
                })}
                disabled={submitting}
              />
              {errors.password_expira_en_horas && (
                <p className="text-sm text-red-600">{errors.password_expira_en_horas.message}</p>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <Label className="font-medium">Habilitar cuenta</Label>
                <p className="text-sm text-gray-500">El usuario podrá iniciar sesión inmediatamente.</p>
              </div>
              <Switch
                checked={estadoActual}
                onCheckedChange={(checked) => setValue('estado', checked)}
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <Label className="font-medium">Enviar correo con credenciales</Label>
                <p className="text-sm text-gray-500">Se registrará como pendiente hasta que se envíe.</p>
              </div>
              <Switch
                checked={enviarCorreo}
                onCheckedChange={(checked) => setValue('enviar_correo', checked)}
                disabled={submitting}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Definir contraseña manualmente</Label>
              <Switch
                checked={manualPassword}
                onCheckedChange={setManualPassword}
                disabled={submitting}
              />
            </div>
            {manualPassword && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña temporal</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register('password', {
                      required: manualPassword ? 'Indica una contraseña' : false,
                      minLength: { value: 8, message: 'Al menos 8 caracteres' }
                    })}
                    disabled={submitting}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar_password">Confirmar contraseña</Label>
                  <Input
                    id="confirmar_password"
                    type="password"
                    {...register('confirmar_password', {
                      validate: (value) => {
                        if (!manualPassword) return true
                        return value === watch('password') || 'Las contraseñas no coinciden'
                      }
                    })}
                    disabled={submitting}
                  />
                  {errors.confirmar_password && (
                    <p className="text-sm text-red-600">{errors.confirmar_password.message}</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || trabajadoresLoading || !selectedTrabajadorId}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando
                </>
              ) : (
                'Crear usuario'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function UsuarioEditForm({ roles, usuario, onSuccess, onCancel }: UsuarioEditFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<UsuarioActualizarFormData>({
    defaultValues: {
      nombre_usuario: usuario.nombre_usuario,
      correo: usuario.persona.correo ?? '',
      rol: usuario.rol.nombre_rol,
      estado: usuario.estado,
      motivo_bloqueo: usuario.motivo_bloqueo ?? ''
    }
  })

  const estadoActual = watch('estado')

  const onSubmit = async (data: UsuarioActualizarFormData) => {
    if (!data.estado && !data.motivo_bloqueo) {
      setValue('motivo_bloqueo', 'Bloqueo manual')
    }

    try {
      setSubmitting(true)
      const payload = {
        nombre_usuario: data.nombre_usuario.trim(),
        correo: data.correo?.trim() || null,
        rol: data.rol ? data.rol.trim() : null,
        estado: Boolean(data.estado),
        motivo_bloqueo: data.estado ? null : (data.motivo_bloqueo?.trim() || 'Bloqueo manual')
      }

      await fetchJson<{ usuario: UsuarioCompleto }>(`/api/usuarios/${usuario.id_usuario}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      toast({
        title: 'Usuario actualizado',
        description: 'Los cambios fueron guardados correctamente'
      })

      onSuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el usuario'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UserCog className="h-5 w-5" />
          Editar usuario
        </CardTitle>
        <CardDescription>Actualiza los datos y estado del usuario seleccionado</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre_usuario_edit">Nombre de usuario</Label>
              <Input
                id="nombre_usuario_edit"
                {...register('nombre_usuario', {
                  required: 'El nombre de usuario es obligatorio',
                  minLength: { value: 4, message: 'Al menos 4 caracteres' }
                })}
                disabled={submitting}
              />
              {errors.nombre_usuario && (
                <p className="text-sm text-red-600">{errors.nombre_usuario.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo_edit">Correo</Label>
              <Input
                id="correo_edit"
                type="email"
                {...register('correo', {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Correo inválido'
                  }
                })}
                disabled={submitting}
              />
              {errors.correo && (
                <p className="text-sm text-red-600">{errors.correo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol_edit">Rol</Label>
              <Select
                value={watch('rol') ?? ''}
                onValueChange={(value) => setValue('rol', value, { shouldDirty: true, shouldValidate: true })}
                disabled={submitting}
              >
                <SelectTrigger id="rol_edit">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((rol) => (
                    <SelectItem key={rol.id_rol} value={rol.nombre_rol}>
                      {rol.nombre_rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Estado</Label>
              <div className="flex items-center justify-between rounded-md border p-4">
                <div>
                  <p className="text-sm text-gray-600">Permite iniciar sesión y operar en el sistema.</p>
                  {!estadoActual && usuario.motivo_bloqueo && (
                    <p className="text-xs text-red-500">Motivo actual: {usuario.motivo_bloqueo}</p>
                  )}
                </div>
                <Switch
                  checked={estadoActual}
                  onCheckedChange={(checked) => setValue('estado', checked)}
                  disabled={submitting}
                />
              </div>
            </div>
            {!estadoActual && (
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="motivo_bloqueo">Motivo de bloqueo</Label>
                <Textarea
                  id="motivo_bloqueo"
                  rows={3}
                  {...register('motivo_bloqueo', {
                    required: 'Indica el motivo del bloqueo',
                    minLength: { value: 5, message: 'Describe el motivo con mayor detalle' }
                  })}
                  disabled={submitting}
                />
                {errors.motivo_bloqueo && (
                  <p className="text-sm text-red-600">{errors.motivo_bloqueo.message}</p>
                )}
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
