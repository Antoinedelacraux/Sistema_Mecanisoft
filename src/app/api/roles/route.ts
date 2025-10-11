import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const roles = await prisma.rol.findMany({
    where: { estatus: true },
    orderBy: { nombre_rol: 'asc' }
  })

  return NextResponse.json({ roles })
}
