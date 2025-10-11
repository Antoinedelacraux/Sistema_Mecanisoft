import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { Prisma, MovimientoTipo } from '@prisma/client';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAjuste, registrarIngreso, registrarSalida } from '@/lib/inventario/services';
import type { RegistrarAjusteDTO, RegistrarIngresoDTO, RegistrarSalidaDTO } from '@/types/inventario';
import { InventarioError, MovimientoInventarioConDetalles } from '@/types/inventario';

const MOVIMIENTO_TIPOS = ['INGRESO', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] as const;
const ORIGENES = ['COMPRA', 'ORDEN_TRABAJO', 'FACTURACION', 'AJUSTE_MANUAL', 'TRANSFERENCIA', 'OTRO'] as const;

const movimientoBaseSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  almacenId: z.coerce.number().int().positive(),
  ubicacionId: z.coerce.number().int().positive().optional(),
  cantidad: z.union([z.number().positive(), z.string().min(1)]),
  referencia: z.string().max(100).optional(),
  observaciones: z.string().max(500).optional(),
  origenTipo: z.enum(ORIGENES).optional(),
});

const movimientoIngresoSchema = movimientoBaseSchema.extend({
  tipo: z.literal('INGRESO'),
  costoUnitario: z.union([z.number(), z.string().min(1)]),
});

const movimientoSalidaSchema = movimientoBaseSchema.extend({
  tipo: z.literal('SALIDA'),
});

const movimientoAjusteSchema = movimientoBaseSchema.extend({
  tipo: z.union([z.literal('AJUSTE_POSITIVO'), z.literal('AJUSTE_NEGATIVO')]),
  motivo: z.string().min(3).max(250),
  evidenciaUrl: z.string().url().max(500).optional(),
});

const movimientoSchema = z.discriminatedUnion('tipo', [
  movimientoIngresoSchema,
  movimientoSalidaSchema,
  movimientoAjusteSchema,
]);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tipo: z.enum(MOVIMIENTO_TIPOS).optional(),
  productoId: z.coerce.number().int().positive().optional(),
  almacenId: z.coerce.number().int().positive().optional(),
});

type MovimientoSchema = z.infer<typeof movimientoSchema>;

type SerializedMovimiento = ReturnType<typeof serializeMovimiento>;

const serializeDecimal = (value: Prisma.Decimal | null | undefined) =>
  value ? value.toString() : null;

const serializeMovimiento = (movimiento: MovimientoInventarioConDetalles) => ({
  id_movimiento_inventario: movimiento.id_movimiento_inventario,
  tipo: movimiento.tipo,
  id_producto: movimiento.id_producto,
  id_inventario_producto: movimiento.id_inventario_producto,
  id_usuario: movimiento.id_usuario,
  cantidad: serializeDecimal(movimiento.cantidad),
  costo_unitario: serializeDecimal(movimiento.costo_unitario),
  referencia_origen: movimiento.referencia_origen,
  origen_tipo: movimiento.origen_tipo,
  observaciones: movimiento.observaciones,
  fecha: movimiento.fecha.toISOString(),
  producto: {
    id_producto: movimiento.producto.id_producto,
    codigo_producto: movimiento.producto.codigo_producto,
    nombre: movimiento.producto.nombre,
    tipo: movimiento.producto.tipo,
  },
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
    creado_en: movimiento.inventario.creado_en.toISOString(),
    actualizado_en: movimiento.inventario.actualizado_en.toISOString(),
  },
  usuario: {
    id_usuario: movimiento.usuario.id_usuario,
    nombre_usuario: movimiento.usuario.nombre_usuario,
    persona: movimiento.usuario.persona
      ? {
          nombre: movimiento.usuario.persona.nombre,
          apellido_paterno: movimiento.usuario.persona.apellido_paterno,
          apellido_materno: movimiento.usuario.persona.apellido_materno,
        }
      : null,
  },
});

const buildWhere = (input: z.infer<typeof querySchema>) => {
  const where: Prisma.MovimientoInventarioWhereInput = {};

  if (input.tipo) {
    where.tipo = input.tipo as MovimientoTipo;
  }

  if (input.productoId) {
    where.id_producto = input.productoId;
  }

  if (input.almacenId) {
    where.inventario = { id_almacen: input.almacenId };
  }

  return where;
};

const mapRespuesta = (movimientos: MovimientoInventarioConDetalles[]) => movimientos.map(serializeMovimiento);

export const GET = async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { page, limit, tipo, productoId, almacenId } = querySchema.parse(rawParams);

    const where = buildWhere({ page, limit, tipo, productoId, almacenId });
    const skip = (page - 1) * limit;

    const [movimientos, total] = await prisma.$transaction([
      prisma.movimientoInventario.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
        include: {
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
          producto: true,
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
        },
      }),
      prisma.movimientoInventario.count({ where }),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      movimientos: mapRespuesta(movimientos as MovimientoInventarioConDetalles[]),
      pagination: {
        total,
        pages,
        current: page,
        limit,
      },
      filters: { tipo, productoId, almacenId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[GET /api/inventario/movimientos] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

const buildMovimientoPayload = (
  input: MovimientoSchema,
  usuarioId: number,
): RegistrarIngresoDTO | RegistrarSalidaDTO | RegistrarAjusteDTO => {
  const base = {
    productoId: input.productoId,
    almacenId: input.almacenId,
    usuarioId,
    cantidad: input.cantidad,
    ubicacionId: input.ubicacionId,
    referencia: input.referencia,
    observaciones: input.observaciones,
    origenTipo: input.origenTipo,
  };

  if (input.tipo === 'INGRESO') {
    return {
      ...base,
      costoUnitario: input.costoUnitario,
    };
  }

  if (input.tipo === 'SALIDA') {
    return base;
  }

  return {
    ...base,
    motivo: input.motivo,
    esPositivo: input.tipo === 'AJUSTE_POSITIVO',
    evidenciaUrl: input.evidenciaUrl,
  };
};

export const POST = async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuarioId = Number.parseInt(session.user.id, 10);
    if (!Number.isInteger(usuarioId)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    const body = movimientoSchema.parse(await request.json());

    let movimiento: MovimientoInventarioConDetalles;

    if (body.tipo === 'INGRESO') {
      movimiento = await registrarIngreso({
        ...buildMovimientoPayload(body, usuarioId),
      } as RegistrarIngresoDTO);
    } else if (body.tipo === 'SALIDA') {
      movimiento = await registrarSalida({
        ...buildMovimientoPayload(body, usuarioId),
      } as RegistrarSalidaDTO);
    } else {
      movimiento = await registrarAjuste({
        ...buildMovimientoPayload(body, usuarioId),
      } as RegistrarAjusteDTO);
    }

    return NextResponse.json(
      { movimiento: serializeMovimiento(movimiento) as SerializedMovimiento },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    console.error('[POST /api/inventario/movimientos] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
