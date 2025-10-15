import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { registrarCompra, InventarioBasicoError } from '@/lib/inventario/basico'
import { prisma } from '@/lib/prisma'
import {
  asegurarPermiso,
  PermisoDenegadoError,
  SesionInvalidaError,
} from '@/lib/permisos/guards'

const lineaSchema = z.object({
  id_producto: z.coerce.number().int().positive(),
  cantidad: z.union([z.coerce.number().positive(), z.string().trim().min(1)]),
  precio_unitario: z.union([z.coerce.number().min(0), z.string().trim().min(1)]),
})

const bodySchema = z.object({
  id_proveedor: z.coerce.number().int().positive(),
  fecha: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true
      const parsed = new Date(value)
      return Number.isFinite(parsed.getTime())
    }, 'Fecha inválida')
    .optional(),
  lineas: z.array(lineaSchema).min(1, 'Debe registrar al menos una línea'),
})

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  id_proveedor: z.coerce.number().int().positive().optional(),
  fecha_desde: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true
      return Number.isFinite(new Date(value).getTime())
    }, 'Fecha inválida')
    .optional(),
  fecha_hasta: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true
      return Number.isFinite(new Date(value).getTime())
    }, 'Fecha inválida')
    .optional(),
})

const parseDate = (value?: string) => {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : undefined
}

const buildWhere = (filters: z.infer<typeof querySchema>): Prisma.CompraWhereInput => {
  const where: Prisma.CompraWhereInput = {}

  if (filters.id_proveedor) {
    where.id_proveedor = filters.id_proveedor
  }

  if (filters.fecha_desde || filters.fecha_hasta) {
    const rango: Prisma.DateTimeFilter = {}
    const fechaDesde = parseDate(filters.fecha_desde)
    const fechaHasta = parseDate(filters.fecha_hasta)

    if (fechaDesde) rango.gte = fechaDesde
    if (fechaHasta) rango.lte = fechaHasta

    where.fecha = rango
  }

  return where
}

const compraInclude = {
  proveedor: {
    select: {
      id_proveedor: true,
      razon_social: true,
    },
  },
} as const

const serializeCompra = (compra: Prisma.CompraGetPayload<{ include: typeof compraInclude }>) => ({
  id_compra: compra.id_compra,
  id_proveedor: compra.id_proveedor,
  proveedor: compra.proveedor?.razon_social ?? null,
  fecha: compra.fecha.toISOString(),
  total: compra.total.toString(),
  estado: compra.estado,
})

export const GET = async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.ver', { prismaClient: prisma })

    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const params = querySchema.parse(rawParams)

    const where = buildWhere(params)
    const skip = (params.page - 1) * params.limit

    const [compras, total] = await prisma.$transaction([
      prisma.compra.findMany({
        where,
        include: compraInclude,
        orderBy: { fecha: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.compra.count({ where }),
    ])

    const pages = Math.max(1, Math.ceil(total / params.limit))

    return NextResponse.json({
      compras: compras.map(serializeCompra),
      pagination: {
        total,
        pages,
        current: params.page,
        limit: params.limit,
      },
      filters: {
        id_proveedor: params.id_proveedor ?? null,
        fecha_desde: params.fecha_desde ?? null,
        fecha_hasta: params.fecha_hasta ?? null,
      },
    })
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

    console.error('[API] Error al listar compras simplificadas', error)
    return NextResponse.json({ error: 'Error interno al listar compras' }, { status: 500 })
  }
}

export const POST = async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.compras', { prismaClient: prisma })

    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isInteger(usuarioId)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const payload = {
      id_proveedor: parsed.data.id_proveedor,
      creado_por: usuarioId,
      fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : undefined,
      lineas: parsed.data.lineas.map((linea) => ({
        id_producto: linea.id_producto,
        cantidad: linea.cantidad,
        precio_unitario: linea.precio_unitario,
      })),
    }

    const resultado = await registrarCompra(payload)

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (error instanceof InventarioBasicoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[API] Error al registrar compra simplificada', error)
    return NextResponse.json({ error: 'Error interno al registrar la compra' }, { status: 500 })
  }
}
