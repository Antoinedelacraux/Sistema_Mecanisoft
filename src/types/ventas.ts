import { Prisma, type EstadoComprobante, type OrigenComprobante, type TipoComprobante } from '@prisma/client'

type EstadoPagoVenta = Prisma.$Enums.EstadoPagoVenta
type MetodoPagoVenta = Prisma.$Enums.MetodoPagoVenta

export type VentaListadoItem = {
  id_venta: number
  fecha: string
  total: number
  total_pagado: number
  saldo: number
  estado_pago: EstadoPagoVenta
  metodo_principal: MetodoPagoVenta | null
  comprobante: {
    id_comprobante: number
    serie: string
    numero: number
    codigo: string | null
    estado: EstadoComprobante
    tipo: TipoComprobante
    receptor_nombre: string
    receptor_documento: string
    origen_tipo: OrigenComprobante
    origen_id: number
    fecha_emision: string | null
    total: number
    estado_pago: string
    descripcion: string | null
  }
  pagos: Array<{
    id_venta_pago: number
    metodo: MetodoPagoVenta
    monto: number
    referencia: string | null
    fecha_pago: string
    notas: string | null
    registrado_por: number
  }>
  items: number
}

export type VentasResponse = {
  ventas: VentaListadoItem[]
  pagination: {
    total: number
    pages: number
    current: number
    limit: number
  }
}

export type ResumenVentas = {
  totalVentas: number
  numeroComprobantes: number
  promedio: number
  porMetodo: Record<MetodoPagoVenta | 'SIN_REGISTRO', number>
  porEstadoPago: Record<EstadoPagoVenta, number>
}
