import { prisma } from '@/lib/prisma'

type PrismaClientLike = typeof prisma

const getClient = (prismaClient?: PrismaClientLike) => prismaClient ?? prisma

export async function listarTemplates(prismaClient?: PrismaClientLike) {
  const client = getClient(prismaClient)
  return client.reportTemplate.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function crearTemplate(
  payload: { name: string; description?: string | null; key: string; defaultParams?: any; createdById: number },
  prismaClient?: PrismaClientLike
) {
  const client = getClient(prismaClient)
  return client.reportTemplate.create({
    data: {
      name: payload.name,
      description: payload.description ?? null,
      key: payload.key,
      defaultParams: payload.defaultParams ?? null,
      createdById: payload.createdById
    }
  })
}

export async function actualizarTemplate(
  id: number,
  payload: { name?: string; description?: string | null; defaultParams?: any },
  prismaClient?: PrismaClientLike
) {
  const client = getClient(prismaClient)
  const data: Record<string, unknown> = {}
  if (payload.name !== undefined) data.name = payload.name
  if (payload.description !== undefined) data.description = payload.description
  if (payload.defaultParams !== undefined) data.defaultParams = payload.defaultParams

  return client.reportTemplate.update({
    where: { id },
    data
  })
}

export async function eliminarTemplate(id: number, prismaClient?: PrismaClientLike) {
  const client = getClient(prismaClient)
  await client.reportTemplate.delete({ where: { id } })
  return true
}

export async function listarSchedules(prismaClient?: PrismaClientLike) {
  const client = getClient(prismaClient)
  return client.reportSchedule.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { id: true, name: true, key: true } }
    }
  })
}

export async function crearSchedule(
  payload: { templateId: number; name: string; cron: string; recipients: string; params?: any; createdById: number },
  prismaClient?: PrismaClientLike
) {
  const client = getClient(prismaClient)
  return client.reportSchedule.create({
    data: {
      templateId: payload.templateId,
      name: payload.name,
      cron: payload.cron,
      recipients: payload.recipients,
      params: payload.params ?? null,
      createdById: payload.createdById
    }
  })
}

export async function actualizarSchedule(
  id: number,
  payload: { name?: string; cron?: string; recipients?: string; params?: any; active?: boolean },
  prismaClient?: PrismaClientLike
) {
  const client = getClient(prismaClient)
  const data: Record<string, unknown> = {}
  if (payload.name !== undefined) data.name = payload.name
  if (payload.cron !== undefined) data.cron = payload.cron
  if (payload.recipients !== undefined) data.recipients = payload.recipients
  if (payload.params !== undefined) data.params = payload.params
  if (payload.active !== undefined) data.active = payload.active

  return client.reportSchedule.update({
    where: { id },
    data
  })
}

export async function eliminarSchedule(id: number, prismaClient?: PrismaClientLike) {
  const client = getClient(prismaClient)
  await client.reportSchedule.delete({ where: { id } })
  return true
}

export default {
  listarTemplates,
  crearTemplate,
  actualizarTemplate,
  eliminarTemplate,
  listarSchedules,
  crearSchedule,
  actualizarSchedule,
  eliminarSchedule,
}
