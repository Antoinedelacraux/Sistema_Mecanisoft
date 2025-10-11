import { Prisma, TipoComprobante, EstadoComprobante, OrigenComprobante } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { FacturacionError } from './errors'
import type { FacturacionPayload } from './types'
import { calcularTotales, inferirTipoComprobante, toNumber } from './utils'
import path from 'path'
import { promises as fs } from 'fs'
import {
  generarPdfComprobante,
  toFsRelativePath,
  padNumero,
  formatCurrency
} from './pdf'

const comprobanteInclude = {
  detalles: {
    include: {
      producto: true,
      servicio: true
    }
  },
  bitacoras: {
    include: {
      usuario: {
        include: {
          persona: true
        }
      }
    },
    orderBy: {
      created_at: 'desc' as const
    }
  },
  serie_rel: true,
  persona: {
    include: {
      empresa_persona: true
    }
  },
  empresa: true,
  cliente: {
    include: {
      persona: {
        include: {
          empresa_persona: true
        }
      }
    }
  },
  cotizacion: {
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
      usuario: {
        include: {
          persona: {
            include: {
              empresa_persona: true
            }
          }
        }
      },
      detalle_cotizacion: {
        include: {
          producto: true,
          servicio: {
            include: {
              marca: true,
              modelo: true
            }
          }
        }
      }
    }
  },
  transaccion: true,
  creado_por_usuario: {
    include: {
      persona: true
    }
  },
  actualizado_por_usuario: {
    include: {
      persona: true
    }
  }
} satisfies Prisma.ComprobanteInclude

type ComprobanteConRelaciones = Prisma.ComprobanteGetPayload<{
  include: typeof comprobanteInclude
}>

const FACTURACION_CONFIG_ID = 1

type SerieSelectorParams = {
  tx: Prisma.TransactionClient
  tipo: TipoComprobante
  serieSolicitada?: string
}

async function obtenerSerieDisponible({ tx, tipo, serieSolicitada }: SerieSelectorParams) {
  const config = await tx.facturacionConfig.findUnique({ where: { id_config: FACTURACION_CONFIG_ID } })

  const codigoSerie = serieSolicitada
    ? serieSolicitada.toUpperCase()
    : tipo === 'FACTURA'
    ? config?.serie_factura_default
    : config?.serie_boleta_default

  if (!codigoSerie) {
    throw new FacturacionError(
      `No hay una serie configurada para ${tipo === 'FACTURA' ? 'facturas' : 'boletas'}. Configura una serie por defecto o proporciona una serie explícita.`,
      422
    )
  }

  let serie = await tx.facturacionSerie.findUnique({
    where: {
      tipo_serie: {
        tipo,
        serie: codigoSerie
      }
    }
  })

  if (!serie) {
    serie = await tx.facturacionSerie.create({
      data: {
        tipo,
        serie: codigoSerie,
        correlativo_actual: 0,
        descripcion: `Serie generada automáticamente para ${tipo.toLowerCase()}`
      }
    })
  }

  if (!serie.activo) {
    throw new FacturacionError(`La serie ${serie.serie} está inactiva.`, 409)
  }

  return serie
}

type PayloadOpciones = {
  payload: FacturacionPayload
  usuarioId: number
  serie?: string
  overrideTipo?: TipoComprobante | null
  motivoOverride?: string | null
}

