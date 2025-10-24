import { TipoItemComprobante } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FacturacionError } from './errors'
import {
  DEFAULT_IGV_PERCENTAGE,
  calcularTotales,
  inferirTipoComprobante,
  toNumber
} from './utils'
import type { FacturacionPayload } from './types'

export async function prepararOrdenParaFacturacion(
  idTransaccion: number,
  tipoSolicitado?: 'BOLETA' | 'FACTURA'
): Promise<FacturacionPayload> {
  const orden = await prisma.transaccion.findUnique({
    where: { id_transaccion: idTransaccion },
    include: {
      persona: {
        include: {
          empresa_persona: true,
          cliente: true
        }
      },
      transaccion_vehiculos: {
        include: {
          vehiculo: {
            include: {
              modelo: {
                include: {
                  marca: true
                }
              },
              cliente: {
                include: {
                  persona: {
                    include: {
                      empresa_persona: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      detalles_transaccion: {
        include: {
          producto: {
            include: {
              unidad_medida: true
            }
          },
          servicio: true
        }
      },
      comprobantes: true
    }
  })

  if (!orden || orden.tipo_transaccion !== 'orden' || orden.estatus !== 'activo') {
    throw new FacturacionError('Orden no encontrada', 404)
  }

  if (orden.estado_orden !== 'completado') {
    throw new FacturacionError('Solo las órdenes completadas pueden enviarse a facturación.')
  }

  if (orden.estado_pago === 'pagado') {
    throw new FacturacionError('La orden ya se encuentra pagada.')
  }

  if (Array.isArray(orden.comprobantes) && orden.comprobantes.length > 0) {
    throw new FacturacionError('La orden ya tiene un comprobante registrado.', 409)
  }

  const persona = orden.persona
  if (!persona) {
    throw new FacturacionError('La orden no tiene un cliente válido asociado.', 422)
  }

  const cliente = persona.cliente
  if (!cliente) {
    throw new FacturacionError('No se encontró el registro de cliente asociado a la orden.', 422)
  }

  const empresa = persona.empresa_persona ?? null

  const config = await prisma.facturacionConfig.findFirst()
  const afectaIgv = config?.afecta_igv ?? true
  const preciosIncluyenIgv = config?.precios_incluyen_igv_default ?? true
  const igvPorcentaje = toNumber(config?.igv_porcentaje ?? DEFAULT_IGV_PERCENTAGE)

  const itemsBase = orden.detalles_transaccion.map((detalle) => ({
    tipo: detalle.servicio ? TipoItemComprobante.SERVICIO : TipoItemComprobante.PRODUCTO,
    descripcion:
      detalle.servicio?.nombre ??
      detalle.producto?.nombre ??
      `Item #${detalle.id_detalle_transaccion}`,
    cantidad: toNumber(detalle.cantidad),
    unidad_medida: detalle.producto?.unidad_medida?.abreviatura ?? detalle.servicio?.unidad_tiempo ?? null,
    precio_unitario: toNumber(detalle.precio),
    descuento: toNumber(detalle.descuento),
    id_producto: detalle.id_producto,
    id_servicio: detalle.id_servicio,
    metadata: detalle.servicio
      ? {
          tiempo_minimo: detalle.servicio.tiempo_minimo,
          tiempo_maximo: detalle.servicio.tiempo_maximo,
          unidad_tiempo: detalle.servicio.unidad_tiempo
        }
      : detalle.producto
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

  const tipoSugerido = inferirTipoComprobante({
    documento: empresa?.ruc ?? persona.numero_documento,
    tieneEmpresa: Boolean(empresa),
    tipoSolicitado: tipoSolicitado ?? null
  })

  const vehiculo = orden.transaccion_vehiculos[0]?.vehiculo

  return {
    origen_tipo: 'ORDEN',
    origen_id: orden.id_transaccion,
    origen_codigo: orden.codigo_transaccion,
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
    vehiculo: vehiculo
      ? {
          placa: vehiculo.placa,
          marca: vehiculo.modelo.marca.nombre_marca,
          modelo: vehiculo.modelo.nombre_modelo
        }
      : null,
    totales,
    items,
    notas: orden.observaciones,
    descripcion: null
  }
}
