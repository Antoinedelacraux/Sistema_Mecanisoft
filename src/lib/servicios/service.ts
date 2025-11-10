import type { Prisma, PrismaClient } from '@prisma/client'

import logEvent from '@/lib/bitacora/log-event'
import { generarCodigoCorrelativo, CORRELATIVO_TIPOS } from '@/lib/correlativos/service'

import { ServicioServiceError } from './errors'

export interface ListarServiciosParams {
  page?: number
  limit?: number
  search?: string | null
  marcaId?: number
  modeloId?: number
  estado?: 'activos' | 'inactivos' | 'todos' | null
}

export interface ListarServiciosDeps {
  prismaClient: PrismaClient
}

function sanitizePositive(value: unknown, fallback: number, options?: { max?: number }) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  const sanitized = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback

  if (options?.max && sanitized > options.max) {
    return options.max
  }

  return sanitized
}

export async function listarServicios(params: ListarServiciosParams, deps: ListarServiciosDeps) {
  const { prismaClient } = deps
  const page = sanitizePositive(params.page, 1)
  const limit = sanitizePositive(params.limit, 10, { max: 100 })
  const skip = (page - 1) * limit
  const search = typeof params.search === 'string' ? params.search.trim() : ''
  const marcaId = typeof params.marcaId === 'number' && Number.isFinite(params.marcaId) ? params.marcaId : undefined
  const modeloId = typeof params.modeloId === 'number' && Number.isFinite(params.modeloId) ? params.modeloId : undefined
  const estado = params.estado ?? null

  let where: Prisma.ServicioWhereInput = {}

  if (estado === 'activos') {
    where.estatus = true
  } else if (estado === 'inactivos') {
    where.estatus = false
  }

  if (marcaId) {
    where = { ...where, id_marca: marcaId }
  }

  if (modeloId) {
    where = { ...where, id_modelo: modeloId }
  }

  if (search) {
    const insensitive = 'insensitive' as const
    where = {
      ...where,
      OR: [
        { nombre: { contains: search, mode: insensitive } },
        { codigo_servicio: { contains: search, mode: insensitive } },
        { descripcion: { contains: search, mode: insensitive } },
        { marca: { nombre_marca: { contains: search, mode: insensitive } } },
        { modelo: { nombre_modelo: { contains: search, mode: insensitive } } },
      ],
    }
  }

  const [servicios, total] = await Promise.all([
    prismaClient.servicio.findMany({
      where,
      include: { marca: true, modelo: true },
      orderBy: [{ estatus: 'desc' }, { nombre: 'asc' }],
      skip,
      take: limit,
    }),
    prismaClient.servicio.count({ where }),
  ])

  return {
    servicios,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      current: page,
      limit,
    },
  }
}

export interface CrearServicioDeps {
  prismaClient: PrismaClient
  usuarioId: number
}

export type CrearServicioInput = Record<string, unknown>

