import { PrismaClient, Prisma } from '@prisma/client'

import { prisma as defaultPrisma } from '@/lib/prisma'
import {
  obtenerPermisosDeRol,
  setPermisosDeRol,
  listarPermisosPorModulo
} from '@/lib/permisos/service'
import type {
  AssignPermissionsInput,
  CreateRoleInput,
  ListRolesOptions,
  RoleDetail,
  RoleListItem,
  UpdateRoleInput
} from '@/lib/roles/types'
import type { ModuloPermisosDTO, PermisoRolDTO } from '@/types/permisos'

const getClient = (prismaClient?: PrismaClient) => prismaClient ?? defaultPrisma

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

export async function listRoles(
  options: ListRolesOptions,
  prismaClient?: PrismaClient
): Promise<RoleListItem[]> {
  const client = getClient(prismaClient)
  const { search, includeInactive = false, includeStats = false } = options

  const where: Prisma.RolWhereInput = {}

  if (!includeInactive) {
    where.estatus = true
  }

  if (search) {
    where.OR = [
      { nombre_rol: { contains: search, mode: 'insensitive' } },
      { descripcion: { contains: search, mode: 'insensitive' } }
    ]
  }

  const roles = await client.rol.findMany({
    where,
    orderBy: { nombre_rol: 'asc' },
    include: includeStats
      ? {
          _count: {
            select: {
              usuarios: true,
              permisos: true
            }
          }
        }
      : undefined
  })

  return roles.map((rol) => {
    const { _count, ...rest } = rol as typeof rol & { _count?: { usuarios: number; permisos: number } }

    return {
      ...rest,
      totalPermisos: includeStats ? _count?.permisos ?? 0 : undefined,
      totalUsuarios: includeStats ? _count?.usuarios ?? 0 : undefined
    }
  })
}

export async function getRoleDetail(
  idRol: number,
  prismaClient?: PrismaClient
): Promise<RoleDetail | null> {
  const client = getClient(prismaClient)

  const rol = await client.rol.findUnique({
    where: { id_rol: idRol },
    include: {
      _count: {
        select: { usuarios: true }
      }
    }
  })

  if (!rol) {
    return null
  }

  const permisos = await obtenerPermisosDeRol(idRol, client)

  const { _count, ...rest } = rol

  return {
    rol: rest,
    permisos,
    totalUsuarios: _count.usuarios
  }
}

export async function createRole(
  input: CreateRoleInput,
  actorId: number,
  prismaClient?: PrismaClient
): Promise<RoleDetail> {
  const client = getClient(prismaClient)

  try {
    const rolCreado = await client.$transaction(async (tx) => {
      const rol = await tx.rol.create({
        data: {
          nombre_rol: input.nombre,
          descripcion: input.descripcion ?? null,
          estatus: input.activo ?? true
        }
      })

      await tx.bitacora.create({
        data: {
          id_usuario: actorId,
          accion: 'CREATE_ROLE',
          descripcion: `Rol creado: ${rol.nombre_rol}`,
          tabla: 'rol'
        }
      })

      return rol
    })

    const detalle = await getRoleDetail(rolCreado.id_rol, client)
    if (!detalle) {
      throw new Error('No se pudo recuperar el rol recién creado')
    }
    return detalle
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error('Ya existe un rol con ese nombre')
    }
    throw error
  }
}

export async function updateRole(
  idRol: number,
  input: UpdateRoleInput,
  actorId: number,
  prismaClient?: PrismaClient
): Promise<RoleDetail> {
  const client = getClient(prismaClient)

  try {
    const rolActualizado = await client.$transaction(async (tx) => {
      const rolExistente = await tx.rol.findUnique({ where: { id_rol: idRol } })
      if (!rolExistente) {
        throw new Error('Rol no encontrado')
      }

      const data: Prisma.RolUpdateInput = {}

      if (typeof input.nombre === 'string') {
        data.nombre_rol = input.nombre
      }

      if (input.descripcion !== undefined) {
        data.descripcion = input.descripcion
      }

      if (typeof input.activo === 'boolean') {
        data.estatus = input.activo
      }

      const rol = await tx.rol.update({
        where: { id_rol: idRol },
        data
      })

      await tx.bitacora.create({
        data: {
          id_usuario: actorId,
          accion: 'UPDATE_ROLE',
          descripcion: `Rol actualizado: ${rol.nombre_rol}`,
          tabla: 'rol'
        }
      })

      return rol
    })

    const detalle = await getRoleDetail(rolActualizado.id_rol, client)
    if (!detalle) {
      throw new Error('No se pudo recuperar el rol actualizado')
    }
    return detalle
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error('Ya existe un rol con ese nombre')
    }
    throw error
  }
}

export async function disableRole(
  idRol: number,
  actorId: number,
  prismaClient?: PrismaClient
): Promise<RoleDetail> {
  const client = getClient(prismaClient)

  const rolActualizado = await client.$transaction(async (tx) => {
    const rol = await tx.rol.update({
      where: { id_rol: idRol },
      data: { estatus: false }
    })

    await tx.bitacora.create({
      data: {
        id_usuario: actorId,
        accion: 'DELETE_ROLE',
        descripcion: `Rol deshabilitado: ${rol.nombre_rol}`,
        tabla: 'rol'
      }
    })

    return rol
  })

  const detalle = await getRoleDetail(rolActualizado.id_rol, client)
  if (!detalle) {
    throw new Error('No se pudo recuperar el rol deshabilitado')
  }
  return detalle
}

export async function assignPermissionsToRole(
  idRol: number,
  input: AssignPermissionsInput,
  actorId: number,
  prismaClient?: PrismaClient
): Promise<PermisoRolDTO[]> {
  const client = getClient(prismaClient)

  const permisos = await setPermisosDeRol({
    idRol,
    codigosPermisos: input.permisos,
    usuarioActorId: actorId,
    descripcion: input.nota ?? undefined,
    prismaClient: client
  })

  return permisos.map((permiso) => ({
    id_permiso: permiso.id_permiso,
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    descripcion: permiso.descripcion,
    modulo: permiso.modulo,
    agrupador: permiso.agrupador,
    concedido: permiso.concedido,
    nota: permiso.nota,
    asignado_por_id: permiso.asignadoPorId,
    asignado_en: permiso.asignadoEn.toISOString()
  }))
}

export async function removePermissionFromRole(
  idRol: number,
  codigoPermiso: string,
  actorId: number,
  prismaClient?: PrismaClient
): Promise<void> {
  const client = getClient(prismaClient)

  await client.$transaction(async (tx) => {
    const permiso = await tx.permiso.findUnique({ where: { codigo: codigoPermiso } })
    if (!permiso) {
      throw new Error('Permiso no encontrado')
    }

    const rol = await tx.rol.findUnique({ where: { id_rol: idRol } })
    if (!rol) {
      throw new Error('Rol no encontrado')
    }

    try {
      await tx.rolPermiso.delete({
        where: {
          id_rol_id_permiso: {
            id_rol: idRol,
            id_permiso: permiso.id_permiso
          }
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('El rol no tenía asignado ese permiso')
      }
      throw error
    }

    await tx.bitacora.create({
      data: {
        id_usuario: actorId,
        accion: 'REVOKE_PERMISSION',
        descripcion: `Permiso ${codigoPermiso} revocado del rol ${rol.nombre_rol}`,
        tabla: 'rol_permiso'
      }
    })
  })
}

export async function listPermisosAgrupados(
  prismaClient?: PrismaClient
): Promise<ModuloPermisosDTO[]> {
  return listarPermisosPorModulo(prismaClient)
}
