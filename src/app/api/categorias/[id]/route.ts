import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { action, estatus } = await request.json()

    if (action === 'toggle_status') {
      const categoria = await prisma.categoria.findUnique({
        where: { id_categoria: id }
      })

      if (!categoria) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
      }

      const categoriaActualizada = await prisma.categoria.update({
        where: { id_categoria: id },
        data: { estatus: estatus },
        include: {
          _count: {
            select: { productos: true }
          }
        }
      })

      // Registrar en bitácora
      await prisma.bitacora.create({
        data: {
          id_usuario: parseInt(session.user.id),
          accion: 'TOGGLE_STATUS_CATEGORIA',
          descripcion: `Categoría ${estatus ? 'activada' : 'desactivada'}: ${categoria.nombre}`,
          tabla: 'categoria'
        }
      })

      return NextResponse.json(categoriaActualizada)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH categoria:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}