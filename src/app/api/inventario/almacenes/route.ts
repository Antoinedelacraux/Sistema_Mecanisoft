import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryGuardMessage, hasInventoryPermission } from '@/lib/inventario/permissions';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  activo: z.enum(['true', 'false']).optional(),
});

const createSchema = z.object({
  nombre: z.string().trim().min(3).max(100),
  descripcion: z.string().trim().max(500).optional(),
  direccion: z.string().trim().max(500).optional(),
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
  _count: { ubicaciones: number; inventarios: number };
}) => ({
  id_almacen: almacen.id_almacen,
  nombre: almacen.nombre,
  descripcion: almacen.descripcion,
  direccion: almacen.direccion,
  activo: almacen.activo,
  creado_en: almacen.creado_en.toISOString(),
  actualizado_en: almacen.actualizado_en.toISOString(),
  totales: {
    ubicaciones: almacen._count.ubicaciones,
    inventarios: almacen._count.inventarios,
  },
});

export const GET = async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasInventoryPermission(session.user.role, 'read')) {
      return NextResponse.json({ error: getInventoryGuardMessage('read') }, { status: 403 });
    }

    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { page, limit, search, activo } = querySchema.parse(rawParams);

  const where: NonNullable<Parameters<typeof prisma.almacen.findMany>[0]>['where'] = {};

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { direccion: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (activo) {
      where.activo = activo === 'true';
    }

    const skip = (page - 1) * limit;

    const [almacenes, total] = await prisma.$transaction([
      prisma.almacen.findMany({
        where,
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              ubicaciones: true,
              inventarios: true,
            },
          },
        },
      }),
      prisma.almacen.count({ where }),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      almacenes: almacenes.map(serializeAlmacen),
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

    console.error('[GET /api/inventario/almacenes] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!hasInventoryPermission(session.user.role, 'write')) {
      return NextResponse.json({ error: getInventoryGuardMessage('write') }, { status: 403 });
    }

    const body = createSchema.parse(await request.json());

    const almacen = await prisma.almacen.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion ?? null,
        direccion: body.direccion ?? null,
        activo: body.activo ?? true,
      },
      include: {
        _count: {
          select: {
            ubicaciones: true,
            inventarios: true,
          },
        },
      },
    });

    return NextResponse.json({ almacen: serializeAlmacen(almacen) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    console.error('[POST /api/inventario/almacenes] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
