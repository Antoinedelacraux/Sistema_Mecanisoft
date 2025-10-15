import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  asegurarPermiso,
  PermisoDenegadoError,
  SesionInvalidaError,
} from '@/lib/permisos/guards'
import { registrarProveedor, InventarioBasicoError } from '@/lib/inventario/basico'

const querySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const bodySchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio'),
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/u, 'El RUC debe tener 11 digitos'),
  contacto: z.string().trim().min(1).max(120).optional().nullable(),
  numero_contacto: z.string().trim().min(6).max(20).optional().nullable(),
  telefono: z.string().trim().min(6).max(20).optional().nullable(),
  correo: z.string().trim().email('Correo invalido').optional().nullable(),
  nombre_comercial: z.string().trim().min(1).max(150).optional().nullable(),
})

const proveedorInclude = {
  persona: {
    select: {
      nombre: true,
      apellido_paterno: true,
      apellido_materno: true,
      numero_documento: true,
      correo: true,
      telefono: true,
      nombre_comercial: true,
    },
  },
} as const

type ProveedorConPersona = Prisma.ProveedorGetPayload<{ include: typeof proveedorInclude }>

const buildWhere = (term?: string): Prisma.ProveedorWhereInput => {
  if (!term) return { estatus: true }

  const mode: Prisma.QueryMode = 'insensitive'

  return {
    estatus: true,
    OR: [
      { razon_social: { contains: term, mode } },
      {
        persona: {
          OR: [
            { nombre: { contains: term, mode } },
            { apellido_paterno: { contains: term, mode } },
            { apellido_materno: { contains: term, mode } },
            { nombre_comercial: { contains: term, mode } },
          ],
        },
      },
    ],
  }
}

export const GET = async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.ver', { prismaClient: prisma })

    const { searchParams } = request.nextUrl
    const params = querySchema.parse(Object.fromEntries(searchParams.entries()))

    const proveedores = await prisma.proveedor.findMany({
      where: buildWhere(params.q),
      include: proveedorInclude,
      orderBy: { razon_social: 'asc' },
      take: params.limit,
    })

    const data = proveedores.map((proveedor: ProveedorConPersona) => ({
      id_proveedor: proveedor.id_proveedor,
      razon_social: proveedor.razon_social,
      contacto: proveedor.contacto,
      numero_contacto: proveedor.numero_contacto,
      correo: proveedor.persona?.correo ?? null,
      telefono: proveedor.persona?.telefono ?? null,
      numero_documento: proveedor.persona?.numero_documento ?? null,
      nombre_comercial: proveedor.persona?.nombre_comercial ?? null,
    }))

    return NextResponse.json({ proveedores: data })
  } catch (error) {
    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[API] Error al listar proveedores simplificados', error)
    return NextResponse.json({ error: 'Error interno al listar proveedores' }, { status: 500 })
  }
}

export const POST = async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await asegurarPermiso(session, 'inventario.compras', { prismaClient: prisma })

    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isInteger(usuarioId)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const proveedor = await registrarProveedor({
      nombre: parsed.data.nombre,
      ruc: parsed.data.ruc,
      contacto: parsed.data.contacto,
      numero_contacto: parsed.data.numero_contacto,
      telefono: parsed.data.telefono,
      correo: parsed.data.correo,
      nombre_comercial: parsed.data.nombre_comercial,
      creado_por: usuarioId,
    })

    return NextResponse.json({ proveedor }, { status: 201 })
  } catch (error) {
    if (error instanceof InventarioBasicoError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    if (error instanceof PermisoDenegadoError) {
      return NextResponse.json({ error: error.message, code: error.codigoPermiso }, { status: 403 })
    }

    if (error instanceof SesionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: error.flatten() }, { status: 400 })
    }

    console.error('[API] Error al registrar proveedor simplificado', error)
    return NextResponse.json({ error: 'Error interno al registrar proveedor' }, { status: 500 })
  }
}
