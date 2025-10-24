import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = request.nextUrl
    const q = String(url.searchParams.get('q') ?? '')
    const take = Math.min(Number(url.searchParams.get('take') ?? '10'), 50)

    if (!q) return NextResponse.json({ usuarios: [] })

    const usuarios = await prisma.usuario.findMany({
      where: {
        persona: {
          nombre: { contains: q, mode: 'insensitive' }
        }
      },
      take,
      select: { id_usuario: true, nombre_usuario: true, persona: { select: { nombre: true, apellido_paterno: true } } }
    })

    const mapped = usuarios.map(u => ({ id: u.id_usuario, label: `${u.persona?.nombre ?? ''} ${u.persona?.apellido_paterno ?? ''}`.trim(), nombre_usuario: u.nombre_usuario }))

    return NextResponse.json({ usuarios: mapped })
  } catch (error) {
    console.error('[usuarios/buscar] error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
