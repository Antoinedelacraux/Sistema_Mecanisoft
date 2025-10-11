import { ProductoCompleto, ServicioCompleto } from '@/types'

export type Step = 'modo' | 'cliente' | 'vehiculo' | 'servicios' | 'asignacion' | 'resumen'

export type CatalogoItem =
  | { tipo: 'producto'; producto: ProductoCompleto }
  | { tipo: 'servicio'; servicio: ServicioCompleto }

export interface ItemOrden {
  id_referencia: number
  tipo: 'producto' | 'servicio'
  nombre: string
  codigo: string
  cantidad: number
  precio_unitario: number
  descuento: number
  total: number
  oferta: boolean
  permiteEditarDescuento: boolean
  // Asociación opcional: si el item es producto, puede referenciar el id del servicio en la misma orden
  servicio_ref?: number | null
  almacenId?: number | null
  ubicacionId?: number | null
}