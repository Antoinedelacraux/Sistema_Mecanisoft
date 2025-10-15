import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { isInventarioBasicoError } from '@/lib/inventario/basico/errors'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export const PATCH = async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'productos.gestionar', { prismaClient: prisma })

    const params = await context.params
    const { id } = paramsSchema.parse(params)

    // obtener stock y costo_promedio
    const clientAny: any = prisma as any
    const stockRes = await clientAny.inventario.findUnique({ where: { id_producto: id } })
    if (!stockRes) {
      return NextResponse.json({ error: 'No hay inventario registrado para este producto' }, { status: 404 })
    }

    const costo = stockRes.costo_promedio
    // actualizar producto
    const producto = await clientAny.producto.update({ where: { id_producto: id }, data: { precio_compra: costo } })

    // bitacora
    await clientAny.bitacora.create({ data: { id_usuario: Number.parseInt(session.user.id, 10) || 0, accion: 'PRODUCTO_SINCRONIZAR_PRECIO', descripcion: `Sincronizado precio_compra producto ${id} con costo_promedio ${costo.toString()}`, tabla: 'producto' } })

    return NextResponse.json({ precio_compra: producto.precio_compra.toString() })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 422 })
    }

    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (isInventarioBasicoError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    console.error('[API] Error sincronizando precio de compra', error)
    return NextResponse.json({ error: 'Error interno al sincronizar precio' }, { status: 500 })
  }
}
