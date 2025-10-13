import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryGuardMessage, requireInventoryPermission } from '@/lib/inventario/permissions';
import type { InventoryPermissionLevel } from '@/lib/inventario/permissions';
import { PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards';

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
  ubicacionId: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  codigo: z.string().trim().min(2).max(50).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});

const serializeUbicacion = (ubicacion: {
  id_almacen_ubicacion: number;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
}) => ({
  id_almacen_ubicacion: ubicacion.id_almacen_ubicacion,
  codigo: ubicacion.codigo,
  descripcion: ubicacion.descripcion,
  activo: ubicacion.activo,
  creado_en: ubicacion.creado_en.toISOString(),
  actualizado_en: ubicacion.actualizado_en.toISOString(),
});

const withSessionGuard = async (level: InventoryPermissionLevel) => {
  const session = await getServerSession(authOptions)
  try {
    await requireInventoryPermission(session, level, { prismaClient: prisma })
    return { session } as const
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const
    }
    if (error instanceof PermisoDenegadoError) {
      return { error: NextResponse.json({ error: getInventoryGuardMessage(level) }, { status: 403 }) } as const
    }
    throw error
  }
};

const loadUbicacion = async (almacenId: number, ubicacionId: number) => prisma.almacenUbicacion.findFirst({
  where: {
    id_almacen: almacenId,
    id_almacen_ubicacion: ubicacionId,
  },
});

export const GET = async (_request: NextRequest, context: { params: Promise<{ id: string; ubicacionId: string }> }) => {
  try {
  const guard = await withSessionGuard('read');
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id, ubicacionId } = paramsSchema.parse(params);

    const ubicacion = await loadUbicacion(id, ubicacionId);
    if (!ubicacion) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ubicacion: serializeUbicacion(ubicacion) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[GET /api/inventario/almacenes/:id/ubicaciones/:ubicacionId] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const PUT = async (request: NextRequest, context: { params: Promise<{ id: string; ubicacionId: string }> }) => {
  try {
  const guard = await withSessionGuard('write');
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id, ubicacionId } = paramsSchema.parse(params);
    const body = updateSchema.parse(await request.json());

    const ubicacion = await prisma.almacenUbicacion.updateMany({
      where: {
        id_almacen: id,
        id_almacen_ubicacion: ubicacionId,
      },
      data: {
        codigo: body.codigo,
        descripcion: body.descripcion ?? undefined,
        activo: body.activo ?? undefined,
      },
    });

    if (ubicacion.count === 0) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    const refreshed = await loadUbicacion(id, ubicacionId);
    if (!refreshed) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ubicacion: serializeUbicacion(refreshed) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'El código de ubicación ya está registrado' }, { status: 409 });
    }

    console.error('[PUT /api/inventario/almacenes/:id/ubicaciones/:ubicacionId] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const DELETE = async (_request: NextRequest, context: { params: Promise<{ id: string; ubicacionId: string }> }) => {
  try {
  const guard = await withSessionGuard('write');
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id, ubicacionId } = paramsSchema.parse(params);

    const result = await prisma.almacenUbicacion.updateMany({
      where: {
        id_almacen: id,
        id_almacen_ubicacion: ubicacionId,
      },
      data: { activo: false },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    const ubicacion = await loadUbicacion(id, ubicacionId);
    if (!ubicacion) {
      return NextResponse.json({ error: 'Ubicación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ubicacion: serializeUbicacion(ubicacion) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[DELETE /api/inventario/almacenes/:id/ubicaciones/:ubicacionId] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
