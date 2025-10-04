'use client'

import { useState } from 'react'
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

interface TrabajadorFormProps {
  trabajador?: TrabajadorCompleto
  onSuccess: () => void
  onCancel: () => void
}

export function TrabajadorForm({ trabajador, onSuccess, onCancel }: TrabajadorFormProps) {
  const [loading, setLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TrabajadorFormData>({
    defaultValues: trabajador
      ? {
          nombre: trabajador.usuario.persona.nombre,
          apellido_paterno: trabajador.usuario.persona.apellido_paterno,
          apellido_materno: trabajador.usuario.persona.apellido_materno || '',
          tipo_documento: trabajador.usuario.persona.tipo_documento,
          numero_documento: trabajador.usuario.persona.numero_documento,
          telefono: trabajador.usuario.persona.telefono || '',
          correo: trabajador.usuario.persona.correo || '',
          nombre_usuario: trabajador.usuario.nombre_usuario,
          // password se deja vacío intencionalmente; definimos string vacío
          password: '',
          especialidad: trabajador.especialidad,
          nivel_experiencia: trabajador.nivel_experiencia,
          tarifa_hora: typeof trabajador.tarifa_hora === 'number'
            ? trabajador.tarifa_hora
            : (typeof (trabajador.tarifa_hora as any)?.toNumber === 'function'
                ? (trabajador.tarifa_hora as any).toNumber()
                : Number(trabajador.tarifa_hora))
        }
      : {
          tarifa_hora: 0
        }
  })

  const tipoDocumento = watch('tipo_documento')

  const onSubmit: SubmitHandler<TrabajadorFormData> = async (data) => {
    try {
      setLoading(true)

      const url = trabajador 
        ? `/api/trabajadores/${trabajador.id_trabajador}`
        : '/api/trabajadores'
      
      const method = trabajador ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
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
                  onValueChange={(value) => setValue('tipo_documento', value)} 
                  defaultValue={trabajador?.usuario.persona.tipo_documento || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre_usuario">Nombre de Usuario *</Label>
                <Input
                  id="nombre_usuario"
                  {...register('nombre_usuario', { 
                    required: 'El nombre de usuario es requerido',
                    minLength: { value: 3, message: 'Mínimo 3 caracteres' }
                  })}
                  placeholder="carlos.mecanico"
                  disabled={!!trabajador} // No editable si ya existe
                />
                {errors.nombre_usuario && (
                  <p className="text-red-500 text-sm mt-1">{errors.nombre_usuario.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">
                  Contraseña {trabajador ? '(dejar vacío para mantener actual)' : '*'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password', trabajador ? {} : { 
                    required: 'La contraseña es requerida',
                    minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                  })}
                  placeholder={trabajador ? 'Nueva contraseña' : 'Contraseña'}
                />
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                )}
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
                <Label htmlFor="especialidad">Especialidad *</Label>
                <Select 
                  onValueChange={(value) => setValue('especialidad', value)} 
                  defaultValue={trabajador?.especialidad || ''}
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
                  onValueChange={(value) => setValue('nivel_experiencia', value)} 
                  defaultValue={trabajador?.nivel_experiencia || ''}
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
                    <Label>Fecha de Contrato</Label>
                    <p className="text-sm">
                      {new Date(trabajador.fecha_contrato).toLocaleDateString('es-PE')}
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