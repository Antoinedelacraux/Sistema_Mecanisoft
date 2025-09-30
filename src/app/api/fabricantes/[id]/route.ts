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

    const { action, estado } = await request.json()

    if (action === 'toggle_status') {
      const fabricante = await prisma.fabricante.findUnique({
        where: { id_fabricante: id }
      })

      if (!fabricante) {
        return NextResponse.json({ error: 'Fabricante no encontrado' }, { status: 404 })
      }

      const fabricanteActualizado = await prisma.fabricante.update({
        where: { id_fabricante: id },
        data: { estado: estado },
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
          accion: 'TOGGLE_STATUS_FABRICANTE',
          descripcion: `Fabricante ${estado ? 'activado' : 'desactivado'}: ${fabricante.nombre_fabricante}`,
          tabla: 'fabricante'
        }
      })

      return NextResponse.json(fabricanteActualizado)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH fabricante:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}