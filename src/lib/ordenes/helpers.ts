import type { PrismaClient } from '@prisma/client'

export const unidadFactor: Record<string, number> = {
  minutos: 1,
  horas: 60,
  dias: 60 * 24,
  semanas: 60 * 24 * 7
}

export function convertirATotalMinutos(valor: number, unidad: string) {
  const factor = unidadFactor[unidad as keyof typeof unidadFactor] ?? 1
  return Math.round(valor * factor)
}

export async function calcularProgresoOrden(prisma: PrismaClient, id_transaccion: number) {
  try {
    const detalles = await prisma.detalleTransaccion.findMany({
      where: { id_transaccion },
      include: { tareas: true }
    })
    const totalTareas = detalles.reduce((acc, d) => acc + d.tareas.length, 0)
    if (totalTareas === 0) {
      return { total: 0, pendientes: 0, en_proceso: 0, completadas: 0, verificadas: 0, porcentaje: 0 }
    }

    let pendientes = 0
    let en_proceso = 0
    let completadas = 0
    let verificadas = 0

    for (const d of detalles) {
      for (const t of d.tareas) {
        switch (t.estado) {
          case 'pendiente':
            pendientes++
            break
          case 'en_proceso':
            en_proceso++
            break
          case 'completado':
            completadas++
            break
          case 'verificado':
            verificadas++
            break
        }
      }
    }

    const porcentaje = Math.round(((completadas + verificadas) / totalTareas) * 100)
    return { total: totalTareas, pendientes, en_proceso, completadas, verificadas, porcentaje }
  } catch (e) {
    console.warn('No se pudo calcular progreso', e)
    return { total: 0, pendientes: 0, en_proceso: 0, completadas: 0, verificadas: 0, porcentaje: 0 }
  }
}

export async function generateCodigoOrden(prisma: PrismaClient) {
  const year = new Date().getFullYear()
  const lastOrder = await prisma.transaccion.findFirst({
    where: {
      tipo_transaccion: 'orden',
      codigo_transaccion: { startsWith: `ORD-${year}-` }
    },
    select: { codigo_transaccion: true },
    orderBy: { id_transaccion: 'desc' }
  })
  const nextNumber = lastOrder ? parseInt(lastOrder.codigo_transaccion.split('-')[2]) + 1 : 1
  return `ORD-${year}-${nextNumber.toString().padStart(3, '0')}`
}

export function toInt(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  const n = typeof val === 'string' ? parseInt(val, 10) : (val as number)
  return Number.isFinite(n) ? n : undefined
}

export function isUniqueConstraintError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in (e as { code?: string }) && (e as { code?: string }).code === 'P2002'
}
