import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/ordenes/[id]  (borrado lógico: estatus -> inactivo)
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const params = { id }
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const orden = await prisma.transaccion.findUnique({
      where: { id_transaccion: id },
      select: { id_transaccion: true, tipo_transaccion: true, estatus: true, codigo_transaccion: true, estado_orden: true, estado_pago: true }
    })
    if (!orden || orden.tipo_transaccion !== 'orden') {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }
    if (orden.estatus !== 'activo') {
      return NextResponse.json({ error: 'La orden ya está eliminada' }, { status: 400 })
    }

    // (Opcional) Restringir eliminación si está entregada o pagada completamente
    if (orden.estado_orden === 'entregado') {
      return NextResponse.json({ error: 'No se puede eliminar una orden entregada' }, { status: 400 })
    }
    if (orden.estado_pago === 'pagado') {
      return NextResponse.json({ error: 'No se puede eliminar una orden totalmente pagada' }, { status: 400 })
    }

    await prisma.transaccion.update({
      where: { id_transaccion: id },
      data: { estatus: 'inactivo' }
    })

    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id, 10),
        accion: 'DELETE_ORDEN',
        descripcion: `Orden eliminada lógicamente: ${orden.codigo_transaccion}`,
        tabla: 'transaccion'
      }
    })

    return NextResponse.json({ message: 'Orden eliminada' })
  } catch (error) {
    console.error('Error eliminando orden:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
