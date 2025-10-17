import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { ZodError } from 'zod'

import { authOptions } from '@/lib/auth'
import { getTechnicianUtilization } from '@/lib/indicadores/mantenimientos'
import { parseCacheControlParams, parseTechnicianParams } from '@/lib/indicadores/params'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

const REQUIRED_PERMISSIONS = ['indicadores.ver', 'mantenimientos.ver'] as const

const asegurarPermisosIndicadores = async (session: Session | null) => {
  for (const permiso of REQUIRED_PERMISSIONS) {
    try {
      await asegurarPermiso(session, permiso)
      return
    } catch (error) {
      if (error instanceof PermisoDenegadoError) {
        continue
      }
      throw error
    }
  }
  throw new PermisoDenegadoError('No cuentas con permisos para indicadores')
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermisosIndicadores(session)
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
    }
    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: 'No cuentas con permisos para consultar indicadores.' }, { status: 403 })
    }
    console.error('Error validando permisos de indicadores', error)
    return NextResponse.json({ error: 'No se pudo validar tus permisos.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)

  try {
  const params = parseTechnicianParams(searchParams)
  const cacheControl = parseCacheControlParams(searchParams)
  const data = await getTechnicianUtilization(params.from, params.to, cacheControl)
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', detalles: error.flatten() }, { status: 400 })
    }
    console.error('Error consultando utilización de técnicos', error)
    return NextResponse.json({ error: 'No se pudo calcular la utilización de técnicos.' }, { status: 500 })
  }
}
