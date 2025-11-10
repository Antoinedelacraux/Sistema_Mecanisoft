import type { Servicio, Producto, Cliente, Vehiculo } from '@prisma/client'

export type ClienteConPersona = Cliente & {
  persona: {
    nombre: string
    apellido_paterno: string
    apellido_materno?: string | null
  }
}

export type VehiculoConModelo = Vehiculo & {
  modelo: {
    nombre_modelo: string
    marca: {
      nombre_marca: string
    }
  }
}

export type ItemTipo = 'producto' | 'servicio'

export interface ItemValidado {
  id_producto?: number
  id_servicio?: number
  cantidad: number
  precio: number
  descuento: number
  total: number
  tipo: ItemTipo
  servicio_ref?: number
  almacenId?: number
  ubicacionId?: number | null
  tiempo_servicio?: {
    minimo: number
    maximo: number
    unidad: string
    minimoMinutos: number
    maximoMinutos: number
  }
}

export interface CatalogosCargados {
  productos: Map<number, Producto>
  servicios: Map<number, Servicio>
}

export interface ContextoValidacion {
  idCliente: number
  idVehiculo: number
  trabajadorPrincipalId: number | null
  trabajadoresSecundarios: number[]
  cliente: ClienteConPersona
  vehiculo: VehiculoConModelo
  almacenReservaId: number
  modoSoloServicios: boolean
  itemsValidados: ItemValidado[]
  subtotal: number
  totalMinutosMin: number
  totalMinutosMax: number
}
