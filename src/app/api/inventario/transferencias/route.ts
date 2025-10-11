import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Prisma, TransferenciaEstado } from '@prisma/client';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { crearTransferencia } from '@/lib/inventario/services';
import { InventarioError, TransferenciaConMovimientos } from '@/types/inventario';

const ESTADOS = ['PENDIENTE_RECEPCION', 'COMPLETADA', 'ANULADA'] as const;

const metadataSchema = z.record(z.string(), z.any()).optional();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(ESTADOS).optional(),
  productoId: z.coerce.number().int().positive().optional(),
  origenAlmacenId: z.coerce.number().int().positive().optional(),
  destinoAlmacenId: z.coerce.number().int().positive().optional(),
});

const crearTransferenciaSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  cantidad: z.union([z.number().positive(), z.string().min(1)]),
  origenAlmacenId: z.coerce.number().int().positive(),
  origenUbicacionId: z.coerce.number().int().positive().nullable().optional(),
  destinoAlmacenId: z.coerce.number().int().positive(),
  destinoUbicacionId: z.coerce.number().int().positive().nullable().optional(),
  referencia: z.string().max(100).optional(),
  observaciones: z.string().max(500).optional(),
  metadata: metadataSchema,
});

type QueryShape = z.infer<typeof querySchema>;

type SerializedTransferencia = ReturnType<typeof serializeTransferencia>;

const movimientoInclude = {
  inventario: {
    include: {
      almacen: {
        select: {
          id_almacen: true,
          nombre: true,
        },
      },
      ubicacion: {
        select: {
          id_almacen_ubicacion: true,
          codigo: true,
          descripcion: true,
        },
      },
    },
  },
  producto: {
    select: {
      id_producto: true,
      codigo_producto: true,
      nombre: true,
      tipo: true,
    },
  },
  usuario: {
    select: {
      id_usuario: true,
      nombre_usuario: true,
      persona: {
        select: {
          nombre: true,
          apellido_paterno: true,
          apellido_materno: true,
        },
      },
    },
  },
} satisfies Prisma.MovimientoInventarioInclude;

type MovimientoWithRelations = Prisma.MovimientoInventarioGetPayload<{
  include: typeof movimientoInclude;
}>;

export type TransferenciaWithRelations = Prisma.MovimientoTransferenciaGetPayload<{
  include: {
    movimiento_envio: {
      include: typeof movimientoInclude;
    };
    movimiento_recepcion: {
      include: typeof movimientoInclude;
    };
  };
}>;

export const includeTransferencia = {
  movimiento_envio: { include: movimientoInclude },
  movimiento_recepcion: { include: movimientoInclude },
} satisfies Prisma.MovimientoTransferenciaInclude;

const serializeDecimal = (value: Prisma.Decimal | null | undefined) => (value ? value.toString() : null);

const serializeMovimiento = (movimiento: MovimientoWithRelations) => ({
  id_movimiento_inventario: movimiento.id_movimiento_inventario,
  tipo: movimiento.tipo,
  cantidad: serializeDecimal(movimiento.cantidad),
  costo_unitario: serializeDecimal(movimiento.costo_unitario),
  referencia_origen: movimiento.referencia_origen,
  origen_tipo: movimiento.origen_tipo,
  observaciones: movimiento.observaciones,
  fecha: movimiento.fecha.toISOString(),
  producto: movimiento.producto,
  inventario: {
    id_inventario_producto: movimiento.inventario.id_inventario_producto,
    id_producto: movimiento.inventario.id_producto,
    id_almacen: movimiento.inventario.id_almacen,
    id_almacen_ubicacion: movimiento.inventario.id_almacen_ubicacion,
    stock_disponible: serializeDecimal(movimiento.inventario.stock_disponible),
    stock_comprometido: serializeDecimal(movimiento.inventario.stock_comprometido),
    stock_minimo: serializeDecimal(movimiento.inventario.stock_minimo),
    stock_maximo: serializeDecimal(movimiento.inventario.stock_maximo),
    costo_promedio: serializeDecimal(movimiento.inventario.costo_promedio),
    almacen: movimiento.inventario.almacen,
    ubicacion: movimiento.inventario.ubicacion,
  },
  usuario: movimiento.usuario,
});

