import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { obtenerResumenInventario } from '@/lib/inventario/reportes';
import { prisma } from '@/lib/prisma';
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards';

export const GET = async () => {
  try {
    const session = await getServerSession(authOptions);
    try {
      await asegurarPermiso(session, 'reportes.ver', { prismaClient: prisma });
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para ver reportes' }, { status: 403 });
      }
      throw error;
    }

    const resumen = await obtenerResumenInventario();
    return NextResponse.json(resumen);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[GET /api/inventario/reportes] Error:', error);
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};
