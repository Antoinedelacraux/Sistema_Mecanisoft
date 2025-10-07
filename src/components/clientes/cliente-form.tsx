'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ClienteFormData, ClienteCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const createEmptyEmpresa = () => ({
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  direccion_fiscal: ''
})

const formatDateInput = (value?: string | Date | null): string => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const timezoneOffset = date.getTimezoneOffset() * 60000
  const adjusted = new Date(date.getTime() - timezoneOffset)
  return adjusted.toISOString().split('T')[0]
}

interface ClienteFormProps {
  cliente?: ClienteCompleto
  onSuccess: () => void
  onCancel: () => void
}

export function ClienteForm({ cliente, onSuccess, onCancel }: ClienteFormProps) {
  const [loading, setLoading] = useState(false)
  const [validatingDocument, setValidatingDocument] = useState(false)
  const [documentValidation, setDocumentValidation] = useState<{
    isValid: boolean
    message: string
    type: 'success' | 'error' | 'warning'
  } | null>(null)
  const [validatingEmpresa, setValidatingEmpresa] = useState(false)
  const [empresaDocumentValidation, setEmpresaDocumentValidation] = useState<{
    isValid: boolean
    message: string
    type: 'success' | 'error' | 'warning'
  } | null>(null)
  const { toast } = useToast()

  const defaultValues = useMemo<ClienteFormData>(() => {
    if (cliente) {
      const persona = cliente.persona
      const empresa = persona.empresa_persona

      return {
        nombre: persona.nombre,
        apellido_paterno: persona.apellido_paterno,
        apellido_materno: persona.apellido_materno || '',
        tipo_documento: persona.tipo_documento as ClienteFormData['tipo_documento'],
        numero_documento: persona.numero_documento,
        sexo: persona.sexo || '',
        telefono: persona.telefono || '',
        correo: persona.correo || '',
        fecha_nacimiento: formatDateInput(persona.fecha_nacimiento) || '',
        registrar_empresa: Boolean(persona.registrar_empresa && empresa),
  nombre_comercial: persona.nombre_comercial || '',
        empresa: empresa
          ? {
              ruc: empresa.ruc,
              razon_social: empresa.razon_social,
              nombre_comercial: empresa.nombre_comercial || '',
              direccion_fiscal: empresa.direccion_fiscal || ''
            }
          : createEmptyEmpresa()
      }
    }

    return {
      nombre: '',
      apellido_paterno: '',
      apellido_materno: '',
      tipo_documento: 'DNI',
      numero_documento: '',
      sexo: '',
      telefono: '',
      correo: '',
      fecha_nacimiento: '',
      registrar_empresa: false,
      nombre_comercial: '',
      empresa: createEmptyEmpresa()
    }
  }, [cliente])

  const form = useForm<ClienteFormData>({
    defaultValues
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    control,
    clearErrors,
    setError
  } = form

  const tipoDocumento = watch('tipo_documento')
  const numeroDocumento = watch('numero_documento')
  const registrarEmpresa = watch('registrar_empresa')
  const empresaRuc = watch('empresa.ruc')

  const maxBirthDate = useMemo(() => {
    const limit = new Date()
    limit.setFullYear(limit.getFullYear() - 18)
    return formatDateInput(limit)
  }, [])

  useEffect(() => {
    if (tipoDocumento === 'RUC') {
      setValue('registrar_empresa', false)
      setValue('empresa', createEmptyEmpresa())
      setEmpresaDocumentValidation(null)
    }
  }, [tipoDocumento, setValue])

  useEffect(() => {
    if (!registrarEmpresa) {
      setValue('empresa', createEmptyEmpresa())
      clearErrors(['empresa.ruc', 'empresa.razon_social', 'empresa.nombre_comercial', 'empresa.direccion_fiscal'])
      setEmpresaDocumentValidation(null)
    }
  }, [registrarEmpresa, setValue, clearErrors])

  useEffect(() => {
    if (tipoDocumento !== 'RUC') {
      setValue('nombre_comercial', '')
    }
  }, [tipoDocumento, setValue])

  // ✅ Validación de documento en tiempo real
  const validateDocument = useCallback(async (documento: string) => {
    if (!documento || documento.length < 3) {
      setDocumentValidation(null)
      return
    }

    setValidatingDocument(true)
    try {
      const response = await fetch('/api/clientes/validar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_documento: documento,
          cliente_id: cliente?.id_cliente
        })
      })

      const data = await response.json()

      if (data.disponible) {
        setDocumentValidation({
          isValid: true,
          message: 'Documento disponible',
          type: 'success'
        })
        clearErrors('numero_documento')
      } else {
        setDocumentValidation({
          isValid: false,
          message: data.mensaje,
          type: 'error'
        })
        setError('numero_documento', {
          type: 'manual',
          message: 'Este documento ya está registrado'
        })
      }
    } catch (error) {
      setDocumentValidation({
        isValid: false,
        message: 'Error validando documento',
        type: 'warning'
      })
    } finally {
      setValidatingDocument(false)
    }
  }, [cliente?.id_cliente, clearErrors, setError])

  const validateEmpresaRuc = useCallback(async (ruc: string) => {
    if (!registrarEmpresa) {
      setEmpresaDocumentValidation(null)
      return
    }

    if (!ruc || ruc.length !== 11) {
      setEmpresaDocumentValidation(null)
      return
    }

    setValidatingEmpresa(true)
    try {
      const response = await fetch('/api/clientes/validar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_documento: ruc,
          cliente_id: cliente?.id_cliente
        })
      })

      const data = await response.json()

      if (data.disponible) {
        setEmpresaDocumentValidation({
          isValid: true,
          message: 'RUC disponible',
          type: 'success'
        })
        clearErrors('empresa.ruc')
      } else {
        setEmpresaDocumentValidation({
          isValid: false,
          message: data.mensaje,
          type: 'error'
        })
        setError('empresa.ruc', {
          type: 'manual',
          message: data.mensaje || 'Este RUC ya está registrado'
        })
      }
    } catch (error) {
      setEmpresaDocumentValidation({
        isValid: false,
        message: 'Error validando RUC',
        type: 'warning'
      })
    } finally {
      setValidatingEmpresa(false)
    }
  }, [registrarEmpresa, cliente?.id_cliente, clearErrors, setError])

  const onSubmit = async (data: ClienteFormData) => {
    try {
      if (documentValidation && !documentValidation.isValid) {
        toast("Error de validación", {
          description: "Por favor corrige el número de documento antes de continuar",
          variant: "destructive",
        })
        return
      }
      setLoading(true)

      const normalized: ClienteFormData = {
        ...data,
        numero_documento: data.numero_documento.trim(),
        sexo: data.sexo?.trim() || '',
        telefono: data.telefono?.trim() || '',
        correo: data.correo?.trim() || '',
        nombre_comercial:
          data.tipo_documento === 'RUC'
            ? (data.nombre_comercial?.trim() || null)
            : null,
        registrar_empresa: data.tipo_documento === 'RUC' ? false : data.registrar_empresa,
        empresa: null
      }

      if (normalized.registrar_empresa) {
        normalized.empresa = {
          ruc: data.empresa?.ruc?.trim() || '',
          razon_social: data.empresa?.razon_social?.trim() || '',
          nombre_comercial: data.empresa?.nombre_comercial?.trim() || '',
          direccion_fiscal: data.empresa?.direccion_fiscal?.trim() || ''
        }
      }

      const url = cliente 
        ? `/api/clientes/${cliente.id_cliente}`
        : '/api/clientes'
      
      const method = cliente ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(normalized)
      })

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(await response.text() || 'Error al guardar cliente');
        }
        console.error("Error de la API:", errorData);
        throw new Error(errorData.error || 'Error al guardar cliente');
      }

      toast(
        cliente ? "Cliente actualizado" : "Cliente creado",
        { description: `${normalized.nombre} ${normalized.apellido_paterno} ha sido ${cliente ? 'actualizado' : 'creado'} correctamente` }
      )

      onSuccess()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar cliente'
      toast("Error", {
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ✅ Debounced validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (numeroDocumento && tipoDocumento) {
        validateDocument(numeroDocumento)
      }
    }, 500) // Esperar 500ms después de que el usuario deje de escribir

    return () => clearTimeout(timeoutId)
  }, [numeroDocumento, tipoDocumento, validateDocument])

  useEffect(() => {
    if (!registrarEmpresa) {
      setEmpresaDocumentValidation(null)
      return
    }

    if (!empresaRuc || empresaRuc.length !== 11) {
      setEmpresaDocumentValidation(null)
      return
    }

    const timeoutId = setTimeout(() => {
      validateEmpresaRuc(empresaRuc)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [registrarEmpresa, empresaRuc, validateEmpresaRuc])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        </CardTitle>
        <CardDescription>
          {cliente 
            ? 'Modifica la información del cliente'
            : 'Completa los datos para registrar un nuevo cliente'
          }
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información Personal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Información Personal</h3>

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
                <Label htmlFor="sexo">Sexo</Label>
                <Select
                  {...register('sexo')}
                  onValueChange={(value) => setValue('sexo', value)}
                  defaultValue={form.getValues('sexo') || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="fecha_nacimiento">Fecha de nacimiento *</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  max={maxBirthDate}
                  min="1900-01-01"
                  {...register('fecha_nacimiento', {
                    required: 'La fecha de nacimiento es requerida'
                  })}
                />
                {errors.fecha_nacimiento && (
                  <p className="text-red-500 text-sm mt-1">{errors.fecha_nacimiento.message}</p>
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
                <FormField
                  control={control}
                  name="tipo_documento"
                  rules={{ required: 'El tipo de documento es requerido' }}
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="tipo_documento">Tipo de Documento *</Label>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DNI">DNI</SelectItem>
                          <SelectItem value="RUC">RUC</SelectItem>
                          <SelectItem value="CE">Carné de Extranjería</SelectItem>
                          <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="numero_documento">
                  Número de Documento *
                  {tipoDocumento === 'DNI' && ' (8 dígitos)'}
                  {tipoDocumento === 'RUC' && ' (11 dígitos)'}
                </Label>
                <div className="relative">
                  <Input
                    id="numero_documento"
                    {...register('numero_documento', {
                      required: 'El número de documento es requerido',
                      pattern: {
                        value:
                          tipoDocumento === 'DNI'
                            ? /^\d{8}$/
                            : tipoDocumento === 'RUC'
                              ? /^\d{11}$/
                              : /^.{3,}$/,
                        message:
                          tipoDocumento === 'DNI'
                            ? 'El DNI debe tener 8 dígitos'
                            : tipoDocumento === 'RUC'
                              ? 'El RUC debe tener 11 dígitos'
                              : 'Debe contener al menos 3 caracteres'
                      }
                    })}
                    placeholder={
                      tipoDocumento === 'DNI'
                        ? '12345678'
                        : tipoDocumento === 'RUC'
                          ? '20123456789'
                          : 'Número de documento'
                    }
                    className={documentValidation?.isValid === false ? 'border-red-500' : ''}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {validatingDocument && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                    {!validatingDocument && documentValidation && (
                      <>
                        {documentValidation.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </>
                    )}
                  </div>
                </div>
                {errors.numero_documento && !documentValidation && (
                  <p className="text-red-500 text-sm mt-1">{errors.numero_documento.message}</p>
                )}
                {documentValidation && !validatingDocument && (
                  <p
                    className={`text-sm mt-1 ${documentValidation.type === 'error' ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {documentValidation.message}
                  </p>
                )}
              </div>

              {tipoDocumento === 'RUC' && (
                <div className="md:col-span-2">
                  <Label htmlFor="nombre_comercial">Nombre comercial (opcional)</Label>
                  <Input
                    id="nombre_comercial"
                    {...register('nombre_comercial', {
                      maxLength: {
                        value: 150,
                        message: 'El nombre comercial no puede superar 150 caracteres'
                      }
                    })}
                    placeholder="Ej. Servicios Automotrices Lima"
                  />
                  {errors.nombre_comercial && (
                    <p className="text-red-500 text-sm mt-1">{errors.nombre_comercial.message}</p>
                  )}
                </div>
              )}
            </div>

            {tipoDocumento === 'RUC' && (
              <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Registro con RUC</AlertTitle>
                <AlertDescription>
                  Ya estás registrando una persona con RUC, por lo que no es necesario asociar una empresa adicional.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Información de Contacto */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Información de Contacto</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  {...register('telefono', {
                    pattern: {
                      value: /^\d{6,15}$/,
                      message: 'El teléfono debe tener entre 6 y 15 dígitos'
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
                  placeholder="cliente@email.com"
                />
                {errors.correo && (
                  <p className="text-red-500 text-sm mt-1">{errors.correo.message}</p>
                )}
              </div>
            </div>
          </div>

          {tipoDocumento !== 'RUC' && (
            <>
              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Empresa asociada (opcional)</h3>

                <FormField
                  control={control}
                  name="registrar_empresa"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div>
                        <Label className="text-base" htmlFor="registrar_empresa_switch">
                          ¿Registrar empresa asociada?
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Permite emitir facturas a nombre de la empresa representante.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          id="registrar_empresa_switch"
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {registrarEmpresa && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="empresa_ruc">RUC de la empresa *</Label>
                        <div className="relative">
                          <Input
                            id="empresa_ruc"
                            {...register('empresa.ruc', {
                              required: registrarEmpresa ? 'El RUC es requerido' : undefined,
                              pattern: registrarEmpresa
                                ? {
                                    value: /^\d{11}$/,
                                    message: 'El RUC debe tener 11 dígitos'
                                  }
                                : undefined
                            })}
                            placeholder="20123456789"
                            className={empresaDocumentValidation?.isValid === false ? 'border-red-500' : ''}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            {validatingEmpresa && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            )}
                            {!validatingEmpresa && empresaDocumentValidation && (
                              <>
                                {empresaDocumentValidation.isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {errors.empresa?.ruc?.message && !empresaDocumentValidation && (
                          <p className="text-red-500 text-sm mt-1">{errors.empresa?.ruc?.message}</p>
                        )}
                        {empresaDocumentValidation && !validatingEmpresa && (
                          <p
                            className={`text-sm mt-1 ${empresaDocumentValidation.type === 'error' ? 'text-red-500' : 'text-green-600'}`}
                          >
                            {empresaDocumentValidation.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="empresa_razon_social">Razón social *</Label>
                        <Input
                          id="empresa_razon_social"
                          {...register('empresa.razon_social', {
                            required: registrarEmpresa ? 'La razón social es requerida' : undefined
                          })}
                          placeholder="Empresa S.A.C."
                        />
                        {errors.empresa?.razon_social?.message && (
                          <p className="text-red-500 text-sm mt-1">{errors.empresa?.razon_social?.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="empresa_nombre_comercial">Nombre comercial (opcional)</Label>
                        <Input
                          id="empresa_nombre_comercial"
                          {...register('empresa.nombre_comercial')}
                          placeholder="Nombre comercial"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="empresa_direccion_fiscal">Dirección fiscal</Label>
                        <Textarea
                          id="empresa_direccion_fiscal"
                          {...register('empresa.direccion_fiscal')}
                          placeholder="Dirección fiscal de la empresa"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                ? (cliente ? 'Actualizando...' : 'Creando...') 
                : (cliente ? 'Actualizar Cliente' : 'Crear Cliente')
              }
            </Button>
          </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}