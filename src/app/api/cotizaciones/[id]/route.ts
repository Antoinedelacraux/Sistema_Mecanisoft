import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { cotizacionBodySchema, CotizacionValidationError, validarCotizacionPayload } from '../validation'

// Reutilizable include (similar al usado en el listado) por consistencia
const cotizacionInclude = {
  cliente: { include: { persona: true } },
  vehiculo: { include: { modelo: { include: { marca: true } } } },
  usuario: { include: { persona: true } },
  detalle_cotizacion: { include: { producto: true, servicio: true } }
} as const

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { id: idRaw } = await context.params
    const id = parseInt(idRaw)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id_cotizacion: id },
      include: cotizacionInclude
    })

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    return NextResponse.json(cotizacion)

  } catch (error) {
    console.error('Error obteniendo cotización:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

// ===== Paquete B: Transiciones de estado & Validación =====
const transitionActionSchema = z.object({
  action: z.enum(['enviar', 'aprobar', 'rechazar']),
  comentarios: z.string().optional(),
  razon_rechazo: z.string().optional()
})

const updateActionSchema = z.object({
  action: z.literal('actualizar'),
  payload: cotizacionBodySchema
})

const patchSchema = z.union([transitionActionSchema, updateActionSchema])

const TRANSICIONES: Record<string,string[]> = {
  borrador: ['enviada'],
  enviada: ['aprobada','rechazada'],
  aprobada: [],
  rechazada: [],
  vencida: []
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { id: idRaw } = await context.params
    const id = parseInt(idRaw)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validación fallida', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id_cotizacion: id },
      include: { cliente: { include: { persona: true } }, vehiculo: true }
    })
    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    if ('payload' in data) {
      if (cotizacion.estado !== 'borrador') {
        return NextResponse.json({ error: 'Solo se pueden editar cotizaciones en estado borrador.' }, { status: 400 })
      }

      let validation
      try {
        validation = await validarCotizacionPayload(data.payload)
      } catch (error) {
        if (error instanceof CotizacionValidationError) {
          return NextResponse.json({ error: error.message }, { status: error.status })
        }
        throw error
      }

      const {
        cliente: clienteValidado,
        itemsValidados,
        subtotal,
        impuesto,
        total,
        vigenciaHasta
      } = validation

      await prisma.$transaction(async (tx) => {
        await tx.detalleCotizacion.deleteMany({ where: { id_cotizacion: id } })

        await tx.cotizacion.update({
          where: { id_cotizacion: id },
          data: {
            id_cliente: data.payload.id_cliente,
            id_vehiculo: data.payload.id_vehiculo,
            vigencia_hasta: vigenciaHasta,
            subtotal,
            descuento_global: 0,
            impuesto,
            total
          }
        })

        for (const it of itemsValidados) {
          const detalleData = {
            id_cotizacion: id,
            id_producto: it.id_producto ?? null,
            id_servicio: it.id_servicio ?? null,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            descuento: it.descuento,
            total: it.total,
            servicio_ref: it.servicio_ref ?? null
          } as any

          await tx.detalleCotizacion.create({ data: detalleData })
        }
      })

      const cotizacionActualizada = await prisma.cotizacion.findUnique({
        where: { id_cotizacion: id },
        include: cotizacionInclude
      })

      if (!cotizacionActualizada) {
        return NextResponse.json({ error: 'Cotización no encontrada tras actualización' }, { status: 404 })
      }

      const userIdNum = Number.parseInt(session.user.id)
      if (!Number.isFinite(userIdNum)) {
        console.warn('Session user id inválido al registrar bitácora PATCH cotizacion')
      } else {
        await prisma.bitacora.create({
          data: {
            id_usuario: userIdNum,
            accion: 'UPDATE_COTIZACION',
            descripcion: `Cotización actualizada: ${cotizacionActualizada.codigo_cotizacion} - Cliente: ${cotizacionActualizada.cliente.persona.nombre} ${cotizacionActualizada.cliente.persona.apellido_paterno}`,
            tabla: 'cotizacion'
          }
        })
      }

      return NextResponse.json(cotizacionActualizada)
    }

    const { action, comentarios, razon_rechazo } = data

    // Marcar vencida si pasó la vigencia
    const ahora = new Date()
    // Marcar vencida si la fecha de vigencia ha pasado (y la fecha es válida)
    const vigenciaDate = cotizacion.vigencia_hasta ? new Date(cotizacion.vigencia_hasta) : null
    if (
      cotizacion.estado !== 'aprobada' &&
      cotizacion.estado !== 'rechazada' &&
      cotizacion.estado !== 'vencida' &&
      vigenciaDate && !isNaN(vigenciaDate.valueOf()) &&
      ahora > vigenciaDate
    ) {
      await prisma.cotizacion.update({ where: { id_cotizacion: id }, data: { estado: 'vencida' } })
      cotizacion.estado = 'vencida'
    }

    if (cotizacion.estado === 'vencida') {
      return NextResponse.json({ error: 'La cotización está vencida' }, { status: 400 })
    }

    let nuevoEstado: string | null = null
    if (action === 'enviar') nuevoEstado = 'enviada'
    if (action === 'aprobar') nuevoEstado = 'aprobada'
    if (action === 'rechazar') nuevoEstado = 'rechazada'

    if (!nuevoEstado) {
      return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
    }

    const permitidos = TRANSICIONES[cotizacion.estado] || []
    if (!permitidos.includes(nuevoEstado)) {
      return NextResponse.json({ error: `Transición no permitida desde ${cotizacion.estado} a ${nuevoEstado}` }, { status: 400 })
    }

  const updateData: Record<string, unknown> = { estado: nuevoEstado }
    let descripcionBitacora = ''
    if (nuevoEstado === 'enviada') {
      descripcionBitacora = `Cotización enviada: ${cotizacion.codigo_cotizacion}`
    } else if (nuevoEstado === 'aprobada') {
      updateData.fecha_aprobacion = new Date()
      updateData.aprobado_por = 'cliente_presencial'
      updateData.comentarios_cliente = comentarios
      descripcionBitacora = `Cotización aprobada: ${cotizacion.codigo_cotizacion}`
    } else if (nuevoEstado === 'rechazada') {
      // Para un rechazo podría registrarse fecha_aprobacion como control (se deja) o separar campo en el futuro
      updateData.fecha_aprobacion = new Date()
      updateData.aprobado_por = 'cliente_presencial'
      updateData.razon_rechazo = razon_rechazo
      updateData.comentarios_cliente = comentarios
      descripcionBitacora = `Cotización rechazada: ${cotizacion.codigo_cotizacion}`
    }

    const cotizacionActualizada = await prisma.cotizacion.update({
      where: { id_cotizacion: id },
      data: updateData,
      include: cotizacionInclude
    })

    const userIdNum = Number.parseInt(session.user.id)
    if (!Number.isFinite(userIdNum)) {
      console.warn('Session user id inválido al registrar bitácora PATCH cotizacion')
    } else {
      await prisma.bitacora.create({
        data: {
          id_usuario: userIdNum,
          accion: 'UPDATE_COTIZACION',
          descripcion: descripcionBitacora,
          tabla: 'cotizacion'
        }
      })
    }

    return NextResponse.json(cotizacionActualizada)
  } catch (error) {
    console.error('Error actualizando cotización:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: idRaw } = await context.params
    const id = parseInt(idRaw)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id_cotizacion: id },
      include: {
        cliente: { include: { persona: true } }
      }
    })

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (!['borrador', 'rechazada', 'vencida'].includes(cotizacion.estado)) {
      return NextResponse.json({ error: 'Solo se pueden eliminar cotizaciones en estado borrador, rechazada o vencida' }, { status: 400 })
    }

    await prisma.cotizacion.delete({ where: { id_cotizacion: id } })

    const userIdNum = Number.parseInt(session.user.id)
    if (!Number.isFinite(userIdNum)) {
      console.warn('Session user id inválido al registrar bitácora DELETE cotizacion')
    } else {
      await prisma.bitacora.create({
        data: {
          id_usuario: userIdNum,
          accion: 'DELETE_COTIZACION',
          descripcion: `Cotización eliminada: ${cotizacion.codigo_cotizacion} - ${cotizacion.cliente.persona.nombre}`,
          tabla: 'cotizacion'
        }
      })
    }

    return NextResponse.json({ message: 'Cotización eliminada correctamente' })
  } catch (error) {
    console.error('Error eliminando cotización:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}