import type { PrismaClient, Prisma } from '@prisma/client'
import { ReservaEstado } from '@prisma/client'
import { ZodError } from 'zod'
import { confirmarReservaEnTx, liberarReservaEnTx, reservarStockEnTx } from '@/lib/inventario/reservas'
import { calcularProgresoOrden, convertirATotalMinutos, isUniqueConstraintError, toInt } from './helpers'
import { OrdenServiceError } from './errors'
import { actualizarOrdenSchema, type ActualizarOrdenInput } from './validators'

export interface ActualizarOrdenResultado {
  status: number
  body: unknown
}

export async function actualizarOrden(
  prisma: PrismaClient,
  body: ActualizarOrdenInput,
  usuarioId: number
): Promise<ActualizarOrdenResultado> {
  let input: ActualizarOrdenInput
  try {
    input = actualizarOrdenSchema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new OrdenServiceError(400, 'Datos de entrada inválidos', { issues: error.issues })
    }
    throw error
  }

  const idTransaccion = toInt(input.id_transaccion)
  if (!idTransaccion) {
    throw new OrdenServiceError(400, 'id_transaccion requerido')
  }

  const orden = await prisma.transaccion.findUnique({ where: { id_transaccion: idTransaccion } })
  if (!orden || orden.tipo_transaccion !== 'orden') {
    throw new OrdenServiceError(404, 'Orden no encontrada')
  }

  const nuevoEstado = input.nuevo_estado as string | undefined
  const validEstados = ['pendiente', 'por_hacer', 'en_proceso', 'pausado', 'completado', 'entregado'] as const
  if (nuevoEstado && !validEstados.includes(nuevoEstado as typeof validEstados[number])) {
    throw new OrdenServiceError(400, 'Estado inválido')
  }

  const transiciones: Record<string, string[]> = {
    pendiente: ['por_hacer'],
    asignado: ['por_hacer'],
    por_hacer: ['en_proceso', 'pausado'],
    en_proceso: ['pausado', 'completado'],
    pausado: ['en_proceso', 'completado'],
    completado: ['entregado'],
    entregado: []
  }

  if (nuevoEstado && orden.estado_orden && !transiciones[orden.estado_orden]?.includes(nuevoEstado)) {
    throw new OrdenServiceError(400, `Transición no permitida (${orden.estado_orden} -> ${nuevoEstado})`)
  }

  if (orden.estado_orden !== 'pendiente' && (!nuevoEstado || nuevoEstado !== 'por_hacer')) {
    throw new OrdenServiceError(403, 'Solo se puede editar órdenes en estado pendiente.')
  }

  if (nuevoEstado === 'por_hacer') {
    const detalles = await prisma.detalleTransaccion.findMany({
      where: { id_transaccion: orden.id_transaccion },
      include: { producto: true, servicio: true }
    })
    const tieneServicio = detalles.some((d) => d.servicio != null)
    if (!tieneServicio) {
      throw new OrdenServiceError(400, 'La orden debe tener al menos un servicio registrado.')
    }
    if (!orden.id_trabajador_principal) {
      throw new OrdenServiceError(400, 'La orden debe tener un mecánico principal asignado.')
    }
  }

  const dataUpdate: Prisma.TransaccionUpdateInput = {}
  if (input.prioridad) dataUpdate.prioridad = input.prioridad
  if (input.fecha_fin_estimada !== undefined) {
    dataUpdate.fecha_fin_estimada = input.fecha_fin_estimada === null ? null : new Date(input.fecha_fin_estimada)
  }
  if (typeof input.observaciones === 'string') dataUpdate.observaciones = input.observaciones
  if (nuevoEstado) {
    dataUpdate.estado_orden = nuevoEstado
    if (nuevoEstado === 'en_proceso' && !orden.fecha_inicio) dataUpdate.fecha_inicio = new Date()
    if (nuevoEstado === 'completado' && !orden.fecha_fin_real) dataUpdate.fecha_fin_real = new Date()
    if (nuevoEstado === 'entregado' && !orden.fecha_entrega) {
      dataUpdate.fecha_entrega = new Date()
      ;(dataUpdate as Record<string, unknown>).entregado_por = usuarioId
    }
  }

  let asignadoPrincipalAhora = false
  const asignarTrabajador = toInt(input.asignar_trabajador)
  if (asignarTrabajador) {
    const trabajador = await prisma.trabajador.findUnique({
      where: { id_trabajador: asignarTrabajador },
      select: { id_trabajador: true, activo: true }
    })
    if (!trabajador || !trabajador.activo) {
      throw new OrdenServiceError(400, 'Trabajador no disponible')
    }
    dataUpdate.trabajador_principal = { connect: { id_trabajador: trabajador.id_trabajador } }
    if (orden.estado_orden === 'pendiente' && !nuevoEstado) dataUpdate.estado_orden = 'asignado'
    asignadoPrincipalAhora = true
  }

  if (Array.isArray(input.agregar_trabajadores)) {
    for (const tRaw of input.agregar_trabajadores) {
      const idT = toInt(tRaw)
      if (!idT) continue
      try {
        await prisma.transaccionTrabajador.create({
          data: { id_transaccion: idTransaccion, id_trabajador: idT, rol: 'apoyo' }
        })
      } catch (e) {
        if (!isUniqueConstraintError(e)) {
          console.warn('Error agregando trabajador apoyo', e)
        }
      }
    }
  }

  if (Array.isArray(input.remover_trabajadores)) {
    for (const tRaw of input.remover_trabajadores) {
      const idT = toInt(tRaw)
      if (!idT) continue
      try {
        await prisma.transaccionTrabajador.delete({
          where: { id_transaccion_id_trabajador: { id_transaccion: idTransaccion, id_trabajador: idT } }
        })
      } catch {
        // ignorar
      }
    }
  }

  const updated = await prisma.transaccion.update({
    where: { id_transaccion: idTransaccion },
    data: dataUpdate,
    include: { persona: true }
  })

  const idVehiculoNuevo = toInt(input.id_vehiculo)
  if (orden.estado_orden === 'pendiente' && idVehiculoNuevo) {
    try {
      const pivots = await prisma.transaccionVehiculo.findMany({ where: { id_transaccion: idTransaccion } })
      for (const p of pivots) {
        await prisma.transaccionVehiculo.delete({
          where: { id_transaccion_id_vehiculo: { id_transaccion: p.id_transaccion, id_vehiculo: p.id_vehiculo } }
        })
      }
      await prisma.transaccionVehiculo.create({
        data: {
          id_transaccion: idTransaccion,
          id_vehiculo: idVehiculoNuevo,
          id_usuario: usuarioId,
          descripcion: `Cambio de vehículo en edición de orden ${updated.codigo_transaccion}`
        }
      })
    } catch (e) {
      console.warn('No se pudo actualizar el vehículo de la orden', e)
    }
  }

  if (orden.estado_orden === 'pendiente' && Array.isArray(input.items) && input.items.length > 0) {
    const parsedItems = input.items
    const productoIds = [...new Set(parsedItems.map((i) => toInt(i.id_producto)).filter((n): n is number => Boolean(n)))]
    const [productos, servicios] = await Promise.all([
      prisma.producto.findMany({ where: { id_producto: { in: productoIds } } }),
      prisma.servicio.findMany({ where: { id_servicio: { in: productoIds } } })
    ])
    const productosMap = new Map(productos.map((p) => [p.id_producto, p]))
    const serviciosMap = new Map(servicios.map((s) => [s.id_servicio, s]))

    const almacenPrincipal = await prisma.almacen.findFirst({
      where: { activo: true },
      orderBy: { id_almacen: 'asc' }
    })
    if (!almacenPrincipal) {
      throw new OrdenServiceError(409, 'No hay almacenes activos configurados')
    }
    const almacenReservaId = almacenPrincipal.id_almacen

    let subtotal = 0
    let totalMinutosMin = 0
    let totalMinutosMax = 0

    const itemsValidados: Array<{
      id_producto?: number
      id_servicio?: number
      cantidad: number
      precio: number
      descuento: number
      total: number
      tipo: 'producto' | 'servicio'
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
    }> = []

    for (const raw of parsedItems) {
      const idProducto = toInt(raw.id_producto)
      if (!idProducto) {
        throw new OrdenServiceError(400, 'ID de producto/servicio inválido')
      }
      const tipoSolicitado = raw.tipo
      const producto = productosMap.get(idProducto)
      const servicio = serviciosMap.get(idProducto)
      let tipo: 'producto' | 'servicio'
      if (tipoSolicitado === 'producto') {
        if (!producto || producto.estatus === false) throw new OrdenServiceError(400, `Producto con ID ${idProducto} no está disponible`)
        tipo = 'producto'
      } else if (tipoSolicitado === 'servicio') {
        if (!servicio || servicio.estatus === false) throw new OrdenServiceError(400, `Servicio con ID ${idProducto} no está disponible`)
        tipo = 'servicio'
      } else if (servicio && servicio.estatus !== false) {
        tipo = 'servicio'
      } else if (producto && producto.estatus !== false) {
        tipo = 'producto'
      } else {
        throw new OrdenServiceError(400, `Item con ID ${idProducto} no está disponible`)
      }

      const cantidad = toInt(raw.cantidad)
      if (!cantidad) throw new OrdenServiceError(400, `Cantidad inválida para item ${idProducto}`)

      const precio = typeof raw.precio_unitario === 'string' ? parseFloat(raw.precio_unitario) : (raw.precio_unitario as number)
      const descuento = raw.descuento ? (typeof raw.descuento === 'string' ? parseFloat(raw.descuento) : Number(raw.descuento)) : 0
      if (descuento < 0 || descuento > 100) throw new OrdenServiceError(400, `Descuento inválido para item ${idProducto}`)
      if (tipo === 'producto' && producto && producto.stock < cantidad) {
        throw new OrdenServiceError(400, `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`)
      }

      const almacenSeleccionado = tipo === 'producto' ? toInt(raw.almacen_id) ?? almacenReservaId : undefined
      const ubicacionSeleccionada = tipo === 'producto'
        ? (raw.ubicacion_id === null || raw.ubicacion_id === undefined ? null : toInt(raw.ubicacion_id) ?? null)
        : undefined

      if (tipo === 'producto' && !almacenSeleccionado) {
        throw new OrdenServiceError(400, `Debe seleccionar un almacén válido para el producto ${producto?.nombre || idProducto}`)
      }

      const totalItem = cantidad * precio * (1 - descuento / 100)
      subtotal += totalItem
      const servicioInfo = serviciosMap.get(idProducto)
      const tiempoServicio = tipo === 'servicio' && servicioInfo
        ? {
            minimo: servicioInfo.tiempo_minimo,
            maximo: servicioInfo.tiempo_maximo,
            unidad: servicioInfo.unidad_tiempo,
            minimoMinutos: convertirATotalMinutos(servicioInfo.tiempo_minimo, servicioInfo.unidad_tiempo) * cantidad,
            maximoMinutos: convertirATotalMinutos(servicioInfo.tiempo_maximo, servicioInfo.unidad_tiempo) * cantidad
          }
        : undefined
      if (tiempoServicio) {
        totalMinutosMin += tiempoServicio.minimoMinutos
        totalMinutosMax += tiempoServicio.maximoMinutos
      }

      itemsValidados.push({
        ...(tipo === 'producto' ? { id_producto: idProducto } : { id_servicio: idProducto }),
        cantidad,
        precio,
        descuento,
        total: totalItem,
        tipo,
        ...(tipo === 'producto' && raw.servicio_ref ? { servicio_ref: toInt(raw.servicio_ref) ?? undefined } : {}),
        ...(tipo === 'producto' ? { almacenId: almacenSeleccionado ?? almacenReservaId } : {}),
        ...(tipo === 'producto' ? { ubicacionId: ubicacionSeleccionada ?? null } : {}),
        ...(tiempoServicio ? { tiempo_servicio: tiempoServicio } : {})
      })
    }

    const cuentaProductosPorServicio = new Map<number, number>()
    for (const item of itemsValidados.filter((i) => i.tipo === 'producto' && i.servicio_ref)) {
      const srvId = item.servicio_ref!
      const count = cuentaProductosPorServicio.get(srvId) || 0
      if (count >= 1) throw new OrdenServiceError(400, `Cada servicio solo puede tener 0 o 1 producto asociado (servicio ${srvId})`)
      cuentaProductosPorServicio.set(srvId, count + 1)
    }

    const impuesto = subtotal * 0.18
    const total = subtotal + impuesto

    await prisma.$transaction(async (tx) => {
      const detallesExistentes = await tx.detalleTransaccion.findMany({ where: { id_transaccion: idTransaccion } })
      const idsExistentes = detallesExistentes.map((d) => d.id_detalle_transaccion)
      if (idsExistentes.length) {
        await tx.tarea.deleteMany({ where: { id_detalle_transaccion: { in: idsExistentes } } })
        const reservasPendientes = await tx.reservaInventario.findMany({
          where: {
            id_detalle_transaccion: { in: idsExistentes },
            estado: ReservaEstado.PENDIENTE,
          },
        })
        for (const reserva of reservasPendientes) {
          await liberarReservaEnTx(tx, {
            reservaId: reserva.id_reserva_inventario,
            usuarioId,
            motivo: 'Liberación por edición de orden',
            metadata: {
              origen: 'orden_trabajo',
              codigo_transaccion: updated.codigo_transaccion,
              motivo: 'liberacion_por_edicion',
            },
          })
        }
      }
      for (const d of detallesExistentes) {
        if (d.id_producto) {
          await tx.producto.update({
            where: { id_producto: d.id_producto },
            data: { stock: { increment: d.cantidad } }
          })
        }
      }
      await tx.detalleTransaccion.deleteMany({ where: { id_transaccion: idTransaccion } })

      const mapaDetalleServicio = new Map<number, number>()
      for (const item of itemsValidados.filter((i) => i.tipo === 'servicio')) {
        const detalle = await tx.detalleTransaccion.create({
          data: {
            id_transaccion: idTransaccion,
            id_servicio: item.id_servicio ?? null,
            cantidad: item.cantidad,
            precio: item.precio,
            descuento: item.descuento,
            total: item.total
          }
        })
        mapaDetalleServicio.set(item.id_servicio!, detalle.id_detalle_transaccion)
        const estimado = item.tiempo_servicio ? item.tiempo_servicio.maximoMinutos : 60
        await tx.tarea.create({
          data: {
            id_detalle_transaccion: detalle.id_detalle_transaccion,
            id_trabajador: updated.id_trabajador_principal ?? null,
            estado: 'pendiente',
            tiempo_estimado: estimado
          }
        })
      }

      for (const item of itemsValidados.filter((i) => i.tipo === 'producto')) {
        const detalleProducto = await tx.detalleTransaccion.create({
          data: {
            id_transaccion: idTransaccion,
            id_producto: item.id_producto ?? null,
            cantidad: item.cantidad,
            precio: item.precio,
            descuento: item.descuento,
            total: item.total,
            id_detalle_servicio_asociado: item.servicio_ref ? mapaDetalleServicio.get(item.servicio_ref) ?? null : null
          }
        })
        await tx.producto.update({
          where: { id_producto: item.id_producto! },
          data: { stock: { decrement: item.cantidad } }
        })
        await reservarStockEnTx(tx, {
          productoId: item.id_producto!,
          almacenId: item.almacenId ?? almacenReservaId,
          ubicacionId: item.ubicacionId ?? null,
          usuarioId,
          cantidad: item.cantidad,
          transaccionId: idTransaccion,
          detalleTransaccionId: detalleProducto.id_detalle_transaccion,
          motivo: `Reserva para orden ${updated.codigo_transaccion}`,
          metadata: {
            origen: 'orden_trabajo',
            codigo_transaccion: updated.codigo_transaccion,
            motivo: 'reserva_por_actualizacion',
            almacen_id: item.almacenId ?? almacenReservaId,
            ubicacion_id: item.ubicacionId ?? null,
          },
        })
      }

      await tx.transaccion.update({
        where: { id_transaccion: idTransaccion },
        data: {
          impuesto,
          total,
          duracion_min: totalMinutosMin || null,
          duracion_max: totalMinutosMax || null,
          unidad_tiempo: totalMinutosMin > 0 || totalMinutosMax > 0 ? 'minutos' : null
        }
      })
    })
  }

  if (nuevoEstado === 'por_hacer') {
    try {
      const detallesIds = await prisma.detalleTransaccion.findMany({
        where: { id_transaccion: idTransaccion },
        select: { id_detalle_transaccion: true }
      })
      const ids = detallesIds.map((d) => d.id_detalle_transaccion)
      if (ids.length) {
        await prisma.tarea.updateMany({
          where: { id_detalle_transaccion: { in: ids }, estado: 'pendiente' },
          data: { estado: 'por_hacer' }
        })
      }
    } catch (e) {
      console.warn('No se pudieron actualizar tareas a por_hacer', e)
    }
  }

  if (input.generar_tareas_faltantes === true || asignadoPrincipalAhora) {
    try {
      const detallesServicios = await prisma.detalleTransaccion.findMany({
        where: { id_transaccion: idTransaccion },
        include: { producto: true, servicio: true, tareas: true }
      })
      const trabajadorObjetivo = asignarTrabajador ?? updated.id_trabajador_principal ?? null
      for (const d of detallesServicios) {
        const esServicio = d.servicio != null || (d.producto && d.producto.tipo === 'servicio')
        if (esServicio && trabajadorObjetivo) {
          await prisma.tarea.updateMany({
            where: { id_detalle_transaccion: d.id_detalle_transaccion },
            data: { id_trabajador: trabajadorObjetivo }
          })
          const tareasSinPorHacer = d.tareas.filter((t) => t.estado === 'pendiente')
          if (tareasSinPorHacer.length > 0) {
            await prisma.tarea.updateMany({
              where: { id_detalle_transaccion: d.id_detalle_transaccion, estado: 'pendiente' },
              data: { estado: 'por_hacer' }
            })
          }
        }
        if (esServicio && d.tareas.length === 0 && trabajadorObjetivo) {
          const unidad = d.servicio?.unidad_tiempo || 'minutos'
          const minutosMaximos = d.servicio ? convertirATotalMinutos(d.servicio.tiempo_maximo, unidad) : 60
          const tiempoEstimado = minutosMaximos * d.cantidad
          try {
            await prisma.tarea.create({
              data: {
                id_detalle_transaccion: d.id_detalle_transaccion,
                id_trabajador: trabajadorObjetivo,
                estado: 'por_hacer',
                tiempo_estimado: tiempoEstimado
              }
            })
          } catch (e) {
            console.warn('Error creando tarea faltante', e)
          }
        }
      }
    } catch (e) {
      console.warn('No se pudieron generar tareas faltantes', e)
    }
  }

  if (nuevoEstado && (nuevoEstado === 'completado' || nuevoEstado === 'entregado')) {
    await prisma.$transaction(async (tx) => {
      const reservasPendientes = await tx.reservaInventario.findMany({
        where: {
          id_transaccion: updated.id_transaccion,
          estado: ReservaEstado.PENDIENTE,
        },
      })
      for (const reserva of reservasPendientes) {
        await confirmarReservaEnTx(tx, {
          reservaId: reserva.id_reserva_inventario,
          usuarioId,
          motivo: `Confirmación de reserva por orden ${updated.codigo_transaccion}`,
          metadata: {
            origen: 'orden_trabajo',
            codigo_transaccion: updated.codigo_transaccion,
            motivo: `confirmacion_por_${nuevoEstado}`,
          },
        })
      }
    })
  }

  let pagoRegistrado: unknown = null
  if (input.registrar_pago && input.registrar_pago.monto) {
    try {
  const monto = Number(input.registrar_pago.monto)
      if (Number.isFinite(monto) && monto > 0) {
        pagoRegistrado = await prisma.$transaction(async (tx) => {
          const pago = await tx.pago.create({
            data: {
              id_transaccion: updated.id_transaccion,
              tipo_pago: input.registrar_pago?.tipo_pago || 'efectivo',
              monto,
              numero_operacion: input.registrar_pago?.numero_operacion || null,
              registrado_por: usuarioId,
              observaciones: input.registrar_pago?.observaciones || null
            }
          })
          const suma = await tx.pago.aggregate({ _sum: { monto: true }, where: { id_transaccion: updated.id_transaccion } })
          const pagado = Number(suma._sum.monto || 0)
          let estado_pago: 'pendiente' | 'parcial' | 'pagado' = 'pendiente'
          if (pagado > 0 && pagado < Number(updated.total)) estado_pago = 'parcial'
          if (pagado >= Number(updated.total)) estado_pago = 'pagado'
          await tx.transaccion.update({ where: { id_transaccion: updated.id_transaccion }, data: { cantidad_pago: pagado, estado_pago } })
          return { pago, pagado, estado_pago }
        })
      }
    } catch (e) {
      console.warn('Error registrando pago rápido', e)
    }
  }

  const progreso = await calcularProgresoOrden(prisma, updated.id_transaccion)

  await prisma.bitacora.create({
    data: {
      id_usuario: usuarioId,
      accion: 'UPDATE_ORDEN',
      descripcion: `Actualización orden ${updated.codigo_transaccion}: ${JSON.stringify(Object.keys(dataUpdate))}`,
      tabla: 'transaccion'
    }
  })

  return {
    status: 200,
    body: { orden: updated, progreso, pago: pagoRegistrado }
  }
}
