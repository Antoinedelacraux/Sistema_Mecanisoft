import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(v: T | Promise<T>): v is Promise<T> {
  return typeof (v as any)?.then === 'function'
}
async function resolveParams(ctx: ParamsInput): Promise<{ id: string }> {
  const raw = (ctx as any).params
  return isPromise(raw) ? await raw : raw
}

export async function GET(request: NextRequest, ctx: ParamsInput) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'servicios.listar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para ver servicios' }, { status: 403 })
      }
      throw error
    }
    const { id } = await resolveParams(ctx)
    const idNum = parseInt(id)
    if (!Number.isFinite(idNum)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const servicio = await prisma.servicio.findUnique({
      where: { id_servicio: idNum },
      include: { marca: true, modelo: true }
    })
    if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    return NextResponse.json(servicio)
  } catch (e) {
    console.error('GET servicio error:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, ctx: ParamsInput) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'servicios.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar servicios' }, { status: 403 })
      }
      throw error
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: 'Identificador de usuario inválido' }, { status: 401 })
    }
    const { id } = await resolveParams(ctx)
    const idNum = parseInt(id)
    if (!Number.isFinite(idNum)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const exists = await prisma.servicio.findUnique({ where: { id_servicio: idNum } })
    if (!exists) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const data = await request.json()
    const {
      codigo_servicio,
      nombre,
      descripcion,
      es_general,
      id_marca,
      id_modelo,
      precio_base,
      descuento,
      oferta,
      tiempo_minimo,
      tiempo_maximo,
      unidad_tiempo,
      estatus
    } = data || {}

    if (codigo_servicio && codigo_servicio !== exists.codigo_servicio) {
      const dup = await prisma.servicio.findUnique({ where: { codigo_servicio } })
      if (dup) return NextResponse.json({ error: 'Código de servicio ya existe' }, { status: 400 })
    }

    const precioBaseNum = precio_base != null ? parseFloat(precio_base) : Number(exists.precio_base)
    if (!Number.isFinite(precioBaseNum) || precioBaseNum < 0) {
      return NextResponse.json({ error: 'precio_base inválido' }, { status: 400 })
    }

    const descuentoNum = descuento != null ? parseFloat(descuento) : Number(exists.descuento)
    if (descuentoNum < 0 || descuentoNum > 100) {
      return NextResponse.json({ error: 'descuento debe estar entre 0 y 100' }, { status: 400 })
    }

    const ofertaActiva = oferta != null ? Boolean(oferta) : exists.oferta
    if (!ofertaActiva && descuentoNum > 0) {
      return NextResponse.json({ error: 'El descuento solo se permite cuando el servicio está en oferta' }, { status: 400 })
    }

    const tiempoMinNum = tiempo_minimo != null ? (typeof tiempo_minimo === 'number' ? tiempo_minimo : parseInt(tiempo_minimo)) : exists.tiempo_minimo
    const tiempoMaxNum = tiempo_maximo != null ? (typeof tiempo_maximo === 'number' ? tiempo_maximo : parseInt(tiempo_maximo)) : exists.tiempo_maximo
    if (!Number.isFinite(tiempoMinNum) || tiempoMinNum <= 0) {
      return NextResponse.json({ error: 'tiempo_minimo debe ser mayor a 0' }, { status: 400 })
    }
    if (!Number.isFinite(tiempoMaxNum) || tiempoMaxNum < tiempoMinNum) {
      return NextResponse.json({ error: 'tiempo_maximo debe ser mayor o igual que tiempo_minimo' }, { status: 400 })
    }

    const unidadTiempo = unidad_tiempo != null ? String(unidad_tiempo).toLowerCase() : exists.unidad_tiempo
    if (!['minutos','horas','dias','semanas'].includes(unidadTiempo)) {
      return NextResponse.json({ error: 'unidad_tiempo inválida' }, { status: 400 })
    }

    const updated = await prisma.servicio.update({
      where: { id_servicio: idNum },
      data: {
        codigo_servicio: codigo_servicio ?? exists.codigo_servicio,
        nombre: nombre ?? exists.nombre,
        descripcion: descripcion ?? exists.descripcion,
        es_general: es_general ?? exists.es_general,
        id_marca: id_marca != null ? parseInt(id_marca) : exists.id_marca,
        id_modelo: id_modelo != null ? parseInt(id_modelo) : exists.id_modelo,
        precio_base: precioBaseNum,
        descuento: ofertaActiva ? descuentoNum : 0,
        oferta: ofertaActiva,
        tiempo_minimo: tiempoMinNum,
        tiempo_maximo: tiempoMaxNum,
        unidad_tiempo: unidadTiempo,
        estatus: estatus != null ? Boolean(estatus) : exists.estatus
      },
      include: { marca: true, modelo: true }
    })

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({ prismaClient: prisma, usuarioId, accion: 'UPDATE_SERVICIO', descripcion: `Servicio actualizado: ${updated.codigo_servicio} - ${updated.nombre}`, tabla: 'servicio' })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (UPDATE_SERVICIO):', err)
    }

    return NextResponse.json(updated)
  } catch (e) {
    console.error('PUT servicio error:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: ParamsInput) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'servicios.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar servicios' }, { status: 403 })
      }
      throw error
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: 'Identificador de usuario inválido' }, { status: 401 })
    }
    const { id } = await resolveParams(ctx)
    const idNum = parseInt(id)
    if (!Number.isFinite(idNum)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const { action, estatus } = await request.json()
    if (action !== 'toggle_status') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

    const servicio = await prisma.servicio.findUnique({ where: { id_servicio: idNum } })
    if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const updated = await prisma.servicio.update({
      where: { id_servicio: idNum },
      data: { estatus: Boolean(estatus) },
      include: { marca: true, modelo: true }
    })

    // Registrar en bitácora (mejor esfuerzo)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({ prismaClient: prisma, usuarioId, accion: 'TOGGLE_STATUS_SERVICIO', descripcion: `Servicio ${estatus ? 'activado' : 'desactivado'}: ${servicio.nombre}`, tabla: 'servicio' })
    } catch (err) {
      console.error('No fue posible registrar en bitácora (TOGGLE_STATUS_SERVICIO):', err)
    }

    return NextResponse.json(updated)
  } catch (e) {
    console.error('PATCH servicio error:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}