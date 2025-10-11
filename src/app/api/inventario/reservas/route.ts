import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Prisma, ReservaEstado } from '@prisma/client';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelarReserva, confirmarReserva, liberarReserva, reservarStock } from '@/lib/inventario/reservas';
import { InventarioError, ReservaInventarioDetallada } from '@/types/inventario';

const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'LIBERADA', 'CANCELADA'] as const;

const metadataSchema = z.record(z.string(), z.any()).optional();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(ESTADOS).optional(),
  productoId: z.coerce.number().int().positive().optional(),
  almacenId: z.coerce.number().int().positive().optional(),
  transaccionId: z.coerce.number().int().positive().optional(),
});

const crearReservaSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  almacenId: z.coerce.number().int().positive(),
  ubicacionId: z.coerce.number().int().positive().nullable().optional(),
  cantidad: z.union([z.number().positive(), z.string().min(1)]),
  transaccionId: z.coerce.number().int().positive().optional(),
  detalleTransaccionId: z.coerce.number().int().positive().optional(),
  motivo: z.string().min(3).max(500).optional(),
  metadata: metadataSchema,
});

const actualizarReservaSchema = z.object({
  reservaId: z.coerce.number().int().positive(),
  accion: z.enum(['confirmar', 'liberar', 'cancelar']),
  motivo: z.string().min(3).max(500).optional(),
  metadata: metadataSchema,
});

type QueryShape = z.infer<typeof querySchema>;

type SerializedReserva = ReturnType<typeof serializeReserva>;

const includeReserva = {
  inventario: {
    include: {
      producto: true,
      almacen: true,
      ubicacion: true,
    },
  },
  transaccion: true,
  detalle_transaccion: true,
} as const satisfies Prisma.ReservaInventarioInclude;

type ReservaWithRelations = Prisma.ReservaInventarioGetPayload<{ include: typeof includeReserva }>;

const serializeDecimal = (value: Prisma.Decimal | null | undefined) => (value ? value.toString() : null);

const serializeReserva = (reserva: ReservaInventarioDetallada | ReservaWithRelations) => ({
  id_reserva_inventario: reserva.id_reserva_inventario,
  id_inventario_producto: reserva.id_inventario_producto,
  id_transaccion: reserva.id_transaccion,
  id_detalle_transaccion: reserva.id_detalle_transaccion,
  cantidad: serializeDecimal(reserva.cantidad),
  estado: reserva.estado,
  motivo: reserva.motivo,
  metadata: reserva.metadata ?? null,
  creado_en: reserva.creado_en.toISOString(),
  actualizado_en: reserva.actualizado_en.toISOString(),
  inventario: {
    id_inventario_producto: reserva.inventario.id_inventario_producto,
    id_producto: reserva.inventario.id_producto,
    id_almacen: reserva.inventario.id_almacen,
    id_almacen_ubicacion: reserva.inventario.id_almacen_ubicacion,
    stock_disponible: serializeDecimal(reserva.inventario.stock_disponible),
    stock_comprometido: serializeDecimal(reserva.inventario.stock_comprometido),
    stock_minimo: serializeDecimal(reserva.inventario.stock_minimo),
    stock_maximo: serializeDecimal(reserva.inventario.stock_maximo),
    costo_promedio: serializeDecimal(reserva.inventario.costo_promedio),
    producto: reserva.inventario.producto
      ? {
          id_producto: reserva.inventario.producto.id_producto,
          codigo_producto: reserva.inventario.producto.codigo_producto,
          nombre: reserva.inventario.producto.nombre,
          tipo: reserva.inventario.producto.tipo,
        }
      : null,
    almacen: reserva.inventario.almacen
      ? {
          id_almacen: reserva.inventario.almacen.id_almacen,
          nombre: reserva.inventario.almacen.nombre,
        }
      : null,
    ubicacion: reserva.inventario.ubicacion
      ? {
          id_almacen_ubicacion: reserva.inventario.ubicacion.id_almacen_ubicacion,
          codigo: reserva.inventario.ubicacion.codigo,
          descripcion: reserva.inventario.ubicacion.descripcion,
        }
      : null,
  },
  transaccion: reserva.transaccion
    ? {
        id_transaccion: reserva.transaccion.id_transaccion,
        codigo_transaccion: reserva.transaccion.codigo_transaccion,
        tipo_transaccion: reserva.transaccion.tipo_transaccion,
        estado_orden: reserva.transaccion.estado_orden,
        estado_pago: reserva.transaccion.estado_pago,
        fecha: reserva.transaccion.fecha.toISOString(),
      }
    : null,
  detalle_transaccion: reserva.detalle_transaccion
    ? {
        id_detalle_transaccion: reserva.detalle_transaccion.id_detalle_transaccion,
        id_producto: reserva.detalle_transaccion.id_producto,
        id_servicio: reserva.detalle_transaccion.id_servicio,
        cantidad: reserva.detalle_transaccion.cantidad,
        precio: serializeDecimal(reserva.detalle_transaccion.precio),
        total: serializeDecimal(reserva.detalle_transaccion.total),
      }
    : null,
});

