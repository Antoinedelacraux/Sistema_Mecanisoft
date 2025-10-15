import type { MovimientoBasicoTipo, Prisma } from '@prisma/client'

export type RegistrarProveedorPayload = {
  nombre: string
  creado_por: number
  ruc: string
  contacto?: string | null
  numero_contacto?: string | null
  telefono?: string | null
  correo?: string | null
  nombre_comercial?: string | null
}

export type ProveedorBasico = {
  id_proveedor: number
  razon_social: string
  contacto: string | null
  numero_contacto: string | null
  telefono: string | null
  correo: string | null
  nombre_comercial: string | null
  ruc: string | null
}

export type RegistrarCompraLineaPayload = {
  id_producto: number
  cantidad: Prisma.Decimal | number | string
  precio_unitario: Prisma.Decimal | number | string
}

export type RegistrarCompraPayload = {
  id_proveedor: number
  creado_por: number
  lineas: RegistrarCompraLineaPayload[]
  fecha?: Date
}

export type RegistrarCompraResultado = {
  compraId: number
  total: string
  totalLineas: number
}

export type RegistrarSalidaPayload = {
  id_producto: number
  id_usuario: number
  cantidad: Prisma.Decimal | number | string
  referencia?: string | null
}

export type RegistrarAjustePayload = {
  id_producto: number
  id_usuario: number
  cantidad: Prisma.Decimal | number | string
  motivo: string
  esIncremento: boolean
}

export type MovimientoBasicoResultado = {
  movimientoId: number
  id_producto: number
  tipo: MovimientoBasicoTipo
  cantidad: string
  stock_disponible: string
  referencia: string | null
}

export type MovimientoSerializado = {
  id_movimiento: number
  tipo: MovimientoBasicoTipo
  cantidad: string
  costo_unitario: string | null
  referencia: string | null
  creado_en: string
}

export type ResumenInventario = {
  id_producto: number
  stock_disponible: string
  stock_comprometido: string
  costo_promedio: string
  actualizado_en: string
}

export type StockDetalle = {
  inventario: ResumenInventario
  movimientos: MovimientoSerializado[]
}
