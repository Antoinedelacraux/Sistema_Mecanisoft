import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryGuardMessage, hasInventoryPermission } from '@/lib/inventario/permissions';
import type { InventoryPermissionLevel } from '@/lib/inventario/permissions';

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(3).max(100).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  direccion: z.string().trim().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});

const serializeAlmacen = (almacen: {
  id_almacen: number;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
  ubicaciones: Array<{
    id_almacen_ubicacion: number;
    codigo: string;
    descripcion: string | null;
    activo: boolean;
    creado_en: Date;
    actualizado_en: Date;
  }>;
}) => ({
  id_almacen: almacen.id_almacen,
  nombre: almacen.nombre,
  descripcion: almacen.descripcion,
  direccion: almacen.direccion,
  activo: almacen.activo,
  creado_en: almacen.creado_en.toISOString(),
  actualizado_en: almacen.actualizado_en.toISOString(),
  ubicaciones: almacen.ubicaciones.map((ubicacion) => ({
    id_almacen_ubicacion: ubicacion.id_almacen_ubicacion,
    codigo: ubicacion.codigo,
    descripcion: ubicacion.descripcion,
    activo: ubicacion.activo,
    creado_en: ubicacion.creado_en.toISOString(),
    actualizado_en: ubicacion.actualizado_en.toISOString(),
  })),
});

const withSessionGuard = async (level: InventoryPermissionLevel) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }

  if (!hasInventoryPermission(session.user.role, level)) {
    return { error: NextResponse.json({ error: getInventoryGuardMessage(level) }, { status: 403 }) } as const;
  }

  return { session } as const;
};

const loadAlmacen = async (id: number) => {
  const almacen = await prisma.almacen.findUnique({
    where: { id_almacen: id },
    include: {
      ubicaciones: {
        orderBy: { creado_en: 'desc' },
      },
    },
  });

  if (!almacen) {
    return null;
  }

  return almacen;
};

export const GET = async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
  const guard = await withSessionGuard('read');
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id } = paramsSchema.parse(params);

    const almacen = await loadAlmacen(id);
    if (!almacen) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ almacen: serializeAlmacen(almacen) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[GET /api/inventario/almacenes/:id] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const PUT = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
  const guard = await withSessionGuard('write');
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id } = paramsSchema.parse(params);
    const body = updateSchema.parse(await request.json());

    const updated = await prisma.almacen.update({
      where: { id_almacen: id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion ?? undefined,
        direccion: body.direccion ?? undefined,
        activo: body.activo ?? undefined,
      },
      include: {
        ubicaciones: {
          orderBy: { creado_en: 'desc' },
        },
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ almacen: serializeAlmacen(updated) });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[PUT /api/inventario/almacenes/:id] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const DELETE = async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
  const guard = await withSessionGuard('write');
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id } = paramsSchema.parse(params);

    const almacen = await prisma.almacen.update({
      where: { id_almacen: id },
      data: { activo: false },
      include: {
        ubicaciones: {
          orderBy: { creado_en: 'desc' },
        },
      },
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    });

    if (!almacen) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ almacen: serializeAlmacen(almacen) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[DELETE /api/inventario/almacenes/:id] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
