import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

const querySchema = z.object({
  q: z
    .string()
    .trim()
    .transform((value) => value ?? '')
    .optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

const buildWhere = (term?: string): Prisma.ProductoWhereInput => {
  const trimmed = term?.trim()
  if (!trimmed) {
    return {
      estatus: true,
      tipo: 'producto',
    }
  }

  const mode: Prisma.QueryMode = 'insensitive'

  return {
    estatus: true,
    tipo: 'producto',
    OR: [
      { nombre: { contains: trimmed, mode } },
      { codigo_producto: { contains: trimmed, mode } },
      { descripcion: { contains: trimmed, mode } },
    ],
  }
}

const productoSelect = {
  id_producto: true,
  nombre: true,
  codigo_producto: true,
  unidad_medida: {
    select: {
      abreviatura: true,
    },
  },
  inventario_basico: {
    select: {
      stock_disponible: true,
      stock_comprometido: true,
      costo_promedio: true,
    },
  },
} as const

type ProductoBasicoResult = Prisma.ProductoGetPayload<{ select: typeof productoSelect }>

const serializeProducto = (producto: ProductoBasicoResult) => {
  const inventario = producto.inventario_basico

  return {
    id_producto: producto.id_producto,
    nombre: producto.nombre,
    codigo_producto: producto.codigo_producto,
    unidad: producto.unidad_medida?.abreviatura ?? 'und',
    stock_disponible: inventario ? inventario.stock_disponible.toString() : '0',
    stock_comprometido: inventario ? inventario.stock_comprometido.toString() : '0',
    costo_promedio: inventario ? inventario.costo_promedio.toString() : '0',
  }
}

export const GET = async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.ver', { prismaClient: prisma })

    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const params = querySchema.parse(rawParams)

    const productos = await prisma.producto.findMany({
      where: buildWhere(params.q),
      select: productoSelect,
      take: params.limit,
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json({ productos: productos.map(serializeProducto) })
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

    console.error('[API] Error al buscar productos básicos de inventario', error)
    return NextResponse.json({ error: 'Error interno al buscar productos' }, { status: 500 })
  }
}
