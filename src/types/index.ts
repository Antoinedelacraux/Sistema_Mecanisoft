import type { Persona, Cliente, Vehiculo, Marca, Modelo, Trabajador, Usuario, Rol, Cotizacion, DetalleCotizacion, Pago, Tarea, Transaccion, DetalleTransaccion, Producto, Categoria, Fabricante, UnidadMedida } from '@prisma/client'

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
  foto?: string | null
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

export type TrabajadorFormData = {
  // Datos de persona
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  tipo_documento: string
  numero_documento: string
  telefono?: string
  correo?: string
  // Datos de usuario
  nombre_usuario: string
  password: string
  // Datos de trabajador
  especialidad: string
  nivel_experiencia: string
  tarifa_hora?: number
}
export type CotizacionFormData = {
  id_cliente: number
  id_vehiculo: number
  vigencia_dias: number
  observaciones?: string
  items: {
    id_producto: number
    cantidad: number
    precio_unitario: number
    descuento: number
  }[]
}
export type OrdenFormData = {
  id_cliente: number
  id_vehiculo: number
  id_trabajador_principal: number
  prioridad: string
  fecha_fin_estimada?: Date
  observaciones?: string
  items: {
    id_producto: number
    cantidad: number
    precio_unitario: number
    descuento: number
  }[]
}
export type PagoFormData = {
  tipo_pago: string
  monto: number
  numero_operacion?: string
  observaciones?: string
}

// Opciones para selects
export type SelectOption = {
  value: string
  label: string
}

// ✅ Tipos para trabajadores y relacionados
export type TrabajadorCompleto = Trabajador & {
  usuario: Usuario & {
    persona: Persona
    rol: Rol
  }
  _count: {
    tareas_asignadas: number
    ordenes_principales: number
  }
}

export type CotizacionCompleta = Cotizacion & {
  cliente: Cliente & {
    persona: Persona
  }
  vehiculo: Vehiculo & {
    modelo: Modelo & {
      marca: Marca
    }
  }
  usuario: Usuario & {
    persona: Persona
  }
  detalle_cotizacion: (DetalleCotizacion & {
    producto: Producto
  })[]
}

export type TareaCompleta = Tarea & {
  detalle_transaccion: DetalleTransaccion & {
    producto: Producto
    transaccion: Transaccion & {
      cliente?: Cliente & {
        persona: Persona
      }
      vehiculo?: Vehiculo & {
        placa: string
      }
    }
  }
  trabajador: TrabajadorCompleto
}

export type PagoCompleto = Pago & {
  transaccion: Transaccion
  usuario_registro: Usuario & {
    persona: Persona
  }
}