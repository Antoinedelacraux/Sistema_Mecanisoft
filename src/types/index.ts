import { Persona, Cliente, Vehiculo, Marca, Modelo } from '@prisma/client'

// Tipos extendidos para incluir relaciones
export type ClienteCompleto = Cliente & {
  persona: Persona
  vehiculos: VehiculoCompleto[]
  _count: {
    vehiculos: number
  }
}

export type VehiculoCompleto = Vehiculo & {
  cliente: {
    persona: Persona
  }
  modelo: Modelo & {
    marca: Marca
  }
}

// Tipos para formularios
export type ClienteFormData = {
  // Datos de persona
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  tipo_documento: string
  numero_documento: string
  sexo?: string
  telefono?: string
  correo?: string
  empresa?: string
}

export type VehiculoFormData = {
  id_cliente: number
  id_modelo: number
  placa: string
  tipo: string
  año: number
  tipo_combustible: string
  transmision: string
  numero_chasis?: string
  numero_motor?: string
  observaciones?: string
}

// Opciones para selects
export type SelectOption = {
  value: string
  label: string
}