export async function crearBorradorDesdePayload({
  payload,
  usuarioId,
  serie,
  overrideTipo,
  motivoOverride
}: PayloadOpciones): Promise<ComprobanteConRelaciones> {
  const config = await prisma.facturacionConfig.findUnique({ where: { id_config: FACTURACION_CONFIG_ID } })

  const preciosIncluyenIgv = payload.totales.precios_incluyen_igv
  const afectaIgv = config?.afecta_igv ?? true
  const igvPorcentaje = toNumber(config?.igv_porcentaje)

  const { items, totales } = calcularTotales({
    items: payload.items.map((item) => {
      const resto = { ...item }
      delete (resto as { subtotal?: number }).subtotal
      delete (resto as { igv?: number }).igv
      delete (resto as { total?: number }).total
      return resto
    }),
    afectaIgv,
    preciosIncluyenIgv,
    igvPorcentaje
  })

  const personaId = payload.receptor.persona_id
  const persona = await prisma.persona.findUnique({
    where: { id_persona: personaId },
    include: { cliente: true, empresa_persona: true }
  })

  if (!persona?.cliente) {
    throw new FacturacionError('El receptor indicado no está registrado como cliente activo.', 422)
  }

  const cliente = persona.cliente
  const empresaSeleccionada = payload.empresa_asociada

  const tipoCalculado = inferirTipoComprobante({
    documento: empresaSeleccionada?.ruc ?? payload.receptor.documento,
    tieneEmpresa: Boolean(empresaSeleccionada)
  })

  const tipoFinal = overrideTipo ?? tipoCalculado

  const resultado = await prisma.$transaction(async (tx) => {
    const serieRegistro = await obtenerSerieDisponible({ tx, tipo: tipoFinal, serieSolicitada: serie })

    const siguienteNumero = serieRegistro.correlativo_actual + 1

  const comprobante = await tx.comprobante.create({
    data: {
      id_facturacion_serie: serieRegistro.id_facturacion_serie,
      tipo: tipoFinal,
      serie: serieRegistro.serie,
      numero: siguienteNumero,
      origen_tipo: payload.origen_tipo,
      origen_id: payload.origen_id,
      estado: EstadoComprobante.BORRADOR,
      estado_pago: 'pendiente',
      codigo: payload.origen_codigo ?? null,
      incluye_igv: preciosIncluyenIgv,
      moneda: config?.moneda_default ?? 'PEN',
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
      receptor_nombre: empresaSeleccionada?.razon_social ?? payload.receptor.nombre,
      receptor_documento: empresaSeleccionada?.ruc ?? payload.receptor.documento,
      receptor_direccion: empresaSeleccionada?.direccion_fiscal ?? payload.receptor.direccion ?? null,
      descripcion: payload.descripcion ?? null,
      notas: payload.notas ?? null,
      precios_incluyen_igv: preciosIncluyenIgv,
      creado_por: usuarioId,
      actualizado_por: usuarioId,
      id_persona: payload.receptor.persona_id,
      id_empresa_persona: empresaSeleccionada?.id_empresa_persona ?? null,
      id_cliente: cliente.id_cliente,
      id_cotizacion: payload.origen_tipo === 'COTIZACION' ? payload.origen_id : null,
      id_transaccion: payload.origen_tipo === 'ORDEN' ? payload.origen_id : null,
      override_tipo_comprobante: overrideTipo ?? null,
      motivo_override: motivoOverride ?? null,
      detalles: {
        create: items.map((item) => ({
          tipo_item: item.tipo,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad_medida: item.unidad_medida ?? null,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento,
          subtotal: item.subtotal,
          igv: item.igv,
          total: item.total,
          id_producto: item.id_producto ?? null,
          id_servicio: item.id_servicio ?? null,
          metadata: item.metadata ? (item.metadata as Prisma.JsonObject) : Prisma.JsonNull
        }))
      }
    },
    include: comprobanteInclude
  })

    await tx.facturacionSerie.update({
      where: { id_facturacion_serie: serieRegistro.id_facturacion_serie },
      data: { correlativo_actual: siguienteNumero }
    })

    await tx.comprobanteBitacora.create({
      data: {
        id_comprobante: comprobante.id_comprobante,
        id_usuario: usuarioId,
        accion: 'CREAR_BORRADOR',
        descripcion: 'Borrador de comprobante creado desde módulo de facturación',
        metadata: {
          origen: payload.origen_tipo,
          origen_id: payload.origen_id,
          serie: comprobante.serie,
          numero: comprobante.numero
        } as Prisma.JsonObject
      }
    })

    return comprobante
  })

  return resultado
}

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  return Number(value)
}

const serializeDetalle = (detalle: ComprobanteConRelaciones['detalles'][number]) => ({
  ...detalle,
  cantidad: decimalToNumber(detalle.cantidad) ?? 0,
  precio_unitario: decimalToNumber(detalle.precio_unitario) ?? 0,
  descuento: decimalToNumber(detalle.descuento) ?? 0,
  subtotal: decimalToNumber(detalle.subtotal) ?? 0,
  igv: decimalToNumber(detalle.igv) ?? 0,
  total: decimalToNumber(detalle.total) ?? 0,
})

const serializeBitacora = (evento: ComprobanteConRelaciones['bitacoras'][number]) => ({
  ...evento,
  usuario: evento.usuario
})

export const serializeComprobante = (comprobante: ComprobanteConRelaciones) => ({
  ...comprobante,
  subtotal: decimalToNumber(comprobante.subtotal) ?? 0,
  igv: decimalToNumber(comprobante.igv) ?? 0,
  total: decimalToNumber(comprobante.total) ?? 0,
  detalles: comprobante.detalles.map(serializeDetalle),
  bitacoras: comprobante.bitacoras.map(serializeBitacora)
})

