'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
  const { toast } = useToast()

  const form = useForm<ClienteFormData>({
    defaultValues: cliente ? {
      nombre: cliente.persona.nombre,
      apellido_paterno: cliente.persona.apellido_paterno,
      apellido_materno: cliente.persona.apellido_materno || '',
      tipo_documento: cliente.persona.tipo_documento,
      numero_documento: cliente.persona.numero_documento,
      sexo: cliente.persona.sexo || '',
      telefono: cliente.persona.telefono || '',
      correo: cliente.persona.correo || '',
      empresa: cliente.persona.empresa || ''
    } : {}
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

      const url = cliente 
        ? `/api/clientes/${cliente.id_cliente}`
        : '/api/clientes'
      
      const method = cliente ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar cliente')
      }

      toast(
        cliente ? "Cliente actualizado" : "Cliente creado",
        { description: `${data.nombre} ${data.apellido_paterno} ha sido ${cliente ? 'actualizado' : 'creado'} correctamente` }
      )

      onSuccess()
    } catch (error: any) {
      toast("Error", {
        description: error.message,
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
                  defaultValue={cliente?.persona.sexo || ''}
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
                        value: tipoDocumento === 'DNI'
                          ? /^\d{8}$/
                          : tipoDocumento === 'RUC'
                            ? /^\d{11}$/
                            : /^.+$/,
                        message: tipoDocumento === 'DNI'
                          ? 'DNI debe tener 8 dígitos'
                          : tipoDocumento === 'RUC'
                            ? 'RUC debe tener 11 dígitos'
                            : 'Formato inválido'
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
                  <p className={`text-sm mt-1 ${documentValidation.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{documentValidation.message}</p>
                )}
              </div>
            </div>
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
                  placeholder="cliente@email.com"
                />
                {errors.correo && (
                  <p className="text-red-500 text-sm mt-1">{errors.correo.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="empresa">Empresa (opcional)</Label>
                <Input
                  id="empresa"
                  {...register('empresa')}
                  placeholder="Nombre de la empresa"
                />
              </div>
            </div>
          </div>

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