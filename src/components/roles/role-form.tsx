'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const roleFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(80, 'El nombre no debe superar los 80 caracteres'),
  descripcion: z
    .string()
    .trim()
    .max(255, 'La descripción no debe superar los 255 caracteres')
    .default(''),
  activo: z.boolean().default(true)
})

export type RoleFormValues = z.infer<typeof roleFormSchema>
type RoleFormFormInput = z.input<typeof roleFormSchema>

interface RoleFormProps {
  mode: 'create' | 'edit'
  defaultValues?: Partial<RoleFormValues>
  submitting?: boolean
  onSubmit: (values: RoleFormValues) => Promise<void> | void
  onCancel: () => void
}

export function RoleForm({ mode, defaultValues, submitting = false, onSubmit, onCancel }: RoleFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<RoleFormFormInput, unknown, RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      nombre: defaultValues?.nombre ?? '',
      descripcion: defaultValues?.descripcion ?? '',
      activo: defaultValues?.activo ?? true
    }
  })

  useEffect(() => {
    reset({
      nombre: defaultValues?.nombre ?? '',
      descripcion: defaultValues?.descripcion ?? '',
      activo: defaultValues?.activo ?? true
    })
  }, [defaultValues?.activo, defaultValues?.descripcion, defaultValues?.nombre, reset])

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit({
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() ?? '',
      activo: values.activo
    })
  })

  return (
    <form onSubmit={submitHandler} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre del rol</Label>
        <Input id="nombre" placeholder="Ej. Supervisor de Taller" {...register('nombre')} />
        {errors.nombre && <p className="text-sm text-red-500">{errors.nombre.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          placeholder="Describe el alcance del rol para ayudar al equipo"
          {...register('descripcion')}
          rows={4}
        />
        {errors.descripcion && <p className="text-sm text-red-500">{errors.descripcion.message}</p>}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <h4 className="font-medium text-gray-900">Rol activo</h4>
          <p className="text-sm text-gray-600">
            Determina si el rol puede asignarse a usuarios y trabajadores.
          </p>
        </div>
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={(value) => field.onChange(value)} />
          )}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : mode === 'create' ? 'Crear rol' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
