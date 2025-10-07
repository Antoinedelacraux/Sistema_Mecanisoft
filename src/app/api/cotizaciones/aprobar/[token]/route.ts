import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
