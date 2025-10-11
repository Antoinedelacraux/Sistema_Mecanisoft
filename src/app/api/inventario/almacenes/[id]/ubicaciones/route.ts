import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryGuardMessage, hasInventoryPermission } from '@/lib/inventario/permissions';

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  activo: z.enum(['true', 'false']).optional(),
});

const createSchema = z.object({
  codigo: z.string().trim().min(2).max(50),
  descripcion: z.string().trim().max(500).optional(),
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

const ensureAlmacenExists = async (id: number) => {
  const exists = await prisma.almacen.findUnique({
    where: { id_almacen: id },
    select: { id_almacen: true },
  });

  return Boolean(exists);
};

export const GET = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasInventoryPermission(session.user.role, 'read')) {
      return NextResponse.json({ error: getInventoryGuardMessage('read') }, { status: 403 });
    }

    const params = await context.params;
    const { id } = paramsSchema.parse(params);

    const almacenExists = await ensureAlmacenExists(id);
    if (!almacenExists) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { page, limit, search, activo } = querySchema.parse(rawParams);

  const where: NonNullable<Parameters<typeof prisma.almacenUbicacion.findMany>[0]>['where'] = {
      id_almacen: id,
    };

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (activo) {
      where.activo = activo === 'true';
    }

    const skip = (page - 1) * limit;

    const [ubicaciones, total] = await prisma.$transaction([
      prisma.almacenUbicacion.findMany({
        where,
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit,
      }),
      prisma.almacenUbicacion.count({ where }),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      ubicaciones: ubicaciones.map(serializeUbicacion),
      pagination: {
        total,
        pages,
        current: page,
        limit,
      },
      filters: {
        search: search ?? null,
        activo: activo ? activo === 'true' : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[GET /api/inventario/almacenes/:id/ubicaciones] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const POST = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasInventoryPermission(session.user.role, 'write')) {
      return NextResponse.json({ error: getInventoryGuardMessage('write') }, { status: 403 });
    }

    const params = await context.params;
    const { id } = paramsSchema.parse(params);
    const body = createSchema.parse(await request.json());

    const almacenExists = await ensureAlmacenExists(id);
    if (!almacenExists) {
      return NextResponse.json({ error: 'Almacén no encontrado' }, { status: 404 });
    }

    const ubicacion = await prisma.almacenUbicacion.create({
      data: {
        id_almacen: id,
        codigo: body.codigo,
        descripcion: body.descripcion ?? null,
        activo: body.activo ?? true,
      },
    });

    return NextResponse.json({ ubicacion: serializeUbicacion(ubicacion) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'El código de ubicación ya está registrado' }, { status: 409 });
    }

    console.error('[POST /api/inventario/almacenes/:id/ubicaciones] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