export const serializeTransferencia = (transferencia: TransferenciaConMovimientos | TransferenciaWithRelations) => ({
  id_movimiento_transferencia: transferencia.id_movimiento_transferencia,
  estado: transferencia.estado,
  creado_en: transferencia.creado_en.toISOString(),
  actualizado_en: transferencia.actualizado_en.toISOString(),
  movimiento_envio: serializeMovimiento(transferencia.movimiento_envio as MovimientoWithRelations),
  movimiento_recepcion: serializeMovimiento(transferencia.movimiento_recepcion as MovimientoWithRelations),
});

const buildWhere = (params: QueryShape): Prisma.MovimientoTransferenciaWhereInput => {
  const where: Prisma.MovimientoTransferenciaWhereInput = {};

  if (params.estado) {
    where.estado = params.estado as TransferenciaEstado;
  }

  const movimientoEnvioWhere: Prisma.MovimientoInventarioWhereInput = {};

  if (params.productoId) {
    movimientoEnvioWhere.id_producto = params.productoId;
  }

  if (params.origenAlmacenId) {
    movimientoEnvioWhere.inventario = {
      id_almacen: params.origenAlmacenId,
    };
  }

  if (Object.keys(movimientoEnvioWhere).length > 0) {
    where.movimiento_envio = { is: movimientoEnvioWhere };
  }

  if (params.destinoAlmacenId) {
    where.movimiento_recepcion = {
      is: {
        inventario: {
          id_almacen: params.destinoAlmacenId,
        },
      },
    };
  }

  return where;
};

const withSessionGuard = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }

  const usuarioId = Number.parseInt(session.user.id, 10);
  if (!Number.isInteger(usuarioId)) {
    return { error: NextResponse.json({ error: 'Sesión inválida' }, { status: 401 }) } as const;
  }

  return { usuarioId } as const;
};

export const GET = async (request: NextRequest) => {
  try {
    const guard = await withSessionGuard();
    if ('error' in guard) return guard.error;

    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const params = querySchema.parse(rawParams);

    const where = buildWhere(params);
    const skip = (params.page - 1) * params.limit;

    const [transferencias, total] = await prisma.$transaction([
      prisma.movimientoTransferencia.findMany({
        where,
        include: includeTransferencia,
        orderBy: { creado_en: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.movimientoTransferencia.count({ where }),
    ]);

    const pages = Math.ceil(total / params.limit) || 1;

    const serializados = transferencias.map((item) => serializeTransferencia(item as TransferenciaWithRelations)) as SerializedTransferencia[];

    return NextResponse.json({
      transferencias: serializados,
      pagination: {
        total,
        pages,
        current: params.page,
        limit: params.limit,
      },
      filters: {
        estado: params.estado ?? null,
        productoId: params.productoId ?? null,
        origenAlmacenId: params.origenAlmacenId ?? null,
        destinoAlmacenId: params.destinoAlmacenId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[GET /api/inventario/transferencias] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const guard = await withSessionGuard();
    if ('error' in guard) return guard.error;

    const body = crearTransferenciaSchema.parse(await request.json());

    const transferencia = await crearTransferencia({
      productoId: body.productoId,
      cantidad: body.cantidad,
      usuarioId: guard.usuarioId,
      origenAlmacenId: body.origenAlmacenId,
      origenUbicacionId: body.origenUbicacionId ?? null,
      destinoAlmacenId: body.destinoAlmacenId,
      destinoUbicacionId: body.destinoUbicacionId ?? null,
      referencia: body.referencia ?? null,
      observaciones: body.observaciones ?? null,
      metadata: body.metadata ?? undefined,
    });

    return NextResponse.json({ transferencia: serializeTransferencia(transferencia) as SerializedTransferencia }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    console.error('[POST /api/inventario/transferencias] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
