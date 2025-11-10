import type { Prisma, PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const DEFAULT_PADDING = 3
const DEFAULT_SEPARATOR = '-'

export const CORRELATIVO_TIPOS = {
  COTIZACION: 'cotizacion',
  PRODUCTO: 'producto',
  SERVICIO: 'servicio',
} as const

export type CorrelativoTipo = (typeof CORRELATIVO_TIPOS)[keyof typeof CORRELATIVO_TIPOS] | (string & {})

type PrismaLikeClient = PrismaClient | Prisma.TransactionClient

interface IncrementarOptions {
  tipo: CorrelativoTipo
  anio: number
  prismaClient?: PrismaLikeClient
}

interface GenerarCodigoOptions {
  tipo: CorrelativoTipo
  prefijo: string
  padding?: number
  separador?: string
  fechaBase?: Date
  prismaClient?: PrismaLikeClient
}

function resolveClient(prismaClient?: PrismaLikeClient) {
  return prismaClient ?? prisma
}

export async function obtenerSiguienteCorrelativo({ tipo, anio, prismaClient }: IncrementarOptions) {
  const client = resolveClient(prismaClient)

  const registro = await client.correlativoCodigo.upsert({
    where: { tipo_anio: { tipo, anio } },
    update: { ultimo_valor: { increment: 1 } },
    create: { tipo, anio, ultimo_valor: 1 },
  })

  return registro.ultimo_valor
}

export async function generarCodigoCorrelativo({
  tipo,
  prefijo,
  padding = DEFAULT_PADDING,
  separador = DEFAULT_SEPARATOR,
  fechaBase,
  prismaClient,
}: GenerarCodigoOptions) {
  const base = fechaBase ?? new Date()
  const anio = base.getFullYear()
  const correlativo = await obtenerSiguienteCorrelativo({ tipo, anio, prismaClient })
  const correlativoStr = correlativo.toString().padStart(padding, '0')

  return {
    codigo: `${prefijo}${separador}${anio}${separador}${correlativoStr}`,
    correlativo,
    anio,
  }
}
