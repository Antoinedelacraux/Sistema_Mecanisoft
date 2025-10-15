import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  asegurarPermiso,
  PermisoDenegadoError,
  SesionInvalidaError,
} from '@/lib/permisos/guards'

const paramsSchema = z.object({
  id_compra: z.coerce.number().int().positive(),
})

const compraDetalleInclude = {
  proveedor: {
    select: {
      id_proveedor: true,
      razon_social: true,
      contacto: true,
      numero_contacto: true,
    },
  },
  detalles: {
    include: {
      producto: {
        select: {
          id_producto: true,
          nombre: true,
          codigo_producto: true,
        },
      },
    },
  },
} as const

const serializeDetalle = (
  compra: Prisma.CompraGetPayload<{ include: typeof compraDetalleInclude }>,
) => ({
  id_compra: compra.id_compra,
  fecha: compra.fecha.toISOString(),
  total: compra.total.toString(),
  estado: compra.estado,
  id_proveedor: compra.id_proveedor,
  proveedor: compra.proveedor
    ? {
        id_proveedor: compra.proveedor.id_proveedor,
        razon_social: compra.proveedor.razon_social,
        contacto: compra.proveedor.contacto,
        numero_contacto: compra.proveedor.numero_contacto,
      }
    : null,
  lineas: compra.detalles.map((detalle) => ({
    id_compra_detalle: detalle.id_compra_detalle,
    id_producto: detalle.id_producto,
    producto: detalle.producto
      ? {
          id_producto: detalle.producto.id_producto,
          nombre: detalle.producto.nombre,
          codigo_producto: detalle.producto.codigo_producto,
        }
      : null,
    cantidad: detalle.cantidad.toString(),
    precio_unitario: detalle.precio_unitario.toString(),
    subtotal: detalle.subtotal.toString(),
  })),
})

export const GET = async (_request: NextRequest, context: { params: Promise<{ id_compra: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.ver', { prismaClient: prisma })

    const params = await context.params
    const { id_compra } = paramsSchema.parse(params)

    const compra = await prisma.compra.findUnique({
      where: { id_compra },
      include: compraDetalleInclude,
    })

    if (!compra) {
      return NextResponse.json({ error: 'La compra no existe' }, { status: 404 })
    }

    return NextResponse.json(serializeDetalle(compra))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 })
    }

    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[API] Error al obtener detalle de compra simplificada', error)
    return NextResponse.json({ error: 'Error interno al consultar la compra' }, { status: 500 })
  }
}
