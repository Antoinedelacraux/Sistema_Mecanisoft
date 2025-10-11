import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ✅ Endpoint que otros módulos usarán para obtener solo clientes activos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const whereCondition = {
      estatus: true, // ✅ SOLO ACTIVOS para otros módulos
      ...(search && {
        OR: [
          { persona: { nombre: { contains: search, mode: 'insensitive' as const } } },
          { persona: { apellido_paterno: { contains: search, mode: 'insensitive' as const } } },
          { persona: { numero_documento: { contains: search, mode: 'insensitive' as const } } },
        ]
      })
    }

    const clientes = await prisma.cliente.findMany({
      where: whereCondition,
      include: {
        persona: true,
        _count: {
          select: { vehiculos: true }
        }
      },
      orderBy: {
        persona: {
          nombre: 'asc'
        }
      }
    })

    return NextResponse.json({ clientes })

  } catch (error) {
    console.error('Error obteniendo clientes activos:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}