export async function crearServicio(data: CrearServicioInput, deps: CrearServicioDeps) {
  const { prismaClient, usuarioId } = deps
  const payload = data as Record<string, unknown>

  const codigoServicioRaw = typeof payload['codigo_servicio'] === 'string' ? payload['codigo_servicio'].trim() : undefined
  const nombre = typeof payload['nombre'] === 'string' ? payload['nombre'].trim() : ''
  const descripcionRaw = payload['descripcion']
  const esGeneral = Boolean(payload['es_general'])
  const marcaRaw = payload['id_marca']
  const modeloRaw = payload['id_modelo']
  const precioBaseRaw = payload['precio_base']
  const descuentoRaw = payload['descuento']
  const ofertaRaw = payload['oferta']
  const tiempoMinRaw = payload['tiempo_minimo']
  const tiempoMaxRaw = payload['tiempo_maximo']
  const unidadTiempoRaw = payload['unidad_tiempo']

  if (!nombre || precioBaseRaw === undefined || precioBaseRaw === null) {
    throw new ServicioServiceError(400, 'Faltan campos requeridos')
  }

  const precioNum = Number.parseFloat(String(precioBaseRaw))
  if (!Number.isFinite(precioNum) || precioNum < 0) {
    throw new ServicioServiceError(400, 'precio_base inválido')
  }

  const descNum = descuentoRaw !== undefined && descuentoRaw !== null && `${descuentoRaw}` !== ''
    ? Number.parseFloat(String(descuentoRaw))
    : 0

  if (!Number.isFinite(descNum) || descNum < 0 || descNum > 100) {
    throw new ServicioServiceError(400, 'descuento debe estar entre 0 y 100')
  }

  const tiempoMinNum = typeof tiempoMinRaw === 'number'
    ? tiempoMinRaw
    : Number.parseInt(String(tiempoMinRaw ?? '0'), 10)
  if (!Number.isFinite(tiempoMinNum) || tiempoMinNum <= 0) {
    throw new ServicioServiceError(400, 'tiempo_minimo debe ser mayor a 0')
  }

  const tiempoMaxNum = typeof tiempoMaxRaw === 'number'
    ? tiempoMaxRaw
    : Number.parseInt(String(tiempoMaxRaw ?? '0'), 10)
  if (!Number.isFinite(tiempoMaxNum) || tiempoMaxNum < tiempoMinNum) {
    throw new ServicioServiceError(400, 'tiempo_maximo debe ser mayor o igual que tiempo_minimo')
  }

  const unidad = typeof unidadTiempoRaw === 'string' ? unidadTiempoRaw.toLowerCase() : 'minutos'
  if (!['minutos', 'horas', 'dias', 'semanas'].includes(unidad)) {
    throw new ServicioServiceError(400, 'unidad_tiempo inválida')
  }

  const marcaId = marcaRaw != null && `${marcaRaw}` !== '' ? Number.parseInt(String(marcaRaw), 10) : null
  if (marcaId && !await prismaClient.marca.findUnique({ where: { id_marca: marcaId } })) {
    throw new ServicioServiceError(400, 'Marca inválida')
  }

  const modeloId = modeloRaw != null && `${modeloRaw}` !== '' ? Number.parseInt(String(modeloRaw), 10) : null
  if (modeloId && !await prismaClient.modelo.findUnique({ where: { id_modelo: modeloId } })) {
    throw new ServicioServiceError(400, 'Modelo inválido')
  }

  let codigoServicio = codigoServicioRaw && codigoServicioRaw.length > 0 ? codigoServicioRaw : undefined

  if (codigoServicio) {
    const existe = await prismaClient.servicio.findUnique({ where: { codigo_servicio: codigoServicio } })
    if (existe) {
      throw new ServicioServiceError(400, 'Ya existe un servicio con este código')
    }
  }

  const ofertaActiva = Boolean(ofertaRaw)
  if (!ofertaActiva && descNum > 0) {
    throw new ServicioServiceError(400, 'El descuento solo se permite cuando el servicio está en oferta')
  }

  const descuentoAplicado = ofertaActiva ? descNum : 0
  const descripcion = typeof descripcionRaw === 'string' && descripcionRaw.trim().length > 0 ? descripcionRaw.trim() : null

  const creado = await prismaClient.$transaction(async (tx) => {
    const codigo = codigoServicio ?? (await generarCodigoCorrelativo({
      tipo: CORRELATIVO_TIPOS.SERVICIO,
      prefijo: 'SER',
      prismaClient: tx,
    })).codigo

    codigoServicio = codigo

    return tx.servicio.create({
      data: {
        codigo_servicio: codigo,
        nombre,
        descripcion,
        es_general: esGeneral,
        id_marca: marcaId,
        id_modelo: modeloId,
        precio_base: precioNum,
        descuento: descuentoAplicado,
        oferta: ofertaActiva,
        tiempo_minimo: tiempoMinNum,
        tiempo_maximo: tiempoMaxNum,
        unidad_tiempo: unidad,
        estatus: true,
      },
      include: { marca: true, modelo: true },
    })
  })

  void logEvent({
    prismaClient,
    usuarioId,
    accion: 'CREATE_SERVICIO',
    descripcion: `Servicio creado: ${codigoServicio} - ${creado.nombre}`,
    tabla: 'servicio',
  })

  return creado
}