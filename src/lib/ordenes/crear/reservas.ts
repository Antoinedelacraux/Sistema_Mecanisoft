import type { Prisma } from '@prisma/client'

import { reservarStockEnTx } from '@/lib/inventario/reservas'

import type { ItemValidado } from './types'

export interface ProcesarItemsOptions {
  transaccionId: number
  codigoOrden: string
  trabajadorAsignadoInicial: number | null
  estadoInicialTarea: 'por_hacer' | 'pendiente'
  almacenReservaFallback: number
  usuarioId: number
}

export async function crearDetallesYReservas(
  tx: Prisma.TransactionClient,
  itemsValidados: ItemValidado[],
  opciones: ProcesarItemsOptions,
): Promise<void> {
  const mapaDetalleServicio = new Map<number, number>()

  for (const item of itemsValidados.filter((i) => i.tipo === 'servicio')) {
    const detalle = await tx.detalleTransaccion.create({
      data: {
        id_transaccion: opciones.transaccionId,
        id_servicio: item.id_servicio ?? null,
        cantidad: item.cantidad,
        precio: item.precio,
        descuento: item.descuento,
        total: item.total,
      },
    })
    mapaDetalleServicio.set(item.id_servicio!, detalle.id_detalle_transaccion)

    const estimado = item.tiempo_servicio ? item.tiempo_servicio.maximoMinutos : 60
    try {
      await tx.tarea.create({
        data: {
          id_detalle_transaccion: detalle.id_detalle_transaccion,
          id_trabajador: opciones.trabajadorAsignadoInicial,
          estado: opciones.estadoInicialTarea,
          tiempo_estimado: estimado,
        },
      })
    } catch (error) {
      console.warn('Fallo creación de tarea automática', error)
    }
  }

  for (const item of itemsValidados.filter((i) => i.tipo === 'producto')) {
    const detalleProducto = await tx.detalleTransaccion.create({
      data: {
        id_transaccion: opciones.transaccionId,
        id_producto: item.id_producto ?? null,
        cantidad: item.cantidad,
        precio: item.precio,
        descuento: item.descuento,
        total: item.total,
        id_detalle_servicio_asociado: item.servicio_ref ? mapaDetalleServicio.get(item.servicio_ref) ?? null : null,
      },
    })

    await reservarStockEnTx(tx, {
      productoId: item.id_producto!,
      almacenId: item.almacenId ?? opciones.almacenReservaFallback,
      ubicacionId: item.ubicacionId ?? null,
      usuarioId: opciones.usuarioId,
      cantidad: item.cantidad,
      transaccionId: opciones.transaccionId,
      detalleTransaccionId: detalleProducto.id_detalle_transaccion,
      motivo: `Reserva para orden ${opciones.codigoOrden}`,
      metadata: {
        origen: 'orden_trabajo',
        codigo_transaccion: opciones.codigoOrden,
        almacen_id: item.almacenId ?? opciones.almacenReservaFallback,
        ubicacion_id: item.ubicacionId ?? null,
      },
    })
  }
}