type ListarComprobantesParams = {
  page: number
  limit: number
  search?: string | null
  estado?: EstadoComprobante | null
  tipo?: TipoComprobante | null
  serie?: string | null
  origen?: OrigenComprobante | null
}

export async function listarComprobantes({
  page,
  limit,
  search,
  estado,
  tipo,
  serie,
  origen
}: ListarComprobantesParams) {
  const where: Prisma.ComprobanteWhereInput = {}

  if (estado) {
    where.estado = estado
  }
  if (tipo) {
    where.tipo = tipo
  }
  if (serie) {
    where.serie = serie
  }
  if (origen) {
    where.origen_tipo = origen
  }
  if (search) {
    where.OR = [
      { receptor_nombre: { contains: search, mode: 'insensitive' } },
      { receptor_documento: { contains: search, mode: 'insensitive' } },
      {
        codigo: {
          contains: search,
          mode: 'insensitive'
        }
      },
      {
        serie: {
          contains: search,
          mode: 'insensitive'
        }
      }
    ]
  }

  const skip = (page - 1) * limit

  const [total, comprobantes] = await prisma.$transaction([
    prisma.comprobante.count({ where }),
    prisma.comprobante.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      skip,
      take: limit,
      include: comprobanteInclude
    })
  ])

  return {
    comprobantes: comprobantes.map(serializeComprobante),
    pagination: {
      total,
      pages: Math.ceil(total / limit) || 1,
      current: page,
      limit
    }
  }
}

export async function obtenerComprobantePorId(id: number) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id_comprobante: id },
    include: comprobanteInclude
  })

  if (!comprobante) {
    throw new FacturacionError('Comprobante no encontrado', 404)
  }

  return serializeComprobante(comprobante)
}

type EmitirComprobanteInput = {
  comprobanteId: number
  usuarioId: number
  descripcion?: string | null
  notas?: string | null
}

export async function emitirComprobante({ comprobanteId, usuarioId, descripcion, notas }: EmitirComprobanteInput) {
  const ahora = new Date()

  const comprobanteActual = await prisma.comprobante.findUnique({
    where: { id_comprobante: comprobanteId },
    include: comprobanteInclude
  })

  if (!comprobanteActual) {
    throw new FacturacionError('Comprobante no encontrado', 404)
  }

  if (comprobanteActual.estado !== EstadoComprobante.BORRADOR) {
    throw new FacturacionError('Solo se pueden emitir comprobantes en estado borrador.', 409)
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const comprobante = await tx.comprobante.update({
      where: { id_comprobante: comprobanteId },
      data: {
        estado: EstadoComprobante.EMITIDO,
        fecha_emision: ahora,
        descripcion: descripcion ?? comprobanteActual.descripcion,
        notas: notas ?? comprobanteActual.notas,
        actualizado_por: usuarioId
      },
      include: comprobanteInclude
    })

    if (comprobante.origen_tipo === OrigenComprobante.ORDEN && comprobante.id_transaccion) {
      await tx.transaccion.update({
        where: { id_transaccion: comprobante.id_transaccion },
        data: {
          tipo_comprobante: comprobante.tipo,
          serie_comprobante: comprobante.serie,
          numero_comprobante: String(comprobante.numero),
          estado_pago: 'pendiente'
        }
      })
    }

    await tx.comprobanteBitacora.create({
      data: {
        id_comprobante: comprobante.id_comprobante,
        id_usuario: usuarioId,
        accion: 'EMITIR',
        descripcion: 'Comprobante emitido satisfactoriamente',
        metadata: {
          fecha_emision: ahora.toISOString(),
          serie: comprobante.serie,
          numero: comprobante.numero
        } as Prisma.JsonObject
      }
    })

    return comprobante
  })

  try {
    const pdfUrl = await generarPdfComprobante(resultado)

    if (pdfUrl && pdfUrl !== resultado.pdf_url) {
      await prisma.comprobante.update({
        where: { id_comprobante: resultado.id_comprobante },
        data: { pdf_url: pdfUrl }
      })

      await prisma.comprobanteBitacora.create({
        data: {
          id_comprobante: resultado.id_comprobante,
          id_usuario: usuarioId,
          accion: 'GENERAR_PDF',
          descripcion: 'PDF generado automáticamente al emitir el comprobante',
          metadata: {
            pdf_url: pdfUrl
          } as Prisma.JsonObject
        }
      })
    }
  } catch (error) {
    console.error('No se pudo generar el PDF del comprobante emitido:', error)
  }

  return obtenerComprobantePorId(comprobanteId)
}

