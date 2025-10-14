import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { obtenerInventario } from '@/lib/inventario/services'

const cotizacionInclude = {
  cliente: { include: { persona: true } },
  vehiculo: { include: { modelo: { include: { marca: true } } } },
  detalle_cotizacion: { include: { producto: true, servicio: true } }
} as const

// Aprobación digital usando token (no requiere sesión para permitir enlace público controlado)
// Acciones: GET (ver estado), POST (aprobar), DELETE (rechazar)

async function getCotizacionByToken(token: string) {
  return prisma.cotizacion.findFirst({
    where: { approval_token: token },
    include: cotizacionInclude
  })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const cotizacion = await getCotizacionByToken(token)
    if (!cotizacion) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }

    const ahora = new Date()
    const vigenciaDate = cotizacion.vigencia_hasta ? new Date(cotizacion.vigencia_hasta) : null
    const vencida = vigenciaDate ? ahora > vigenciaDate : false
    return NextResponse.json({
      id: cotizacion.id_cotizacion,
      codigo: cotizacion.codigo_cotizacion,
      estado: cotizacion.estado,
      vencida,
      total: cotizacion.total,
      cliente: cotizacion.cliente,
      vehiculo: cotizacion.vehiculo,
      detalle: cotizacion.detalle_cotizacion
    })
  } catch (e) {
    console.error('Error consultando token cotización', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const { comentarios } = await request.json().catch(() => ({ comentarios: undefined }))
    const cotizacion = await getCotizacionByToken(token)
    if (!cotizacion) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }
    if (cotizacion.estado !== 'enviada') {
      return NextResponse.json({ error: 'Estado actual no permite aprobación' }, { status: 400 })
    }

    const ahora = new Date()
    const vigenciaDate = cotizacion.vigencia_hasta ? new Date(cotizacion.vigencia_hasta) : null
    if (vigenciaDate && ahora > vigenciaDate) {
      await prisma.cotizacion.update({ where: { id_cotizacion: cotizacion.id_cotizacion }, data: { estado: 'vencida' } })
      return NextResponse.json({ error: 'Cotización vencida' }, { status: 400 })
    }

    const actualizada = await prisma.cotizacion.update({
      where: { id_cotizacion: cotizacion.id_cotizacion },
      data: {
        estado: 'aprobada',
        fecha_aprobacion: ahora,
        aprobado_por: 'cliente_digital',
        comentarios_cliente: comentarios
      },
      include: cotizacionInclude
    })

    await prisma.bitacora.create({
      data: {
        id_usuario: 1, // Sistema / placeholder; ideal: usuario sistema
        accion: 'APPROVE_COTIZACION_TOKEN',
        descripcion: `Cotización aprobada digitalmente: ${cotizacion.codigo_cotizacion}`,
        tabla: 'cotizacion'
      }
    })

    // Verificar si es cotización solo productos y decrementar stock
    const tieneServicios = actualizada.detalle_cotizacion.some(d => d.id_servicio)
    const tieneProductos = actualizada.detalle_cotizacion.some(d => d.id_producto)

    if (!tieneServicios && tieneProductos) {
      // Es solo productos, decrementar stock
      const almacenPrincipal = await prisma.almacen.findFirst({
        where: { activo: true },
        orderBy: { id_almacen: 'asc' }
      })
      if (!almacenPrincipal) {
        console.error('No hay almacen principal definido')
      } else {
        await prisma.$transaction(async (tx) => {
          for (const detalle of actualizada.detalle_cotizacion) {
            if (detalle.producto && detalle.producto.tipo === 'producto') {
              // Obtener inventario
              const inventario = await obtenerInventario(tx, detalle.id_producto!, almacenPrincipal.id_almacen, null)
              // Decrementar stock disponible
              await tx.inventarioProducto.update({
                where: { id_inventario_producto: inventario.id_inventario_producto },
                data: { stock_disponible: { decrement: detalle.cantidad } }
              })
              // Decrementar stock total
              await tx.producto.update({
                where: { id_producto: detalle.id_producto! },
                data: { stock: { decrement: detalle.cantidad } }
              })
              // Registrar movimiento de inventario
              await tx.movimientoInventario.create({
                data: {
                  id_inventario_producto: inventario.id_inventario_producto,
                  tipo: 'SALIDA',
                  id_producto: detalle.id_producto!,
                  cantidad: detalle.cantidad,
                  costo_unitario: 0, // Placeholder
                  origen_tipo: 'OTRO',
                  referencia_origen: actualizada.codigo_cotizacion,
                  observaciones: `Aprobación de cotización solo productos: ${actualizada.codigo_cotizacion}`,
                  id_usuario: 1,
                  fecha: new Date()
                }
              })
            }
          }
        })
      }
    }

    return NextResponse.json(actualizada)
  } catch (e) {
    console.error('Error aprobando por token', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const cotizacion = await getCotizacionByToken(token)
    if (!cotizacion) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
    }
    if (cotizacion.estado !== 'enviada') {
      return NextResponse.json({ error: 'Estado actual no permite rechazo' }, { status: 400 })
    }

    const ahora = new Date()
    const vigenciaDate = cotizacion.vigencia_hasta ? new Date(cotizacion.vigencia_hasta) : null
    if (vigenciaDate && ahora > vigenciaDate) {
      await prisma.cotizacion.update({ where: { id_cotizacion: cotizacion.id_cotizacion }, data: { estado: 'vencida' } })
      return NextResponse.json({ error: 'Cotización vencida' }, { status: 400 })
    }

    const actualizada = await prisma.cotizacion.update({
      where: { id_cotizacion: cotizacion.id_cotizacion },
      data: {
        estado: 'rechazada',
        fecha_aprobacion: ahora,
        aprobado_por: 'cliente_digital'
      }
    })

    await prisma.bitacora.create({
      data: {
        id_usuario: 1,
        accion: 'REJECT_COTIZACION_TOKEN',
        descripcion: `Cotización rechazada digitalmente: ${cotizacion.codigo_cotizacion}`,
        tabla: 'cotizacion'
      }
    })

    return NextResponse.json(actualizada)
  } catch (e) {
    console.error('Error rechazando por token', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
