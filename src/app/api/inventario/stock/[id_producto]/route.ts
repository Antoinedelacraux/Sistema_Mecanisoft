import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { getStock, isInventarioBasicoError } from '@/lib/inventario/basico'
import { prisma } from '@/lib/prisma'
import {
  asegurarPermiso,
  PermisoDenegadoError,
  SesionInvalidaError,
} from '@/lib/permisos/guards'

const paramsSchema = z.object({
  id_producto: z.coerce.number().int().positive(),
})

export const GET = async (_request: NextRequest, context: { params: Promise<{ id_producto: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.ver', { prismaClient: prisma })

    const params = await context.params
    const { id_producto } = paramsSchema.parse(params)
    const detalle = await getStock(id_producto)

    return NextResponse.json(detalle)
  } catch (error) {
    if (isInventarioBasicoError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[API] Error al obtener stock simplificado', error)
    return NextResponse.json({ error: 'Error interno al consultar stock' }, { status: 500 })
  }
}
