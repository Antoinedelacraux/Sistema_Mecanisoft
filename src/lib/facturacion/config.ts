import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FacturacionError } from './errors'
import type { FacturacionConfigCompleta } from '@/types'

const CONFIG_ID = 1
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000

type FacturacionClient = PrismaClient | Prisma.TransactionClient

type CacheEntry = {
  value: FacturacionConfigCompleta
  expiresAt: number
}

let cache: CacheEntry | null = null

export type FacturacionConfigInput = {
  afecta_igv: boolean
  igv_porcentaje: number
  serie_boleta_default: string
  serie_factura_default: string
  precios_incluyen_igv_default: boolean
  moneda_default: string
}

const sanitizeSerie = (value: string): string => value.trim().toUpperCase()
const sanitizeMoneda = (value: string): string => value.trim().toUpperCase()

const ensureConfigDefaults = (): Omit<Prisma.FacturacionConfigCreateInput, 'id_config'> => ({
  afecta_igv: true,
  igv_porcentaje: new Prisma.Decimal(0.18),
  serie_boleta_default: 'B001',
  serie_factura_default: 'F001',
  precios_incluyen_igv_default: true,
  moneda_default: 'PEN'
})

const mapToDecimal = (value: number): Prisma.Decimal => {
  if (!Number.isFinite(value)) {
    throw new FacturacionError('El porcentaje de IGV es inválido.', 422)
  }
  return new Prisma.Decimal(value)
}

const toClient = (client?: FacturacionClient): FacturacionClient => client ?? prisma

const buildConfig = (
  record: Prisma.FacturacionConfig | null,
  series: Prisma.FacturacionSerie[]
): FacturacionConfigCompleta => ({
  id_config: CONFIG_ID,
  afecta_igv: record?.afecta_igv ?? true,
  igv_porcentaje: record?.igv_porcentaje ?? new Prisma.Decimal(0.18),
  serie_boleta_default: record?.serie_boleta_default ?? 'B001',
  serie_factura_default: record?.serie_factura_default ?? 'F001',
  precios_incluyen_igv_default: record?.precios_incluyen_igv_default ?? true,
  moneda_default: record?.moneda_default ?? 'PEN',
  created_at: record?.created_at ?? new Date(),
  updated_at: record?.updated_at ?? new Date(),
  series
})

const fetchConfig = async (client: FacturacionClient): Promise<FacturacionConfigCompleta> => {
  const [config, series] = await Promise.all([
    client.facturacionConfig.findUnique({ where: { id_config: CONFIG_ID } }),
    client.facturacionSerie.findMany({ orderBy: [{ tipo: 'asc' }, { serie: 'asc' }] })
  ])

  return buildConfig(config, series)
}

type GetConfigOptions = {
  prismaClient?: FacturacionClient
  force?: boolean
}

export async function getFacturacionConfigCompleta(options?: GetConfigOptions): Promise<FacturacionConfigCompleta> {
  const client = toClient(options?.prismaClient)
  const shouldUseCache = client === prisma && !options?.force

  if (shouldUseCache && cache && cache.expiresAt > Date.now()) {
    return cache.value
  }

  const result = await fetchConfig(client)

  if (client === prisma) {
    cache = {
      value: result,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS
    }
  }

  return result
}

export function clearFacturacionConfigCache() {
  cache = null
}

const FACTURACION_REQUIRED_ENVS = ['FACTURACION_API_URL', 'FACTURACION_API_TOKEN', 'FACTURACION_EMISOR_RUC'] as const

type FacturacionFlagState = {
  enabled: boolean
  explicit: boolean
}

function getFacturacionFlagState(): FacturacionFlagState {
  const raw = process.env.FACTURACION_HABILITADA
  if (!raw) {
    return {
      enabled: process.env.NODE_ENV !== 'production',
      explicit: false
    }
  }

  const normalized = raw.trim().toLowerCase()
  const enabled = normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'

  return {
    enabled,
    explicit: true
  }
}

export function isFacturacionHabilitada(): boolean {
  return getFacturacionFlagState().enabled
}

export function assertFacturacionDisponible(): void {
  const flagState = getFacturacionFlagState()

  if (!flagState.enabled) {
    throw new FacturacionError('La facturación electrónica está deshabilitada. Habilítala estableciendo FACTURACION_HABILITADA=true.', 409)
  }

  if (!flagState.explicit) {
    // Implicit dev-mode enablement: skip credential enforcement so la app puede operar sin
    // servicios externos durante desarrollo local.
    return
  }

  const missing = FACTURACION_REQUIRED_ENVS.filter((key) => {
    const value = process.env[key]
    return !value || value.trim().length === 0
  })

  if (missing.length > 0) {
    throw new FacturacionError(`El servicio de facturación no está configurado correctamente. Faltan variables: ${missing.join(', ')}.`, 500)
  }
}

export async function updateFacturacionConfig(
  input: FacturacionConfigInput
): Promise<FacturacionConfigCompleta> {
  const data = {
    afecta_igv: input.afecta_igv,
    igv_porcentaje: mapToDecimal(input.igv_porcentaje),
    serie_boleta_default: sanitizeSerie(input.serie_boleta_default),
    serie_factura_default: sanitizeSerie(input.serie_factura_default),
    precios_incluyen_igv_default: input.precios_incluyen_igv_default,
    moneda_default: sanitizeMoneda(input.moneda_default)
  }

  if (data.moneda_default.length !== 3) {
    throw new FacturacionError('El código de moneda debe tener 3 caracteres.', 422)
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const baseConfig = await tx.facturacionConfig.upsert({
      where: { id_config: CONFIG_ID },
      update: data,
      create: { id_config: CONFIG_ID, ...ensureConfigDefaults(), ...data }
    })

    await Promise.all([
      tx.facturacionSerie.upsert({
        where: {
          tipo_serie: {
            tipo: 'BOLETA',
            serie: data.serie_boleta_default
          }
        },
        update: {},
        create: {
          tipo: 'BOLETA',
          serie: data.serie_boleta_default,
          correlativo_actual: 0,
          descripcion: 'Serie creada automáticamente al actualizar configuración'
        }
      }),
      tx.facturacionSerie.upsert({
        where: {
          tipo_serie: {
            tipo: 'FACTURA',
            serie: data.serie_factura_default
          }
        },
        update: {},
        create: {
          tipo: 'FACTURA',
          serie: data.serie_factura_default,
          correlativo_actual: 0,
          descripcion: 'Serie creada automáticamente al actualizar configuración'
        }
      })
    ])

    const series = await tx.facturacionSerie.findMany({
      orderBy: [{ tipo: 'asc' }, { serie: 'asc' }]
    })

    return buildConfig(baseConfig, series)
  })

  cache = {
    value: resultado,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS
  }

  return resultado
}
