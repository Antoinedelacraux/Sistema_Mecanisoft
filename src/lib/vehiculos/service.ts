import type { Prisma, PrismaClient } from '@prisma/client'

import logEvent from '@/lib/bitacora/log-event'

import { VehiculoServiceError } from './errors'

export interface ListarVehiculosParams {
  page?: number
  limit?: number
  search?: string | null
  clienteId?: number
}

export interface ListarVehiculosDeps {
  prismaClient: PrismaClient
}

function sanitizePositiveInteger(value: unknown, options?: { fallback?: number; max?: number }) {
  const fallback = options?.fallback ?? 1
  const max = options?.max

  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  const positive = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback

  if (max && positive > max) {
    return max
  }

  return positive
}

export async function listarVehiculos(params: ListarVehiculosParams, deps: ListarVehiculosDeps) {
  const { prismaClient } = deps
  const page = sanitizePositiveInteger(params.page, { fallback: 1 })
  const limit = sanitizePositiveInteger(params.limit, { fallback: 10, max: 100 })
  const skip = (page - 1) * limit
  const search = typeof params.search === 'string' ? params.search.trim() : ''
  const clienteId = typeof params.clienteId === 'number' && Number.isFinite(params.clienteId) ? params.clienteId : undefined

  let whereCondition: Prisma.VehiculoWhereInput = {
    estado: true,
    cliente: {
      estatus: true,
    },
  }

  if (clienteId) {
    whereCondition = { ...whereCondition, id_cliente: clienteId }
  }

  if (search) {
    const insensitive = 'insensitive' as const
    whereCondition = {
      ...whereCondition,
      OR: [
        { placa: { contains: search, mode: insensitive } },
        {
          cliente: {
            persona: {
              OR: [
                { nombre: { contains: search, mode: insensitive } },
                { apellido_paterno: { contains: search, mode: insensitive } },
                { numero_documento: { contains: search, mode: insensitive } },
              ],
            },
          },
        },
        { modelo: { nombre_modelo: { contains: search, mode: insensitive } } },
        { modelo: { marca: { nombre_marca: { contains: search, mode: insensitive } } } },
      ],
    }
  }

  const [vehiculos, total] = await Promise.all([
    prismaClient.vehiculo.findMany({
      where: whereCondition,
      include: {
        cliente: { include: { persona: true } },
        modelo: { include: { marca: true } },
      },
      orderBy: { placa: 'asc' },
      skip,
      take: limit,
    }),
    prismaClient.vehiculo.count({ where: whereCondition }),
  ])

  return {
    vehiculos,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      current: page,
      limit,
    },
  }
}

export interface CrearVehiculoDeps {
  prismaClient: PrismaClient
  usuarioId: number
}

export type CrearVehiculoInput = Record<string, unknown>

export async function crearVehiculo(data: CrearVehiculoInput, deps: CrearVehiculoDeps) {
  const { prismaClient, usuarioId } = deps

  const payload = data as Record<string, unknown>

  const idClienteRaw = payload?.['id_cliente']
  const idModeloRaw = payload?.['id_modelo']
  const placaRaw = typeof payload?.['placa'] === 'string' ? (payload['placa'] as string).trim() : ''
  const tipo = typeof payload?.['tipo'] === 'string' ? (payload['tipo'] as string).trim() : ''
  const anioRaw = payload?.['año']
  const tipoCombustible = typeof payload?.['tipo_combustible'] === 'string' ? (payload['tipo_combustible'] as string).trim() : ''
  const transmision = typeof payload?.['transmision'] === 'string' ? (payload['transmision'] as string).trim() : ''
  const numeroChasisRaw = typeof payload?.['numero_chasis'] === 'string' ? (payload['numero_chasis'] as string).trim() : payload?.['numero_chasis']
  const numeroMotorRaw = typeof payload?.['numero_motor'] === 'string' ? (payload['numero_motor'] as string).trim() : payload?.['numero_motor']
  const observacionesRaw = typeof payload?.['observaciones'] === 'string' ? (payload['observaciones'] as string).trim() : payload?.['observaciones']

  if (!idClienteRaw || !idModeloRaw || !placaRaw || !tipo || anioRaw === undefined || anioRaw === null || !tipoCombustible || !transmision) {
    throw new VehiculoServiceError(400, 'Faltan campos requeridos')
  }

  const idCliente = Number.parseInt(String(idClienteRaw), 10)
  const idModelo = Number.parseInt(String(idModeloRaw), 10)
  const anio = Number.parseInt(String(anioRaw), 10)

  if (!Number.isFinite(idCliente) || !Number.isFinite(idModelo) || !Number.isFinite(anio)) {
    throw new VehiculoServiceError(400, 'Faltan campos requeridos')
  }

  const cliente = await prismaClient.cliente.findUnique({
    where: { id_cliente: idCliente },
    include: { persona: true },
  })

  if (!cliente || !cliente.estatus) {
    throw new VehiculoServiceError(400, 'El cliente no existe o está inactivo')
  }

  const placaNormalizada = placaRaw.toUpperCase()

  const existePlaca = await prismaClient.vehiculo.findUnique({
    where: { placa: placaNormalizada },
  })

  if (existePlaca) {
    throw new VehiculoServiceError(400, 'Ya existe un vehículo con esta placa')
  }

  const modelo = await prismaClient.modelo.findUnique({
    where: { id_modelo: idModelo },
    include: { marca: true },
  })

  if (!modelo) {
    throw new VehiculoServiceError(400, 'El modelo especificado no existe')
  }

  const numeroChasis = typeof numeroChasisRaw === 'string' && numeroChasisRaw.length > 0 ? numeroChasisRaw : null
  const numeroMotor = typeof numeroMotorRaw === 'string' && numeroMotorRaw.length > 0 ? numeroMotorRaw : null
  const observaciones = typeof observacionesRaw === 'string' && observacionesRaw.length > 0 ? observacionesRaw : null

  const vehiculoCreado = await prismaClient.vehiculo.create({
    data: {
      id_cliente: idCliente,
      id_modelo: idModelo,
      placa: placaNormalizada,
      tipo,
      ['año']: anio,
      tipo_combustible: tipoCombustible,
      transmision,
      numero_chasis: numeroChasis,
      numero_motor: numeroMotor,
      observaciones,
    },
    include: {
      cliente: { include: { persona: true } },
      modelo: { include: { marca: true } },
    },
  })

  void logEvent({
    prismaClient,
    usuarioId,
    accion: 'CREATE_VEHICULO',
    descripcion: `Vehículo creado: ${modelo.marca.nombre_marca} ${modelo.nombre_modelo} - ${placaNormalizada}`,
    tabla: 'vehiculo',
  })

  return vehiculoCreado
}