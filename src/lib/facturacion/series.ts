import { Prisma, TipoComprobante } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FacturacionError } from './errors'

const normalizeSerie = (value: string): string => value.trim().toUpperCase()

export type ListarSeriesFiltro = {
  tipo?: TipoComprobante
  activo?: boolean
}

export async function listarSeries({ tipo, activo }: ListarSeriesFiltro = {}) {
  return prisma.facturacionSerie.findMany({
    where: {
      ...(tipo ? { tipo } : {}),
      ...(typeof activo === 'boolean' ? { activo } : {})
    },
    orderBy: [{ tipo: 'asc' }, { serie: 'asc' }]
  })
}

export type CrearSerieInput = {
  tipo: TipoComprobante
  serie: string
  descripcion?: string | null
  correlativo_inicial?: number
  activo?: boolean
  establecer_como_default?: boolean
}

export async function crearSerie({
  tipo,
  serie,
  descripcion,
  correlativo_inicial,
  activo,
  establecer_como_default
}: CrearSerieInput) {
  const serieNormalizada = normalizeSerie(serie)
  const correlativo = correlativo_inicial ?? 0
  if (!Number.isInteger(correlativo) || correlativo < 0) {
    throw new FacturacionError('El correlativo inicial debe ser un entero positivo.', 422)
  }

  return prisma.$transaction(async (tx) => {
    const existente = await tx.facturacionSerie.findUnique({
      where: {
        tipo_serie: {
          tipo,
          serie: serieNormalizada
        }
      }
    })

    if (existente) {
      throw new FacturacionError(`La serie ${serieNormalizada} para ${tipo.toLowerCase()} ya existe.`, 409)
    }

    const nuevaSerie = await tx.facturacionSerie.create({
      data: {
        tipo,
        serie: serieNormalizada,
        correlativo_actual: correlativo,
        descripcion: descripcion?.trim() || null,
        activo: typeof activo === 'boolean' ? activo : true
      }
    })

    if (establecer_como_default) {
      await tx.facturacionConfig.upsert({
        where: { id_config: 1 },
        update:
          tipo === 'FACTURA'
            ? { serie_factura_default: serieNormalizada }
            : { serie_boleta_default: serieNormalizada },
        create: {
          id_config: 1,
          afecta_igv: true,
          igv_porcentaje: new Prisma.Decimal(0.18),
          serie_boleta_default: tipo === 'BOLETA' ? serieNormalizada : 'B001',
          serie_factura_default: tipo === 'FACTURA' ? serieNormalizada : 'F001',
          precios_incluyen_igv_default: true,
          moneda_default: 'PEN'
        }
      })
    }

    return nuevaSerie
  })
}
