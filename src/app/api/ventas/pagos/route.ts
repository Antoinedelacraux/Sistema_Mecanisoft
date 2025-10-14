import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { MetodoPagoVenta } from '@prisma/client'
import { registrarPagoVenta } from '../controllers/registrar-pago'
import { FacturacionError } from '@/lib/facturacion/errors'

const bodySchema = z.object({
  id_comprobante: z.number().int().positive(),
  metodo: z.nativeEnum(MetodoPagoVenta),
  monto: z.number().positive().optional(),
  referencia: z.string().trim().max(120).optional(),
  fecha_pago: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true
      const parsed = new Date(value)
      return !Number.isNaN(parsed.getTime())
    }, 'Fecha de pago inválida')
    .optional(),
  notas: z.string().trim().max(500).optional(),
  id_venta_pago: z.number().int().positive().optional(),
  accion: z.enum(['crear', 'actualizar', 'eliminar']).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'ventas.conciliar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para conciliar ventas' }, { status: 403 })
      }
      throw error
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { id_comprobante, metodo, monto, referencia, fecha_pago, notas, id_venta_pago, accion } = parsed.data

    const resultado = await registrarPagoVenta(
      {
        id_comprobante,
        metodo,
        monto: monto ?? null,
        referencia: referencia ?? null,
        fecha_pago: fecha_pago ? new Date(fecha_pago) : null,
        notas: notas ?? null,
        id_venta_pago: id_venta_pago ?? null,
        accion: accion ?? undefined
      },
      Number(session.user.id),
      prisma
    )

    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    if (error instanceof FacturacionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 400 })
    }
    console.error('Error registrando pago de venta:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