const buildWhere = (params: QueryShape): Prisma.ReservaInventarioWhereInput => {
  const where: Prisma.ReservaInventarioWhereInput = {};

  if (params.estado) {
    where.estado = params.estado as ReservaEstado;
  }

  if (params.transaccionId) {
    where.id_transaccion = params.transaccionId;
  }

  if (params.productoId || params.almacenId) {
    const inventarioFilter: Prisma.InventarioProductoWhereInput = {};

    if (params.productoId) {
      inventarioFilter.id_producto = params.productoId;
    }

    if (params.almacenId) {
      inventarioFilter.id_almacen = params.almacenId;
    }

    where.inventario = inventarioFilter;
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

    const [reservas, total] = await prisma.$transaction([
      prisma.reservaInventario.findMany({
        where,
        include: includeReserva,
        orderBy: { creado_en: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.reservaInventario.count({ where }),
    ]);

    const pages = Math.ceil(total / params.limit) || 1;

    const serializados = reservas.map((reserva) => serializeReserva(reserva as ReservaWithRelations)) as SerializedReserva[];

    return NextResponse.json({
      reservas: serializados,
      pagination: {
        total,
        pages,
        current: params.page,
        limit: params.limit,
      },
      filters: {
        estado: params.estado ?? null,
        productoId: params.productoId ?? null,
        almacenId: params.almacenId ?? null,
        transaccionId: params.transaccionId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[GET /api/inventario/reservas] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const guard = await withSessionGuard();
    if ('error' in guard) return guard.error;

    const body = crearReservaSchema.parse(await request.json());

    const reserva = await reservarStock({
      productoId: body.productoId,
      almacenId: body.almacenId,
      ubicacionId: body.ubicacionId ?? null,
      cantidad: body.cantidad,
      usuarioId: guard.usuarioId,
      transaccionId: body.transaccionId,
      detalleTransaccionId: body.detalleTransaccionId,
      motivo: body.motivo,
      metadata: body.metadata ?? undefined,
    });

    return NextResponse.json({ reserva: serializeReserva(reserva) as SerializedReserva }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    console.error('[POST /api/inventario/reservas] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const PATCH = async (request: NextRequest) => {
  try {
    const guard = await withSessionGuard();
    if ('error' in guard) return guard.error;

    const body = actualizarReservaSchema.parse(await request.json());

    let reserva: ReservaInventarioDetallada;

    if (body.accion === 'confirmar') {
      reserva = await confirmarReserva({
        reservaId: body.reservaId,
        usuarioId: guard.usuarioId,
        motivo: body.motivo,
        metadata: body.metadata ?? undefined,
      });
    } else if (body.accion === 'liberar') {
      reserva = await liberarReserva({
        reservaId: body.reservaId,
        usuarioId: guard.usuarioId,
        motivo: body.motivo,
        metadata: body.metadata ?? undefined,
      });
    } else {
      reserva = await cancelarReserva({
        reservaId: body.reservaId,
        usuarioId: guard.usuarioId,
        motivo: body.motivo,
        metadata: body.metadata ?? undefined,
      });
    }

    return NextResponse.json({ reserva: serializeReserva(reserva) as SerializedReserva });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    console.error('[PATCH /api/inventario/reservas] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
