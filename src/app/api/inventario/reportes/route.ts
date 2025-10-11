import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { obtenerResumenInventario } from '@/lib/inventario/reportes';

export const GET = async () => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
