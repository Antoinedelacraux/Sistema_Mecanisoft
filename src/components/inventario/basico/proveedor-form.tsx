'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProveedorBasicoOption } from '@/components/inventario/basico/proveedor-autocomplete'

export type ProveedorFormValues = {
  nombre: string
  ruc: string
  nombre_comercial: string
  contacto: string
  numero_contacto: string
  telefono: string
  correo: string
}

const initialValues: ProveedorFormValues = {
  nombre: '',
  ruc: '',
  nombre_comercial: '',
  contacto: '',
  numero_contacto: '',
  telefono: '',
  correo: '',
}

type ProveedorFormProps = {
  onCancel?: () => void
  onSuccess?: (proveedor: ProveedorBasicoOption) => void
}

const ProveedorForm = ({ onCancel, onSuccess }: ProveedorFormProps) => {
  const [values, setValues] = useState<ProveedorFormValues>(initialValues)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleChange = (field: keyof ProveedorFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const resetForm = () => {
    setValues(initialValues)
    setError(null)
    setSuccessMessage(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const nombre = values.nombre.trim()
    const ruc = values.ruc.trim()

    if (!nombre) {
      setError('Ingresa la razon social o nombre del proveedor')
      return
    }

    if (!/^[0-9]{11}$/.test(ruc)) {
      setError('Ingresa un RUC valido de 11 digitos')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/inventario/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          ruc,
          nombre_comercial: values.nombre_comercial.trim() || null,
          contacto: values.contacto.trim() || null,
          numero_contacto: values.numero_contacto.trim() || null,
          telefono: values.telefono.trim() || null,
          correo: values.correo.trim() || null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'No se pudo registrar el proveedor')
      }

      const payload = (await response.json()) as { proveedor: ProveedorBasicoOption }
      resetForm()
      setSuccessMessage('Proveedor registrado correctamente')
      onSuccess?.(payload.proveedor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al registrar el proveedor')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onCancel?.()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="space-y-3">
        <Label htmlFor="proveedor-nombre">Nombre o razon social *</Label>
        <Input
          id="proveedor-nombre"
          value={values.nombre}
          onChange={handleChange('nombre')}
          placeholder="Ej. Proveedor Demo SAC"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Label htmlFor="proveedor-ruc">RUC *</Label>
          <Input
            id="proveedor-ruc"
            value={values.ruc}
            onChange={handleChange('ruc')}
            placeholder="2060XXXXXXXX"
            inputMode="numeric"
            pattern="[0-9]{11}"
            maxLength={11}
            minLength={11}
            disabled={isSubmitting}
            required
          />
        </div>
        <div className="space-y-3">
          <Label htmlFor="proveedor-nombre-comercial">Nombre comercial</Label>
          <Input
            id="proveedor-nombre-comercial"
            value={values.nombre_comercial}
            onChange={handleChange('nombre_comercial')}
            placeholder="Nombre comercial"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Label htmlFor="proveedor-contacto">Persona de contacto</Label>
          <Input
            id="proveedor-contacto"
            value={values.contacto}
            onChange={handleChange('contacto')}
            placeholder="Nombre del contacto"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-3">
          <Label htmlFor="proveedor-numero-contacto">Numero de contacto</Label>
          <Input
            id="proveedor-numero-contacto"
            value={values.numero_contacto}
            onChange={handleChange('numero_contacto')}
            placeholder="+51 999 999 999"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Label htmlFor="proveedor-telefono">Telefono</Label>
          <Input
            id="proveedor-telefono"
            value={values.telefono}
            onChange={handleChange('telefono')}
            placeholder="Telefono principal"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-3">
          <Label htmlFor="proveedor-correo">Correo electronico</Label>
          <Input
            id="proveedor-correo"
            type="email"
            value={values.correo}
            onChange={handleChange('correo')}
            placeholder="correo@proveedor.com"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </span>
          ) : (
            'Registrar proveedor'
          )}
        </Button>
      </div>

      {successMessage && <p className="text-sm font-medium text-emerald-600">{successMessage}</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </form>
  )
}

export default ProveedorForm
