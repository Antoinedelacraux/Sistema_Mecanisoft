import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FacturacionError } from './errors'
import type { FacturacionConfigCompleta } from '@/types'

const CONFIG_ID = 1

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

export async function getFacturacionConfigCompleta(): Promise<FacturacionConfigCompleta> {
  const config = await prisma.facturacionConfig.findUnique({
    where: { id_config: CONFIG_ID }
  })

  const effectiveConfig: Omit<FacturacionConfigCompleta, 'series'> = {
    id_config: CONFIG_ID,
    afecta_igv: config?.afecta_igv ?? true,
    igv_porcentaje: config?.igv_porcentaje ?? new Prisma.Decimal(0.18),
    serie_boleta_default: config?.serie_boleta_default ?? 'B001',
    serie_factura_default: config?.serie_factura_default ?? 'F001',
    precios_incluyen_igv_default: config?.precios_incluyen_igv_default ?? true,
    moneda_default: config?.moneda_default ?? 'PEN',
    created_at: config?.created_at ?? new Date(),
    updated_at: config?.updated_at ?? new Date()
  }

  const series = await prisma.facturacionSerie.findMany({
    orderBy: [{ tipo: 'asc' }, { serie: 'asc' }]
  })

  return {
    ...effectiveConfig,
    series
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

  return prisma.$transaction(async (tx) => {
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

    return {
      ...baseConfig,
      ...data,
      series
    }
  })
}
