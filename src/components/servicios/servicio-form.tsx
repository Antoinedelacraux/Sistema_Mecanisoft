'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ServicioFormData, ServicioCompleto, MarcaCompleta, ModeloCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface ServicioFormProps {
  servicio?: ServicioCompleto
  onSuccess: () => void
  onCancel: () => void
}

const schema = z.object({
  codigo_servicio: z.string().optional(),
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(500).optional(),
  es_general: z.boolean(),
  id_marca: z.number().int().positive().optional().nullable(),
  id_modelo: z.number().int().positive().optional().nullable(),
  precio_base: z.number().min(0),
  descuento: z.number().min(0).max(100).optional(),
  oferta: z.boolean().optional(),
  tiempo_minimo: z.number().int().min(1),
  tiempo_maximo: z.number().int().min(1),
  unidad_tiempo: z.enum(['minutos','horas','dias','semanas']),
  estatus: z.boolean().optional()
}).superRefine((data, ctx) => {
  if (!data.oferta && (data.descuento ?? 0) > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El descuento solo aplica cuando el servicio está en oferta', path: ['descuento'] })
  }
  if (data.tiempo_maximo < data.tiempo_minimo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El tiempo máximo debe ser mayor o igual al mínimo', path: ['tiempo_maximo'] })
  }
})

type SchemaType = z.infer<typeof schema>

