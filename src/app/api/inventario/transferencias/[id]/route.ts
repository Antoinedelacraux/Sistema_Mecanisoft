import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { confirmarTransferencia, anularTransferencia } from '@/lib/inventario/services';
import { serializeTransferencia } from '@/app/api/inventario/transferencias/route';
import { InventarioError } from '@/types/inventario';

const metadataSchema = z.record(z.string(), z.any()).optional();

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
  accion: z.enum(['confirmar', 'anular']),
  observaciones: z.string().max(500).optional(),
  motivo: z.string().min(3).max(500).optional(),
  metadata: metadataSchema,
});

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

export const PATCH = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const guard = await withSessionGuard();
    if ('error' in guard) return guard.error;

    const params = await context.params;
    const { id } = paramsSchema.parse(params);
    const body = bodySchema.parse(await request.json());

    const common = {
      transferenciaId: id,
      usuarioId: guard.usuarioId,
      metadata: body.metadata ?? undefined,
    } as const;

    const transferencia = body.accion === 'confirmar'
      ? await confirmarTransferencia({ ...common, observaciones: body.observaciones ?? undefined })
      : await anularTransferencia({ ...common, motivo: body.motivo ?? undefined });

    return NextResponse.json({ transferencia: serializeTransferencia(transferencia) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 422 });
    }

    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    console.error('[PATCH /api/inventario/transferencias/:id] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
