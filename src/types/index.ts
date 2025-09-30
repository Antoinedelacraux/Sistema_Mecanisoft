import { Persona, Cliente, Vehiculo, Marca, Modelo } from '@prisma/client'
import { Producto, Categoria, Fabricante, UnidadMedida } from '@prisma/client'

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

export type ProductoCompleto = Producto & {
  categoria: Categoria
  fabricante: Fabricante
  unidad_medida: UnidadMedida
}

export type CategoriaCompleta = Categoria & {
  _count: {
    productos: number
  }
  estatus: boolean
}
export type FabricanteCompleto = Fabricante & {
  _count: {
    productos: number
  }
  estatus: boolean
}
export type UnidadCompleta = UnidadMedida & {
  _count: {
    productos: number
  }
  estatus: boolean
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

export type ProductoFormData = {
  id_categoria: number
  id_fabricante: number
  id_unidad: number
  tipo: string
  codigo_producto: string
  nombre: string
  descripcion?: string
  stock: number
  stock_minimo: number
  precio_compra: number
  precio_venta: number
  descuento?: number
  oferta?: boolean
}
export type CategoriaFormData = {
  nombre: string
}
export type FabricanteFormData = {
  nombre_fabricante: string
  descripcion?: string
}
export type UnidadFormData = {
  nombre_unidad: string
  abreviatura: string
}

// Opciones para selects
export type SelectOption = {
  value: string
  label: string
}