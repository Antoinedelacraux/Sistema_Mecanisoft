import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Nota: Ajustamos la firma para que coincida con el validador de Next (params puede ser Promise)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params
    const id = parseInt(idParam)

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

  const { id_trabajador_principal, prioridad, fecha_fin_estimada, observaciones } = await request.json()

    // Obtener cotización completa
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id_cotizacion: id },
      include: {
        cliente: { include: { persona: true } },
        vehiculo: true,
        detalle_cotizacion: {
          include: { producto: true }
        }
      }
    })

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cotizacion.estado !== 'aprobada') {
      return NextResponse.json({ error: 'Solo se pueden convertir cotizaciones aprobadas' }, { status: 400 })
    }

    // Verificar stock disponible para productos físicos
    for (const detalle of cotizacion.detalle_cotizacion) {
      if (detalle.producto.tipo === 'producto') {
        if (detalle.producto.stock < detalle.cantidad) {
          return NextResponse.json({
            error: `Stock insuficiente para ${detalle.producto.nombre}. Disponible: ${detalle.producto.stock}, Requerido: ${detalle.cantidad}`
          }, { status: 400 })
        }
      }
    }

    // Generar código de orden
    const year = new Date().getFullYear()
    const lastOrder = await prisma.transaccion.findFirst({
      where: {
        tipo_transaccion: 'orden',
        codigo_transaccion: { startsWith: `ORD-${year}-` }
      },
      orderBy: { id_transaccion: 'desc' }
    })
    
    const nextNumber = lastOrder 
      ? parseInt(lastOrder.codigo_transaccion.split('-')[2]) + 1 
      : 1
    
    const codigoOrden = `ORD-${year}-${nextNumber.toString().padStart(3, '0')}`

    // Crear orden de trabajo
    const orden = await prisma.$transaction(async (tx) => {
      // Crear transacción principal
      const transaccion = await tx.transaccion.create({
        data: {
          id_persona: cotizacion.cliente.id_persona,
          id_usuario: parseInt(session.user.id),
          id_trabajador_principal: id_trabajador_principal ? parseInt(id_trabajador_principal) : null,
          tipo_transaccion: 'orden',
          tipo_comprobante: 'orden_trabajo',
          codigo_transaccion: codigoOrden,
          fecha: new Date(),
          descuento: cotizacion.descuento_global,
          impuesto: cotizacion.impuesto,
          porcentaje: 18,
          total: cotizacion.total,
          observaciones: observaciones || `Orden generada desde cotización ${cotizacion.codigo_cotizacion}`,
          estado_orden: id_trabajador_principal ? 'asignado' : 'pendiente',
          prioridad: prioridad || 'media',
          ...(fecha_fin_estimada && { fecha_fin_estimada: new Date(fecha_fin_estimada) })
        }
      })

      // Crear relación con vehículo
      await tx.transaccionVehiculo.create({
        data: {
          id_transaccion: transaccion.id_transaccion,
          id_vehiculo: cotizacion.id_vehiculo,
          id_usuario: parseInt(session.user.id),
          descripcion: `Orden generada desde cotización ${cotizacion.codigo_cotizacion}`
        }
      })

      // Crear detalles y tareas
      for (const detalleCot of cotizacion.detalle_cotizacion) {
        const detalle = await tx.detalleTransaccion.create({
          data: {
            id_transaccion: transaccion.id_transaccion,
            id_producto: detalleCot.id_producto,
            cantidad: detalleCot.cantidad,
            precio: detalleCot.precio_unitario,
            descuento: detalleCot.descuento,
            total: detalleCot.total
          }
        })

        // Crear tarea automáticamente para servicios
        if (detalleCot.producto.tipo === 'servicio') {
          await tx.tarea.create({
            data: {
              id_detalle_transaccion: detalle.id_detalle_transaccion,
              id_trabajador: id_trabajador_principal ? parseInt(id_trabajador_principal) : 1, // Fallback temporal
              estado: 'pendiente',
              tiempo_estimado: 60 // Default 1 hora
            }
          })
        }

        // Reducir stock para productos físicos
        if (detalleCot.producto.tipo === 'producto') {
          await tx.producto.update({
            where: { id_producto: detalleCot.id_producto },
            data: {
              stock: {
                decrement: detalleCot.cantidad
              }
            }
          })
        }
      }

      return transaccion
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CONVERT_COTIZACION_ORDEN',
        descripcion: `Cotización ${cotizacion.codigo_cotizacion} convertida a orden ${codigoOrden}`,
        tabla: 'cotizacion'
      }
    })

    return NextResponse.json({ 
      success: true,
      orden_codigo: codigoOrden,
      orden_id: orden.id_transaccion
    })

  } catch (error) {
    console.error('Error convirtiendo cotización:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}