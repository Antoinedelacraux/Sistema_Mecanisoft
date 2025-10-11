'use client'

import { useEffect, useState } from 'react'
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

interface TrabajadorFormProps {
  trabajador?: TrabajadorCompleto
  onSuccess: () => void
  onCancel: () => void
}

export function TrabajadorForm({ trabajador, onSuccess, onCancel }: TrabajadorFormProps) {
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
          rol_usuario: trabajador.usuario?.rol?.nombre_rol ?? '',
          cargo: trabajador.cargo,
          especialidad: trabajador.especialidad,
          nivel_experiencia: trabajador.nivel_experiencia,
          tarifa_hora: decimalToNumber(trabajador.tarifa_hora) ?? 0,
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
          rol_usuario: '',
          cargo: '',
          especialidad: '',
          nivel_experiencia: '',
          tarifa_hora: 0,
          fecha_ingreso: '',
          sueldo_mensual: undefined,
        }
  })

  const tipoDocumento = watch('tipo_documento')
  const especialidadSeleccionada = watch('especialidad')
  const nivelExperienciaSeleccionado = watch('nivel_experiencia')
  const crearUsuario = watch('crear_usuario') || false
  const tieneUsuario = Boolean(trabajador?.usuario)
  const mostrarCamposUsuario = tieneUsuario || crearUsuario

  useEffect(() => {
    register('tipo_documento', { required: 'El tipo de documento es requerido' })
    register('especialidad', { required: 'Selecciona una especialidad' })
    register('nivel_experiencia', { required: 'Selecciona un nivel' })
    register('crear_usuario')
  }, [register])

  useEffect(() => {
    if (!crearUsuario && !tieneUsuario) {
      setValue('nombre_usuario', '')
      setValue('password', '')
      setValue('rol_usuario', '')
    }
  }, [crearUsuario, setValue, tieneUsuario])

  const onSubmit: SubmitHandler<TrabajadorFormData> = async (data) => {
    try {
      setLoading(true)

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
        cargo: data.cargo.trim(),
        especialidad: data.especialidad.trim(),
        nivel_experiencia: data.nivel_experiencia.trim(),
        tarifa_hora: normalizeNumericInput(data.tarifa_hora),
        fecha_ingreso: data.fecha_ingreso || undefined,
        sueldo_mensual: normalizeNumericInput(data.sueldo_mensual),
        crear_usuario: mostrarCamposUsuario,
        nombre_usuario: mostrarCamposUsuario ? data.nombre_usuario?.trim() : undefined,
        password: mostrarCamposUsuario && data.password ? data.password : undefined,
        rol_usuario: mostrarCamposUsuario && data.rol_usuario ? data.rol_usuario.trim() : undefined,
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

      const result = await response.json()

      // Mostrar código generado si es nuevo trabajador
      if (!trabajador) {
        setGeneratedCode(result.codigo_empleado)
      }

      toast({
        title: trabajador ? "Trabajador actualizado" : "Trabajador creado",
        description: trabajador 
          ? `${data.nombre} ${data.apellido_paterno} ha sido actualizado correctamente`
          : `${data.nombre} ${data.apellido_paterno} ha sido creado con código: ${result.codigo_empleado}`,
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
    <Card className="w-full max-w-4xl mx-auto">
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
                <Label htmlFor="rol_usuario">Rol asignado (opcional)</Label>
                <Input
                  id="rol_usuario"
                  {...register('rol_usuario')}
                  placeholder="Ej. Mecánico, Recepcionista"
                  disabled={!mostrarCamposUsuario}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Si lo dejas vacío, asignaremos un rol automáticamente según el cargo registrado.
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cargo">Cargo *</Label>
                <Input
                  id="cargo"
                  {...register('cargo', {
                    required: 'El cargo es requerido',
                    minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                  })}
                  placeholder="Ej. Mecánico, Recepcionista"
                />
                {errors.cargo && (
                  <p className="text-red-500 text-sm mt-1">{errors.cargo.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="especialidad">Especialidad *</Label>
                <Select 
                  value={especialidadSeleccionada}
                  onValueChange={(value) => setValue('especialidad', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
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
                  <p className="text-red-500 text-sm mt-1">Selecciona una especialidad</p>
                )}
              </div>

              <div>
                <Label htmlFor="nivel_experiencia">Nivel de Experiencia *</Label>
                <Select 
                  value={nivelExperienciaSeleccionado}
                  onValueChange={(value) => setValue('nivel_experiencia', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Junior">Junior (0-2 años)</SelectItem>
                    <SelectItem value="Senior">Senior (3-7 años)</SelectItem>
                    <SelectItem value="Especialista">Especialista (8+ años)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.nivel_experiencia && (
                  <p className="text-red-500 text-sm mt-1">Selecciona un nivel</p>
                )}
              </div>

              <div>
                <Label htmlFor="tarifa_hora">Tarifa por Hora (S/)</Label>
                <Input
                  id="tarifa_hora"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('tarifa_hora', {
                    min: { value: 0, message: 'La tarifa no puede ser negativa' }
                  })}
                  placeholder="0.00"
                />
                {errors.tarifa_hora && (
                  <p className="text-red-500 text-sm mt-1">{errors.tarifa_hora.message}</p>
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