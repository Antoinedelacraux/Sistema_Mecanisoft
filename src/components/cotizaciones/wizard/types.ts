import type { ProductoCompleto, ServicioCompleto } from '@/types'

export type CotizacionModo = 'solo_servicios' | 'solo_productos' | 'servicios_y_productos'
export type CotizacionStep = 'modo' | 'cliente' | 'vehiculo' | 'items' | 'resumen'

export type CatalogoItem =
  | { tipo: 'producto'; producto: ProductoCompleto }
  | { tipo: 'servicio'; servicio: ServicioCompleto }

export interface ItemCotizacion {
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
  servicio_ref?: number | null
}