export function ServicioForm({ servicio, onSuccess, onCancel }: ServicioFormProps) {
  const [loading, setLoading] = useState(false)
  const [marcas, setMarcas] = useState<MarcaCompleta[]>([])
  const [modelos, setModelos] = useState<ModeloCompleto[]>([])
  const { toast } = useToast()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SchemaType>({
    resolver: zodResolver(schema),
    defaultValues: servicio ? {
      codigo_servicio: servicio.codigo_servicio,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion || '',
      es_general: servicio.es_general,
      id_marca: servicio.id_marca || null,
      id_modelo: servicio.id_modelo || null,
      precio_base: Number(servicio.precio_base),
      descuento: Number(servicio.descuento) || 0,
      oferta: Boolean(servicio.oferta),
      tiempo_minimo: Number(servicio.tiempo_minimo),
      tiempo_maximo: Number(servicio.tiempo_maximo),
      unidad_tiempo: servicio.unidad_tiempo,
      estatus: Boolean(servicio.estatus)
    } : {
      codigo_servicio: undefined,
      nombre: '',
      descripcion: '',
      es_general: true,
      id_marca: null,
      id_modelo: null,
      precio_base: 0,
      descuento: 0,
      oferta: false,
      tiempo_minimo: 60,
      tiempo_maximo: 120,
      unidad_tiempo: 'minutos',
      estatus: true
    }
  })

  const esGeneral = watch('es_general')
  const marcaId = watch('id_marca')
  const descuento = watch('descuento') || 0
  const precioBase = watch('precio_base') || 0
  const ofertaActiva = watch('oferta') || false
  const tiempoMinWatch = watch('tiempo_minimo')
  const tiempoMaxWatch = watch('tiempo_maximo')
  const unidadTiempoWatch = watch('unidad_tiempo')
  const precioFinal = ofertaActiva ? precioBase * (1 - (descuento / 100)) : precioBase

  useEffect(() => {
    const fetchMarcas = async () => {
      try {
        const res = await fetch('/api/marcas')
        const data = await res.json()
        setMarcas(data.marcas || [])
      } catch (e) { console.error('Error marcas', e) }
    }
    fetchMarcas()
  }, [])

  useEffect(() => {
    const fetchModelos = async () => {
      if (!marcaId) { setModelos([]); setValue('id_modelo', null); return }
      try {
        const res = await fetch(`/api/modelos?id_marca=${marcaId}`)
        const data = await res.json()
        setModelos(data.modelos || [])
      } catch (e) { console.error('Error modelos', e) }
    }
    fetchModelos()
  }, [marcaId, setValue])

  useEffect(() => {
    if (!ofertaActiva) {
      setValue('descuento', 0)
    }
  }, [ofertaActiva, setValue])

  const onSubmit = async (formData: SchemaType) => {
    setLoading(true)
    try {
      const finalData: ServicioFormData = {
        codigo_servicio: formData.codigo_servicio,
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        es_general: formData.es_general,
        id_marca: formData.es_general ? null : (formData.id_marca || null),
        id_modelo: formData.es_general ? null : (formData.id_modelo || null),
        precio_base: formData.precio_base,
        descuento: (formData.oferta ? formData.descuento : 0) || 0,
        oferta: formData.oferta || false,
        tiempo_minimo: formData.tiempo_minimo,
        tiempo_maximo: formData.tiempo_maximo,
        unidad_tiempo: formData.unidad_tiempo,
        estatus: formData.estatus ?? true
      }

      const endpoint = servicio ? `/api/servicios/${servicio.id_servicio}` : '/api/servicios'
      const method = servicio ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar servicio')
      }

      toast({ title: servicio ? 'Servicio actualizado' : 'Servicio creado', description: formData.nombre })
      onSuccess()
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{servicio ? 'Editar Servicio' : 'Nuevo Servicio'}</CardTitle>
        <CardDescription>Registra servicios generales o específicos por marca/modelo</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <Label>Código</Label>
            <Input placeholder="Se generará automáticamente" readOnly={!servicio} disabled={!servicio} {...register('codigo_servicio')} />
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <Label>Nombre *</Label>
              <Input placeholder="Cambio de aceite" {...register('nombre')} />
              {errors.nombre && <p className="text-sm text-red-600">{errors.nombre.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="flex items-center gap-3">
              <Switch checked={esGeneral} onCheckedChange={(v) => setValue('es_general', v)} />
              <span className="text-sm">Servicio General</span>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Marca</Label>
              <Select value={marcaId?.toString() || ''} onValueChange={(v) => setValue('id_marca', parseInt(v))} disabled={esGeneral}>
                <SelectTrigger>
                  <SelectValue placeholder={esGeneral ? 'N/A' : 'Seleccione'} />
                </SelectTrigger>
                <SelectContent>
                  {marcas.map(m => <SelectItem key={m.id_marca} value={m.id_marca.toString()}>{m.nombre_marca}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Modelo</Label>
              <Select value={watch('id_modelo')?.toString() || ''} onValueChange={(v) => setValue('id_modelo', parseInt(v))} disabled={esGeneral || !marcaId}>
                <SelectTrigger>
                  <SelectValue placeholder={esGeneral ? 'N/A' : (marcaId ? 'Seleccione' : 'Elija marca')} />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map(md => <SelectItem key={md.id_modelo} value={md.id_modelo.toString()}>{md.nombre_modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <Label>Precio Base *</Label>
              <Input type="number" step="0.01" min={0} {...register('precio_base', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Descuento (%)</Label>
              <Input type="number" min={0} max={100} disabled={!ofertaActiva} {...register('descuento', { valueAsNumber: true })} />
              {!ofertaActiva && <span className="text-xs text-muted-foreground">Activa la oferta para aplicar descuento</span>}
              {errors.descuento && <p className="text-sm text-red-600">{errors.descuento.message}</p>}
            </div>
            <div className="flex items-end">
              <div className="px-3 py-2 rounded border bg-gray-50 text-sm">Precio Final: S/ {precioFinal.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="flex items-center gap-3">
              <Switch checked={ofertaActiva} onCheckedChange={(v) => setValue('oferta', v)} />
              <span className="text-sm">En Oferta</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tiempo mínimo *</Label>
              <Input type="number" min={1} {...register('tiempo_minimo', { valueAsNumber: true })} />
              {errors.tiempo_minimo && <p className="text-sm text-red-600">{errors.tiempo_minimo.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tiempo máximo *</Label>
              <Input type="number" min={1} {...register('tiempo_maximo', { valueAsNumber: true })} />
              <span className="text-xs text-muted-foreground">Debe ser &ge; tiempo mínimo</span>
              {errors.tiempo_maximo && <p className="text-sm text-red-600">{errors.tiempo_maximo.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Unidad de tiempo *</Label>
              <Select value={unidadTiempoWatch} onValueChange={(v) => setValue('unidad_tiempo', v as SchemaType['unidad_tiempo'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutos">Minutos</SelectItem>
                  <SelectItem value="horas">Horas</SelectItem>
                  <SelectItem value="dias">Días</SelectItem>
                  <SelectItem value="semanas">Semanas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span>Tiempo estimado: {tiempoMinWatch} - {tiempoMaxWatch} {unidadTiempoWatch}</span>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={watch('estatus') ?? true} onCheckedChange={(v) => setValue('estatus', v)} />
              <span className="text-sm">Activo</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{servicio ? 'Actualizar Servicio' : 'Crear Servicio'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
