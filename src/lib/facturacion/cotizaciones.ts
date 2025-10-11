import { TipoComprobante, TipoItemComprobante } from '@prisma/client'
import { FacturacionError } from './errors'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_IGV_PERCENTAGE,
  calcularTotales,
  inferirTipoComprobante,
  toNumber
} from './utils'
import type { FacturacionPayload } from './types'

export async function prepararCotizacionParaFacturacion(idCotizacion: number): Promise<FacturacionPayload> {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id_cotizacion: idCotizacion },
    include: {
      cliente: {
        include: {
          persona: {
            include: {
              empresa_persona: true
            }
          }
        }
      },
      vehiculo: {
        include: {
          modelo: {
            include: {
              marca: true
            }
          }
        }
      },
      detalle_cotizacion: {
        include: {
          producto: {
            include: {
              unidad_medida: true
            }
          },
          servicio: true
        }
      }
    }
  })

  if (!cotizacion) {
    throw new FacturacionError('Cotización no encontrada', 404)
  }

  if (cotizacion.estado !== 'aprobada') {
    throw new FacturacionError('Solo las cotizaciones aprobadas pueden enviarse a facturación.')
  }

  const contieneServicios = cotizacion.detalle_cotizacion.some((detalle) => Boolean(detalle.id_servicio))
  if (contieneServicios) {
    throw new FacturacionError('Esta cotización contiene servicios. Debe convertirse en orden antes de facturar.')
  }

  const persona = cotizacion.cliente.persona
  if (!persona) {
    throw new FacturacionError('La cotización no tiene un cliente válido asociado.', 422)
  }

  const empresa = persona.empresa_persona ?? null

  const config = await prisma.facturacionConfig.findFirst()
  const afectaIgv = config?.afecta_igv ?? true
  const preciosIncluyenIgv = config?.precios_incluyen_igv_default ?? true
  const igvPorcentaje = toNumber(config?.igv_porcentaje ?? DEFAULT_IGV_PERCENTAGE)

  const itemsBase = cotizacion.detalle_cotizacion.map((detalle) => ({
    tipo: TipoItemComprobante.PRODUCTO,
    descripcion: detalle.producto?.nombre ?? `Producto #${detalle.id_producto ?? ''}`.trim(),
    cantidad: toNumber(detalle.cantidad),
    unidad_medida: detalle.producto?.unidad_medida?.abreviatura ?? null,
    precio_unitario: toNumber(detalle.precio_unitario),
    descuento: toNumber(detalle.descuento),
    id_producto: detalle.id_producto,
    id_servicio: null,
    metadata: detalle.producto
      ? {
          codigo_producto: detalle.producto.codigo_producto
        }
      : null
  }))

  const { items, totales } = calcularTotales({
    items: itemsBase,
    afectaIgv,
    preciosIncluyenIgv,
    igvPorcentaje
  })

  const tipoSugerido: TipoComprobante = inferirTipoComprobante({
    documento: empresa?.ruc ?? persona.numero_documento,
    tieneEmpresa: Boolean(empresa)
  })

  return {
    origen_tipo: 'COTIZACION',
    origen_id: cotizacion.id_cotizacion,
    origen_codigo: cotizacion.codigo_cotizacion,
    tipo_comprobante_sugerido: tipoSugerido,
    receptor: {
      persona_id: persona.id_persona,
      nombre: `${persona.nombre} ${persona.apellido_paterno ?? ''} ${persona.apellido_materno ?? ''}`.trim(),
      documento: persona.numero_documento,
      correo: persona.correo,
      telefono: persona.telefono
    },
    empresa_asociada: empresa
      ? {
          id_empresa_persona: empresa.id_empresa_persona,
          razon_social: empresa.razon_social,
          ruc: empresa.ruc,
          direccion_fiscal: empresa.direccion_fiscal,
          nombre_comercial: empresa.nombre_comercial
        }
      : null,
    vehiculo: cotizacion.vehiculo
      ? {
          placa: cotizacion.vehiculo.placa,
          marca: cotizacion.vehiculo.modelo.marca.nombre_marca,
          modelo: cotizacion.vehiculo.modelo.nombre_modelo
        }
      : null,
    totales,
    items,
    notas: cotizacion.comentarios_cliente,
    descripcion: null
  }
}
