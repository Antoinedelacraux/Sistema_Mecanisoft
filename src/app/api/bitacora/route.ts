import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await asegurarPermiso(session, 'bitacora.ver')
    } catch (error) {
      if (error instanceof SesionInvalidaError) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      if (error instanceof PermisoDenegadoError) return NextResponse.json({ error: 'No tienes permiso para ver la bitácora' }, { status: 403 })
      throw error
    }

    const url = request.nextUrl
    const page = Number(url.searchParams.get('page') ?? '1')
    const perPage = Math.min(Number(url.searchParams.get('perPage') ?? '25'), 200)
    const skip = (Math.max(page, 1) - 1) * perPage

    const usuarioId = url.searchParams.get('usuarioId')
    const tabla = url.searchParams.get('tabla')
    const accion = url.searchParams.get('accion')
    const desde = url.searchParams.get('desde')
    const hasta = url.searchParams.get('hasta')
    const search = url.searchParams.get('q')?.trim()
    const ip = url.searchParams.get('ip')?.trim()

    const andConditions: Prisma.BitacoraWhereInput[] = []

    if (usuarioId) {
      const parsed = Number(usuarioId)
      if (!Number.isNaN(parsed)) {
        andConditions.push({ id_usuario: parsed })
      }
    }

    const parseList = (value?: string | null) => {
      if (!value) return []
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }

    const tablas = parseList(tabla)
    if (tablas.length > 0) {
      andConditions.push({ tabla: { in: tablas } })
    }

    const acciones = parseList(accion)
    if (acciones.length > 0) {
      andConditions.push({ accion: { in: acciones } })
    }

    if (desde || hasta) {
      const rango: Prisma.DateTimeFilter = {}
      if (desde) rango.gte = new Date(desde)
      if (hasta) rango.lte = new Date(hasta)
      andConditions.push({ fecha_hora: rango })
    }

    if (ip) {
      andConditions.push({ ip_publica: { contains: ip, mode: 'insensitive' } })
    }

    if (search) {
      const like = { contains: search, mode: 'insensitive' as const }
      andConditions.push({
        OR: [
          { accion: like },
          { descripcion: like },
          { tabla: like },
          { ip_publica: like },
          {
            usuario: {
              is: {
                OR: [
                  { nombre_usuario: like },
                  {
                    persona: {
                      is: {
                        OR: [
                          { nombre: like },
                          { apellido_paterno: like },
                          { apellido_materno: like },
                          { correo: like },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      })
    }

    const where: Prisma.BitacoraWhereInput = andConditions.length > 0 ? { AND: andConditions } : {}

    const [total, eventos] = await Promise.all([
      prisma.bitacora.count({ where }),
      prisma.bitacora.findMany({
        where,
        orderBy: { fecha_hora: 'desc' },
        skip,
        take: perPage,
        include: {
          usuario: {
            select: {
              id_usuario: true,
              nombre_usuario: true,
              persona: {
                select: {
                  id_persona: true,
                  nombre: true,
                  apellido_paterno: true,
                  apellido_materno: true,
                  correo: true
                }
              }
            }
          }
        }
      })
    ])

    const eventosConUsuario = eventos.map((evento: any) => {
      const persona = evento.usuario?.persona
      return {
        ...evento,
        usuario: evento.usuario
          ? {
              id: evento.usuario.id_usuario,
              username: evento.usuario.nombre_usuario,
              persona: persona
                ? {
                    id: persona.id_persona,
                    nombreCompleto: [persona.nombre, persona.apellido_paterno, persona.apellido_materno].filter(Boolean).join(' ').trim(),
                    correo: persona.correo ?? null
                  }
                : null
            }
          : null
      }
    })

    // Export CSV if requested
    if (url.searchParams.get('export') === 'csv') {
      const headers = [
        'id_bitacora',
        'fecha_hora',
        'id_usuario',
        'usuario_username',
        'usuario_nombre',
        'accion',
        'tabla',
        'descripcion',
        'ip_publica'
      ]
      const rows = eventosConUsuario.map((ev: any) => headers.map(h => {
        let v
        switch (h) {
          case 'usuario_username':
            v = ev.usuario?.username ?? ''
            break
          case 'usuario_nombre':
            v = ev.usuario?.persona?.nombreCompleto ?? ''
            break
          default:
            v = ev[h]
        }
        if (v === null || v === undefined) return ''
        // escape simple CSV
        const s = String(v).replace(/"/g, '""')
        return `"${s}"`
      }).join(','))
      const csv = [headers.join(','), ...rows].join('\n')
      return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bitacora_${Date.now()}.csv"` } })
    }

    return NextResponse.json({ total, page, perPage, eventos: eventosConUsuario })
  } catch (error) {
    console.error('[bitacora] error listando', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
