import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const marcaId = searchParams.get('id_marca')
    const modeloId = searchParams.get('id_modelo')
    const estado = searchParams.get('estado') // 'activos' | 'inactivos' | 'todos'

    const skip = (page - 1) * limit

    let where: Prisma.ServicioWhereInput = {}

    if (estado === 'activos') where.estatus = true
    else if (estado === 'inactivos') where.estatus = false
    // por defecto 'todos'

    if (marcaId && /^\d+$/.test(marcaId)) where.id_marca = parseInt(marcaId)
    if (modeloId && /^\d+$/.test(modeloId)) where.id_modelo = parseInt(modeloId)

    if (search) {
      where = {
        ...where,
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { codigo_servicio: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } },
          { marca: { nombre_marca: { contains: search, mode: 'insensitive' } } },
          { modelo: { nombre_modelo: { contains: search, mode: 'insensitive' } } }
        ]
      }
    }

    const [servicios, total] = await Promise.all([
      prisma.servicio.findMany({
        where,
        include: { marca: true, modelo: true },
        orderBy: [{ estatus: 'desc' }, { nombre: 'asc' }],
        skip,
        take: limit
      }),
      prisma.servicio.count({ where })
    ])

    return NextResponse.json({
      servicios,
      pagination: { total, pages: Math.ceil(total / limit), current: page, limit }
    })
  } catch (e) {
    console.error('Error obteniendo servicios:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
      unidad_tiempo // 'minutos', 'horas', 'dias', 'semanas'
    } = data || {}

    // Validaciones básicas
    if (!nombre || precio_base === undefined || precio_base === null) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    const precioNum = parseFloat(precio_base)
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      return NextResponse.json({ error: 'precio_base inválido' }, { status: 400 })
    }
    const descNum = descuento ? parseFloat(descuento) : 0
    if (descNum < 0 || descNum > 100) {
      return NextResponse.json({ error: 'descuento debe estar entre 0 y 100' }, { status: 400 })
    }

    // Validar tiempo flexible
    const tiempoMinNum = typeof tiempo_minimo === 'number' ? tiempo_minimo : parseInt(tiempo_minimo || '0', 10)
    const tiempoMaxNum = typeof tiempo_maximo === 'number' ? tiempo_maximo : parseInt(tiempo_maximo || '0', 10)
    if (!Number.isFinite(tiempoMinNum) || tiempoMinNum <= 0) {
      return NextResponse.json({ error: 'tiempo_minimo debe ser mayor a 0' }, { status: 400 })
    }
    if (!Number.isFinite(tiempoMaxNum) || tiempoMaxNum < tiempoMinNum) {
      return NextResponse.json({ error: 'tiempo_maximo debe ser mayor o igual que tiempo_minimo' }, { status: 400 })
    }
    const unidad = typeof unidad_tiempo === 'string' ? unidad_tiempo.toLowerCase() : 'minutos'
    if (!['minutos','horas','dias','semanas'].includes(unidad)) {
      return NextResponse.json({ error: 'unidad_tiempo inválida' }, { status: 400 })
    }

    // Alcance opcional
    const marcaId = id_marca != null ? parseInt(id_marca) : null
    const modeloId = id_modelo != null ? parseInt(id_modelo) : null

    if (marcaId && !await prisma.marca.findUnique({ where: { id_marca: marcaId } })) {
      return NextResponse.json({ error: 'Marca inválida' }, { status: 400 })
    }
    if (modeloId && !await prisma.modelo.findUnique({ where: { id_modelo: modeloId } })) {
      return NextResponse.json({ error: 'Modelo inválido' }, { status: 400 })
    }

    // Generar código si no fue enviado
    let finalCodigo = codigo_servicio as string | undefined
    if (!finalCodigo) {
      const year = new Date().getFullYear()
      const last = await prisma.servicio.findFirst({
        where: { codigo_servicio: { startsWith: `SER-${year}-` } },
        orderBy: { id_servicio: 'desc' },
        select: { codigo_servicio: true }
      })
      const nextNumber = last ? parseInt(last.codigo_servicio.split('-')[2]) + 1 : 1
      finalCodigo = `SER-${year}-${nextNumber.toString().padStart(3, '0')}`
    }

    const ofertaActiva = Boolean(oferta)
    if (!ofertaActiva && descNum > 0) {
      return NextResponse.json({ error: 'El descuento solo se permite cuando el servicio está en oferta' }, { status: 400 })
    }
    const descuentoAplicado = ofertaActiva ? descNum : 0

    const creado = await prisma.servicio.create({
      data: {
        codigo_servicio: finalCodigo,
        nombre,
        descripcion: descripcion || null,
        es_general: Boolean(es_general),
        id_marca: marcaId,
        id_modelo: modeloId,
        precio_base: precioNum,
        descuento: descuentoAplicado,
        oferta: ofertaActiva,
        tiempo_minimo: tiempoMinNum,
        tiempo_maximo: tiempoMaxNum,
        unidad_tiempo: unidad,
        estatus: true
      },
      include: { marca: true, modelo: true }
    })

    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_SERVICIO',
        descripcion: `Servicio creado: ${creado.codigo_servicio} - ${creado.nombre}`,
        tabla: 'servicio'
      }
    })

    return NextResponse.json(creado, { status: 201 })
  } catch (e) {
    console.error('Error creando servicio:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}