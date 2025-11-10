import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { generarAlertasStockMinimo } from '@/lib/inventario/alertas';
import { enqueueInventoryAlertNotification } from '@/lib/inventario/alertas-notifier';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
      await asegurarPermiso(session, 'inventario.alertas', { prismaClient: prisma });
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'Permiso denegado' }, { status: 403 });
      }
      throw error;
    }

    const { totalCriticos, productos } = await generarAlertasStockMinimo();

    let notificationResult: Awaited<ReturnType<typeof enqueueInventoryAlertNotification>> | null = null;
    try {
      notificationResult = await enqueueInventoryAlertNotification({
        productos,
        totalCriticos,
        triggeredBy: Number(session.user.id),
      });
    } catch (notifyError) {
      const message = notifyError instanceof Error ? notifyError.message : String(notifyError);
      logger.error({ err: message }, 'Error enviando notificación de alertas de inventario');
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalCriticos,
      productos,
      notification: notificationResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: message }, 'GET /api/inventario/alertas/cron failed');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
