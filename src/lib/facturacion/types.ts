import type { TipoComprobante, TipoItemComprobante } from '@prisma/client'

export type FacturacionOrigenTipo = 'COTIZACION' | 'ORDEN'

export type FacturacionItem = {
  tipo: TipoItemComprobante
  descripcion: string
  cantidad: number
  unidad_medida?: string | null
  precio_unitario: number
  descuento: number
  subtotal: number
  igv: number
  total: number
  id_producto?: number | null
  id_servicio?: number | null
  metadata?: Record<string, unknown> | null
}

export type FacturacionTotales = {
  subtotal: number
  igv: number
  total: number
  precios_incluyen_igv: boolean
}

export type FacturacionReceptor = {
  persona_id: number
  nombre: string
  documento: string
  direccion?: string | null
  correo?: string | null
  telefono?: string | null
}

export type FacturacionEmpresa = {
  id_empresa_persona: number
  razon_social: string
  ruc: string
  direccion_fiscal?: string | null
  nombre_comercial?: string | null
}

export type FacturacionVehiculo = {
  placa: string
  marca: string
  modelo: string
} | null

export type FacturacionPayload = {
  origen_tipo: FacturacionOrigenTipo
  origen_id: number
  origen_codigo?: string | null
  tipo_comprobante_sugerido: TipoComprobante
  receptor: FacturacionReceptor
  empresa_asociada?: FacturacionEmpresa | null
  vehiculo: FacturacionVehiculo
  totales: FacturacionTotales
  items: FacturacionItem[]
  notas?: string | null
  descripcion?: string | null
}

export type FacturacionBorradorInput = {
  usuario_id: number
  cliente_id: number
  persona_id: number
  empresa_persona_id?: number | null
  receptor_nombre: string
  receptor_documento: string
  receptor_direccion?: string | null
  origen_tipo: FacturacionOrigenTipo
  origen_id: number
  origen_codigo?: string | null
  serie?: string
  tipo_comprobante?: TipoComprobante
  override_tipo_comprobante?: TipoComprobante | null
  motivo_override?: string | null
  notas?: string | null
  descripcion?: string | null
  precios_incluyen_igv?: boolean
  items: FacturacionItem[]
  totales: FacturacionTotales
}
