import { z } from 'zod'

export const ordenItemSchema = z.object({
  id_producto: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  cantidad: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  precio_unitario: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)]),
  descuento: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)]).optional(),
  tipo: z.enum(['producto', 'servicio']).optional(),
  servicio_ref: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  almacen_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  ubicacion_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/), z.null()]).optional()
})

export const crearOrdenSchema = z.object({
  id_cliente: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  id_vehiculo: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  id_trabajador_principal: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  fecha_fin_estimada: z.union([z.coerce.date(), z.string().regex(/^[0-9T:.-]+Z?$/)]).optional(),
  observaciones: z.string().max(1000).optional(),
  modo_orden: z.enum(['solo_servicios', 'servicios_y_productos']).optional(),
  items: z.array(ordenItemSchema).min(1),
  trabajadores_secundarios: z.array(z.union([z.number().int().positive(), z.string().regex(/^\d+$/)])).optional()
})

const positiveNumeric = z.union([
  z.number().positive(),
  z.string().regex(/^\d+(\.\d+)?$/).refine((value) => Number(value) > 0, 'Debe ser mayor a cero')
])

export const registrarPagoSchema = z.object({
  monto: positiveNumeric,
  tipo_pago: z.string().max(50).optional(),
  numero_operacion: z.union([z.string().max(100), z.null()]).optional(),
  observaciones: z.union([z.string().max(500), z.null()]).optional()
})

export const actualizarOrdenSchema = z.object({
  id_transaccion: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  nuevo_estado: z.enum(['pendiente', 'por_hacer', 'en_proceso', 'pausado', 'completado', 'entregado']).optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  asignar_trabajador: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  fecha_fin_estimada: z.union([z.instanceof(Date), z.string().regex(/^[0-9T:.-]+Z?$/), z.null()]).optional(),
  agregar_trabajadores: z.array(z.union([z.number().int().positive(), z.string().regex(/^\d+$/)])).optional(),
  remover_trabajadores: z.array(z.union([z.number().int().positive(), z.string().regex(/^\d+$/)])).optional(),
  generar_tareas_faltantes: z.boolean().optional(),
  registrar_pago: registrarPagoSchema.nullable().optional(),
  observaciones: z.string().max(1000).optional(),
  id_vehiculo: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  items: z.array(ordenItemSchema).min(1).optional()
})

export type OrdenItemInput = z.infer<typeof ordenItemSchema>
export type CrearOrdenInput = z.infer<typeof crearOrdenSchema>
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>
export type ActualizarOrdenInput = z.infer<typeof actualizarOrdenSchema>