type EnviarComprobanteCorreoInput = {
  comprobanteId: number
  usuarioId: number
  destinatario?: string | null
  mensaje?: string | null
}

const buildEmailBody = (params: {
  mensaje: string
  tipo: string
  numero: string
  total: number
  pdfUrl?: string | null
}) => {
  const { mensaje, tipo, numero, total, pdfUrl } = params
  const totalOficial = formatCurrency(total)
  const link = pdfUrl && /^https?:/i.test(pdfUrl)
    ? `<p>Puedes descargar el documento <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer">en este enlace</a>.</p>`
    : ''

  const html = `
    <p>${mensaje}</p>
    <p><strong>${tipo}</strong>: ${numero}</p>
    <p><strong>Total</strong>: ${totalOficial}</p>
    ${link}
    <p>Saludos,<br/>Equipo del taller</p>
  `

  const textParts = [mensaje, `${tipo}: ${numero}`, `Total: ${totalOficial}`]
  if (link) textParts.push(`Descarga: ${pdfUrl}`)
  textParts.push('Saludos,', 'Equipo del taller')

  return { html, text: textParts.join('\n\n') }
}

async function buildPdfAttachment(pdfUrl?: string | null) {
  if (!pdfUrl) return null
  if (/^https?:/i.test(pdfUrl)) return null

  const relativePath = toFsRelativePath(pdfUrl)
  const absolutePath = path.resolve(process.cwd(), 'public', relativePath)

  try {
    const content = await fs.readFile(absolutePath)
    return {
      filename: path.basename(relativePath) || 'comprobante.pdf',
      content
    }
  } catch (error) {
    console.warn('No se pudo adjuntar el PDF del comprobante:', error)
    return null
  }
}

export async function enviarComprobantePorCorreo({
  comprobanteId,
  usuarioId,
  destinatario,
  mensaje
}: EnviarComprobanteCorreoInput) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id_comprobante: comprobanteId },
    include: comprobanteInclude
  })

  if (!comprobante) {
    throw new FacturacionError('Comprobante no encontrado', 404)
  }

  if (comprobante.estado !== EstadoComprobante.EMITIDO) {
    throw new FacturacionError('Solo se pueden enviar comprobantes emitidos.', 409)
  }

  const correoDestino = destinatario?.trim() || comprobante.persona.correo?.trim()

  if (!correoDestino) {
    throw new FacturacionError('El cliente no tiene un correo registrado. Actualiza los datos del cliente para continuar.', 422)
  }

  try {
    const ensuredPdfUrl = await generarPdfComprobante(comprobante)
    if (ensuredPdfUrl && ensuredPdfUrl !== comprobante.pdf_url) {
      comprobante.pdf_url = ensuredPdfUrl
      await prisma.comprobante.update({
        where: { id_comprobante: comprobante.id_comprobante },
        data: { pdf_url: ensuredPdfUrl }
      })
    }
  } catch (error) {
    console.error('No se pudo generar el PDF antes de enviar el comprobante por correo:', error)
  }

  const numeroFormateado = `${comprobante.serie}-${padNumero(comprobante.numero)}`
  const tipoLegible = comprobante.tipo === 'FACTURA' ? 'Factura' : 'Boleta'
  const mensajeBase = mensaje?.trim() || `Adjuntamos la ${tipoLegible.toLowerCase()} ${numeroFormateado} emitida por el taller.`

  const attachments = []
  const pdfAttachment = await buildPdfAttachment(comprobante.pdf_url)
  if (pdfAttachment) {
    attachments.push(pdfAttachment)
  }

  const { html, text } = buildEmailBody({
    mensaje: mensajeBase,
    tipo: tipoLegible,
    numero: numeroFormateado,
    total: Number(comprobante.total) || 0,
    pdfUrl: comprobante.pdf_url ?? undefined
  })

  await sendMail({
    to: correoDestino,
    subject: `${tipoLegible} ${numeroFormateado} - ${comprobante.receptor_nombre}`,
    html,
    text,
    attachments
  })

  await prisma.comprobanteBitacora.create({
    data: {
      id_comprobante: comprobante.id_comprobante,
      id_usuario: usuarioId,
      accion: 'ENVIAR_CORREO',
      descripcion: `Enviado a ${correoDestino}`,
      metadata: {
        destinatario: correoDestino,
        asunto: `${tipoLegible} ${numeroFormateado}`
      } as Prisma.JsonObject
    }
  })

  return obtenerComprobantePorId(comprobanteId)
}
