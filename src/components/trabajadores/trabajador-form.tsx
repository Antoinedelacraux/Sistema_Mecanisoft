'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { TrabajadorFormData, TrabajadorCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import { User, Settings, DollarSign } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

const AUTO_ROLE_VALUE = '__AUTO__'
const MECANICO_LABEL = 'Mecánico'

interface TrabajadorFormProps {
  trabajador?: TrabajadorCompleto
  onSuccess: () => void
  onCancel: () => void
  roles: { id_rol: number; nombre_rol: string }[]
}

const normalizeLabel = (value?: string | null) => {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const mapNivelExperiencia = (valor?: string | null): string => {
  const normalized = normalizeLabel(valor)
  if (!normalized) return ''
  if (normalized.includes('semi')) return 'Semi Senior (2 a 5 años)'
  if (normalized.startsWith('junior')) return 'Junior (0 a 2 años)'
  if (normalized.startsWith('senior')) return 'Senior (5 a 7 años)'
  if (normalized.includes('especial')) return 'Especialista (8+ años)'
  return valor ?? ''
}

export function TrabajadorForm({ trabajador, onSuccess, onCancel, roles }: TrabajadorFormProps) {
  const [loading, setLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  
  const { toast } = useToast()

  const personaBase = trabajador ? (trabajador.usuario?.persona ?? trabajador.persona) : undefined

  const decimalToNumber = (value: unknown): number | undefined => {
    if (value == null || value === '') return undefined
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? undefined : parsed
    }
    if (typeof value === 'object') {
      const obj = value as { toNumber?: () => number; toString?: () => string }
      if (typeof obj?.toNumber === 'function') {
        return obj.toNumber()
      }
      if (typeof obj?.toString === 'function') {
        const parsed = Number(obj.toString())
        return Number.isNaN(parsed) ? undefined : parsed
      }
    }
    return undefined
  }

  const formatDateInput = (value?: Date | string | null) => {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }

  const normalizeNumericInput = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const numberValue = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(numberValue) ? undefined : numberValue
  }

  const roleNames = useMemo(
    () => {
      const distinct = Array.from(new Set(roles.map((rol) => rol.nombre_rol))).sort((a, b) => a.localeCompare(b, 'es'))
      if (distinct.length === 0) {
        return ['Mecánico', 'Recepcionista', 'Administrador']
      }
      return distinct
    },
    [roles]
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm<TrabajadorFormData>({
    defaultValues: trabajador
      ? {
          nombre: personaBase?.nombre ?? '',
          apellido_paterno: personaBase?.apellido_paterno ?? '',
          apellido_materno: personaBase?.apellido_materno ?? '',
          tipo_documento: personaBase?.tipo_documento ?? 'DNI',
          numero_documento: personaBase?.numero_documento ?? '',
          telefono: personaBase?.telefono ?? '',
          correo: personaBase?.correo ?? '',
          direccion: personaBase?.direccion ?? '',
          fecha_nacimiento: formatDateInput(personaBase?.fecha_nacimiento ?? undefined),
          nombre_usuario: trabajador.usuario?.nombre_usuario ?? '',
          password: '',
          crear_usuario: Boolean(trabajador.usuario),
          rol_usuario: trabajador.usuario?.rol?.nombre_rol ?? AUTO_ROLE_VALUE,
          cargo: trabajador.cargo ?? '',
          especialidad: trabajador.especialidad ?? 'General',
          nivel_experiencia: mapNivelExperiencia(trabajador.nivel_experiencia),
          fecha_ingreso: formatDateInput(trabajador.fecha_ingreso),
          sueldo_mensual: decimalToNumber(trabajador.sueldo_mensual),
        }
      : {
          nombre: '',
          apellido_paterno: '',
          apellido_materno: '',
          tipo_documento: 'DNI',
          numero_documento: '',
          telefono: '',
          correo: '',
          direccion: '',
          fecha_nacimiento: '',
          crear_usuario: false,
          nombre_usuario: '',
          password: '',
          rol_usuario: AUTO_ROLE_VALUE,
          cargo: '',
          especialidad: 'General',
          nivel_experiencia: '',
          fecha_ingreso: '',
          sueldo_mensual: undefined,
        }
  })

  const tipoDocumento = watch('tipo_documento')
  const especialidadSeleccionada = watch('especialidad')
  const nivelExperienciaSeleccionado = watch('nivel_experiencia')
  const cargoSeleccionado = watch('cargo')
  const rolSeleccionado = watch('rol_usuario')
  const crearUsuario = watch('crear_usuario') || false
  const tieneUsuario = Boolean(trabajador?.usuario)
  const mostrarCamposUsuario = tieneUsuario || crearUsuario
  const [rolAsignadoManual, setRolAsignadoManual] = useState(false)

  const rolNormalizado = normalizeLabel(rolSeleccionado === AUTO_ROLE_VALUE ? cargoSeleccionado : rolSeleccionado)
  const cargoNormalizado = normalizeLabel(cargoSeleccionado)
  const shouldMostrarEspecialidad = (rolNormalizado || cargoNormalizado) === normalizeLabel(MECANICO_LABEL)

  useEffect(() => {
    register('tipo_documento', { required: 'El tipo de documento es requerido' })
    register('cargo', { required: 'El cargo es requerido' })
    register('rol_usuario')
    register('especialidad', {
      validate: (value) => {
        if (!shouldMostrarEspecialidad) return true
        return value?.trim() ? true : 'Selecciona una especialidad'
      }
    })
    register('nivel_experiencia', { required: 'Selecciona un nivel' })
    register('crear_usuario')
  }, [register, shouldMostrarEspecialidad])

  useEffect(() => {
    if (!crearUsuario && !tieneUsuario) {
      setValue('nombre_usuario', '')
      setValue('password', '')
      setValue('rol_usuario', AUTO_ROLE_VALUE)
    }
  }, [crearUsuario, setValue, tieneUsuario])

  useEffect(() => {
    if (!shouldMostrarEspecialidad) {
      setValue('especialidad', 'General', { shouldValidate: true })
      clearErrors('especialidad')
    }
  }, [shouldMostrarEspecialidad, setValue, clearErrors])

  useEffect(() => {
    setRolAsignadoManual(rolSeleccionado !== AUTO_ROLE_VALUE)
  }, [rolSeleccionado])

  const onSubmit: SubmitHandler<TrabajadorFormData> = async (data) => {
    try {
      setLoading(true)

      const cargo = data.cargo?.trim() ?? ''
      const rolPreferido = data.rol_usuario === AUTO_ROLE_VALUE ? undefined : data.rol_usuario?.trim()
      const rolParaValidacion = rolPreferido ?? cargo
      const esMecanico = normalizeLabel(rolParaValidacion) === normalizeLabel(MECANICO_LABEL)

      if (esMecanico && !data.especialidad?.trim()) {
        setError('especialidad', { type: 'manual', message: 'Selecciona una especialidad' })
        throw new Error('Selecciona una especialidad válida para el rol de mecánico')
      }

      if ((mostrarCamposUsuario || data.crear_usuario) && !data.correo?.trim()) {
        setError('correo', { type: 'manual', message: 'Registra un correo para enviar las credenciales' })
        throw new Error('Debes registrar un correo electrónico para enviar las credenciales')
      }

      const payload: TrabajadorFormData = {
        ...data,
        nombre: data.nombre.trim(),
        apellido_paterno: data.apellido_paterno.trim(),
        apellido_materno: data.apellido_materno?.trim() || undefined,
        tipo_documento: data.tipo_documento,
        numero_documento: data.numero_documento.trim(),
        telefono: data.telefono?.trim() || undefined,
        correo: data.correo?.trim() || undefined,
        direccion: data.direccion?.trim() || undefined,
        fecha_nacimiento: data.fecha_nacimiento || undefined,
        cargo,
        especialidad: esMecanico ? (data.especialidad?.trim() ?? 'General') : 'General',
        nivel_experiencia: data.nivel_experiencia.trim(),
        fecha_ingreso: data.fecha_ingreso || undefined,
        sueldo_mensual: normalizeNumericInput(data.sueldo_mensual),
        crear_usuario: mostrarCamposUsuario,
        nombre_usuario: mostrarCamposUsuario ? data.nombre_usuario?.trim() : undefined,
        password: mostrarCamposUsuario && data.password ? data.password : undefined,
        rol_usuario: mostrarCamposUsuario ? rolPreferido : undefined,
      }

      const url = trabajador 
        ? `/api/trabajadores/${trabajador.id_trabajador}`
        : '/api/trabajadores'
      
      const method = trabajador ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar trabajador')
      }

      const { trabajador: trabajadorRespuesta, credenciales } = (result => {
        if (result && typeof result === 'object' && 'trabajador' in result) {
          return result as { trabajador: TrabajadorCompleto; credenciales?: { enviadas?: boolean; error?: string | null } }
        }
        return { trabajador: result as TrabajadorCompleto, credenciales: undefined }
      })(await response.json())

      // Mostrar código generado si es nuevo trabajador
      if (!trabajador && trabajadorRespuesta?.codigo_empleado) {
        setGeneratedCode(trabajadorRespuesta.codigo_empleado)
      }

      const credencialesEnviadas = credenciales?.enviadas === true
      const credencialesMensaje = credencialesEnviadas
        ? ' Las credenciales se enviaron al correo registrado.'
        : credenciales?.error
        ? ` No se pudieron enviar las credenciales: ${credenciales.error}.`
        : ''

      toast({
        title: trabajador ? 'Trabajador actualizado' : 'Trabajador creado',
        description:
          (trabajador
            ? `${data.nombre} ${data.apellido_paterno} ha sido actualizado correctamente.`
            : `${data.nombre} ${data.apellido_paterno} ha sido creado con código: ${trabajadorRespuesta?.codigo_empleado ?? '—'}.`) + credencialesMensaje,
      })

      onSuccess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error inesperado'
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-6 h-6" />
          {trabajador ? 'Editar Trabajador' : 'Nuevo Trabajador'}
        </CardTitle>
        <CardDescription>
          {trabajador 
            ? 'Modifica la información del trabajador'
            : 'Completa los datos para registrar un nuevo trabajador/mecánico'
          }
        </CardDescription>
        
        {/* Mostrar código existente o generado */}
        {(trabajador || generatedCode) && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-lg">
                {trabajador?.codigo_empleado || generatedCode}
              </Badge>
              <span className="text-sm text-blue-600">
                {trabajador ? 'Código actual' : 'Código generado automáticamente'}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información Personal */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Información Personal
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  {...register('nombre', { 
                    required: 'El nombre es requerido',
                    minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                  })}
                  placeholder="Nombre"
                />
                {errors.nombre && (
                  <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="apellido_paterno">Apellido Paterno *</Label>
                <Input
                  id="apellido_paterno"
                  {...register('apellido_paterno', { 
                    required: 'El apellido paterno es requerido' 
                  })}
                  placeholder="Apellido paterno"
                />
                {errors.apellido_paterno && (
                  <p className="text-red-500 text-sm mt-1">{errors.apellido_paterno.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="apellido_materno">Apellido Materno</Label>
                <Input
                  id="apellido_materno"
                  {...register('apellido_materno')}
                  placeholder="Apellido materno"
                />
              </div>

              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  {...register('telefono', {
                    pattern: {
                      value: /^\d{9}$/,
                      message: 'Teléfono debe tener 9 dígitos'
                    }
                  })}
                  placeholder="987654321"
                />
                {errors.telefono && (
                  <p className="text-red-500 text-sm mt-1">{errors.telefono.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="correo">Correo Electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  {...register('correo', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Correo electrónico inválido'
                    }
                  })}
                  placeholder="trabajador@taller.com"
                />
                {errors.correo && (
                  <p className="text-red-500 text-sm mt-1">{errors.correo.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  {...register('direccion')}
                  placeholder="Dirección del trabajador"
                />
                {errors.direccion && (
                  <p className="text-red-500 text-sm mt-1">{errors.direccion.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  {...register('fecha_nacimiento')}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Documento de Identidad */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Documento de Identidad</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo_documento">Tipo de Documento *</Label>
                <Select 
                  value={tipoDocumento}
                  onValueChange={(value) => setValue('tipo_documento', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="RUC">RUC</SelectItem>
                    <SelectItem value="CE">Carné de Extranjería</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo_documento && (
                  <p className="text-red-500 text-sm mt-1">{errors.tipo_documento.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="numero_documento">
                  Número de Documento *
                  {tipoDocumento === 'DNI' && ' (8 dígitos)'}
                </Label>
                <Input
                  id="numero_documento"
                  {...register('numero_documento', { 
                    required: 'El número de documento es requerido',
                    pattern: {
                      value: tipoDocumento === 'DNI' ? /^\d{8}$/ : /^.+$/,
                      message: tipoDocumento === 'DNI' ? 'DNI debe tener 8 dígitos' : 'Formato inválido'
                    }
                  })}
                  placeholder={tipoDocumento === 'DNI' ? '12345678' : 'Número de documento'}
                  disabled={!!trabajador} // No editable si ya existe
                />
                {errors.numero_documento && (
                  <p className="text-red-500 text-sm mt-1">{errors.numero_documento.message}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Datos de Usuario */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Acceso al Sistema
            </h3>
            
            {!tieneUsuario && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-dashed p-4">
                <div>
                  <p className="font-medium">Crear credenciales de acceso</p>
                  <p className="text-sm text-muted-foreground">
                    Habilita esta opción para que el trabajador pueda iniciar sesión en el panel.
                  </p>
                </div>
                <Switch
                  checked={crearUsuario}
                  onCheckedChange={(value) => setValue('crear_usuario', value, { shouldDirty: true })}
                />
              </div>
            )}

            {tieneUsuario && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Este trabajador ya cuenta con credenciales activas. Puedes actualizar su usuario, contraseña o rol.
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!mostrarCamposUsuario ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <Label htmlFor="nombre_usuario">Nombre de Usuario {mostrarCamposUsuario ? '*' : ''}</Label>
                <Input
                  id="nombre_usuario"
                  {...register('nombre_usuario', {
                    validate: (value) => {
                      if (!mostrarCamposUsuario) return true
                      const trimmed = value?.trim() ?? ''
                      if (!trimmed) return 'El nombre de usuario es requerido'
                      if (trimmed.length < 3) return 'Mínimo 3 caracteres'
                      return true
                    }
                  })}
                  placeholder="carlos.mecanico"
                  disabled={!mostrarCamposUsuario}
                />
                {errors.nombre_usuario && (
                  <p className="text-red-500 text-sm mt-1">{errors.nombre_usuario.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">
                  Contraseña {tieneUsuario ? '(opcional)' : mostrarCamposUsuario ? '*' : ''}
                </Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password', {
                    validate: (value) => {
                      if (!mostrarCamposUsuario) return true
                      if (!tieneUsuario && !value) return 'La contraseña es requerida'
                      if (value && value.length < 6) return 'Mínimo 6 caracteres'
                      return true
                    }
                  })}
                  placeholder={tieneUsuario ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                  disabled={!mostrarCamposUsuario}
                />
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="rol_usuario">Rol asignado</Label>
                <Select
                  value={rolSeleccionado ?? AUTO_ROLE_VALUE}
                  onValueChange={(value) => {
                    if (!mostrarCamposUsuario) return
                    setValue('rol_usuario', value, { shouldValidate: true, shouldDirty: true })
                    setRolAsignadoManual(value !== AUTO_ROLE_VALUE)
                  }}
                  disabled={!mostrarCamposUsuario}
                >
                  <SelectTrigger id="rol_usuario">
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_ROLE_VALUE}>Detectar automáticamente según el cargo</SelectItem>
                    {roleNames.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {rolSeleccionado === AUTO_ROLE_VALUE
                    ? cargoSeleccionado
                      ? `Se asignará el rol "${cargoSeleccionado}" en base al cargo seleccionado.`
                      : 'Selecciona un cargo para asignar el rol automáticamente.'
                    : 'Puedes ajustar los permisos desde el módulo de usuarios cuando lo necesites.'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Información Laboral */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Información Laboral
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cargo">Cargo *</Label>
                <Select
                  value={cargoSeleccionado}
                  onValueChange={(value) => {
                    setValue('cargo', value, { shouldValidate: true, shouldDirty: true })
                    if (!rolAsignadoManual) {
                      setValue('rol_usuario', AUTO_ROLE_VALUE)
                    }
                  }}
                >
                  <SelectTrigger id="cargo">
                    <SelectValue placeholder="Selecciona un cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleNames.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.cargo && (
                  <p className="text-red-500 text-sm mt-1">{errors.cargo.message}</p>
                )}
              </div>

              {shouldMostrarEspecialidad ? (
                <div>
                  <Label htmlFor="especialidad">Especialidad *</Label>
                  <Select
                    value={especialidadSeleccionada}
                    onValueChange={(value) => setValue('especialidad', value, { shouldValidate: true })}
                  >
                    <SelectTrigger id="especialidad">
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Motor">Motor</SelectItem>
                      <SelectItem value="Frenos">Frenos</SelectItem>
                      <SelectItem value="Eléctrico">Sistema Eléctrico</SelectItem>
                      <SelectItem value="Suspensión">Suspensión</SelectItem>
                      <SelectItem value="Transmisión">Transmisión</SelectItem>
                      <SelectItem value="Climatización">Aire Acondicionado</SelectItem>
                      <SelectItem value="Carrocería">Carrocería y Pintura</SelectItem>
                      <SelectItem value="General">Mecánica General</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.especialidad && (
                    <p className="text-red-500 text-sm mt-1">{errors.especialidad.message}</p>
                  )}
                </div>
              ) : (
                <div>
                  <Label>Especialidad</Label>
                  <Input value="No aplica" disabled readOnly />
                </div>
              )}

              <div>
                <Label htmlFor="nivel_experiencia">Nivel de Experiencia *</Label>
                <Select
                  value={nivelExperienciaSeleccionado}
                  onValueChange={(value) => setValue('nivel_experiencia', value, { shouldValidate: true })}
                >
                  <SelectTrigger id="nivel_experiencia">
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Junior (0 a 2 años)">Junior (0 a 2 años)</SelectItem>
                    <SelectItem value="Semi Senior (2 a 5 años)">Semi Senior (2 a 5 años)</SelectItem>
                    <SelectItem value="Senior (5 a 7 años)">Senior (5 a 7 años)</SelectItem>
                    <SelectItem value="Especialista (8+ años)">Especialista (8+ años)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.nivel_experiencia && (
                  <p className="text-red-500 text-sm mt-1">{errors.nivel_experiencia.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fecha_ingreso">Fecha de Ingreso</Label>
                <Input
                  id="fecha_ingreso"
                  type="date"
                  {...register('fecha_ingreso')}
                />
              </div>

              <div>
                <Label htmlFor="sueldo_mensual">Sueldo Mensual (S/)</Label>
                <Input
                  id="sueldo_mensual"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('sueldo_mensual', {
                    min: { value: 0, message: 'El sueldo no puede ser negativo' }
                  })}
                  placeholder="0.00"
                />
                {errors.sueldo_mensual && (
                  <p className="text-red-500 text-sm mt-1">{errors.sueldo_mensual.message}</p>
                )}
              </div>

            </div>

            {/* Preview del código si es nuevo */}
            {!trabajador && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <Badge variant="outline" className="font-mono">
                    MEC-XXX
                  </Badge>
                  <span className="text-sm">
                    Se generará automáticamente un código único para este trabajador
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Información para trabajador existente */}
          {trabajador && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-4">Información del Sistema</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Código de Empleado</Label>
                    <Badge variant="outline" className="font-mono text-lg">
                      {trabajador.codigo_empleado}
                    </Badge>
                  </div>
                  <div>
                    <Label>Fecha de Ingreso</Label>
                    <p className="text-sm">
                      {trabajador.fecha_ingreso ? new Date(trabajador.fecha_ingreso).toLocaleDateString('es-PE') : '—'}
                    </p>
                  </div>
                  <div>
                    <Label>Sueldo Mensual</Label>
                    <p className="text-sm">
                      {trabajador.sueldo_mensual ? `S/ ${decimalToNumber(trabajador.sueldo_mensual)?.toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <Label>Tareas Asignadas</Label>
                    <p className="text-lg font-semibold">
                      {trabajador._count?.tareas_asignadas ?? 0}
                    </p>
                  </div>
                  <div>
                    <Label>Órdenes Principales</Label>
                    <p className="text-lg font-semibold">
                      {trabajador._count?.ordenes_principales ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading 
                ? (trabajador ? 'Actualizando...' : 'Creando...') 
                : (trabajador ? 'Actualizar Trabajador' : 'Crear Trabajador')
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}