import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { MovimientoBasicoTipo, Prisma } from '@prisma/client'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { registrarSalida, registrarAjuste, isInventarioBasicoError } from '@/lib/inventario/basico'
import { prisma } from '@/lib/prisma'
import {
  asegurarPermiso,
  PermisoDenegadoError,
  SesionInvalidaError,
} from '@/lib/permisos/guards'

const numeroFlexible = z.union([z.coerce.number().positive(), z.string().trim().min(1)])

const bodyBaseSchema = z.object({
  id_producto: z.coerce.number().int().positive(),
})

const salidaSchema = bodyBaseSchema.extend({
  tipo: z.literal('SALIDA'),
  cantidad: numeroFlexible,
  referencia: z.string().trim().min(1).max(120).optional(),
})

const ajusteSchema = bodyBaseSchema.extend({
  tipo: z.literal('AJUSTE'),
  cantidad: numeroFlexible,
  motivo: z.string().trim().min(3).max(120),
  direccion: z.enum(['incremento', 'decremento']),
})

const bodySchema = z.discriminatedUnion('tipo', [salidaSchema, ajusteSchema])

const querySchema = z.object({
  id_producto: z.coerce.number().int().positive().optional(),
  tipo: z.nativeEnum(MovimientoBasicoTipo).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
})

const movimientoInclude = {
  producto: {
    select: {
      id_producto: true,
      nombre: true,
      codigo_producto: true,
    },
  },
} as const

const serializeDecimal = (value: Prisma.Decimal | null | undefined) => (value ? value.toString() : null)

const serializeMovimiento = (movimiento: Prisma.MovimientoGetPayload<{ include: typeof movimientoInclude }>) => ({
  id_movimiento: movimiento.id_movimiento,
  tipo: movimiento.tipo,
  id_producto: movimiento.id_producto,
  cantidad: movimiento.cantidad.toString(),
  costo_unitario: serializeDecimal(movimiento.costo_unitario),
  referencia: movimiento.referencia ?? null,
  id_usuario: movimiento.id_usuario,
  creado_en: movimiento.creado_en.toISOString(),
  producto: movimiento.producto
    ? {
        id_producto: movimiento.producto.id_producto,
        nombre: movimiento.producto.nombre,
        codigo_producto: movimiento.producto.codigo_producto,
      }
    : null,
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

    const where: Prisma.MovimientoWhereInput = {}
    if (params.id_producto) where.id_producto = params.id_producto
    if (params.tipo) where.tipo = params.tipo

    const movimientos = await prisma.movimiento.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      take: params.limit,
      include: movimientoInclude,
    })

    return NextResponse.json({ movimientos: movimientos.map(serializeMovimiento) })
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

    console.error('[API] Error al listar movimientos básicos', error)
    return NextResponse.json({ error: 'Error interno al listar movimientos' }, { status: 500 })
  }
}

export const POST = async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.movimientos', { prismaClient: prisma })

    const raw = await request.json()
    const parsed = bodySchema.parse(raw)

    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isInteger(usuarioId)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    if (parsed.tipo === 'SALIDA') {
      const resultado = await registrarSalida({
        id_producto: parsed.id_producto,
        id_usuario: usuarioId,
        cantidad: parsed.cantidad,
        referencia: parsed.referencia,
      })

      return NextResponse.json({ movimiento: resultado }, { status: 201 })
    }

    const resultado = await registrarAjuste({
      id_producto: parsed.id_producto,
      id_usuario: usuarioId,
      cantidad: parsed.cantidad,
      motivo: parsed.motivo,
      esIncremento: parsed.direccion === 'incremento',
    })

    return NextResponse.json({ movimiento: resultado }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 })
    }

    if (isInventarioBasicoError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[API] Error al registrar movimiento básico', error)
    return NextResponse.json({ error: 'Error interno al registrar el movimiento' }, { status: 500 })
  }
}
