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
  cliente: Cliente & {
    persona: Persona
  }
  modelo: Modelo & {
    marca: Marca
  }
}

export type MarcaCompleta = Marca & {
  _count: {
    modelos: number
  }
}

export type ModeloCompleto = Modelo & {
  marca: Marca
  _count: {
    vehiculos: number
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

export type MarcaFormData = {
  nombre_marca: string
  descripcion?: string
}

export type ModeloFormData = {
  id_marca: number
  nombre_modelo: string
  descripcion?: string
}

// Opciones para selects
export type SelectOption = {
  value: string
  label: string
}