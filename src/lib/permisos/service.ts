import { PrismaClient, Permiso } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/prisma'
import type { ModuloPermisosDTO, PermisoCatalogoDTO } from '@/types/permisos'

const LISTAR_PERMISOS_TTL_MS = 5 * 60 * 1000

let permisosPorModuloCache: { data: ModuloPermisosDTO[]; expiresAt: number } | null = null

type CatalogoFiltro = {
  incluirInactivos?: boolean
}

export type PermisoCatalogo = Permiso & {
  modulo_nombre?: string | null
  modulo_descripcion?: string | null
}

export type PermisoRol = {
  id_permiso: number
  codigo: string
  nombre: string
  descripcion: string | null
  modulo: string
  agrupador: string | null
  concedido: true
  asignadoPorId: number | null
  nota: string | null
  asignadoEn: Date
}

export async function listarPermisosPorModulo(
  prismaClient?: PrismaClient
): Promise<ModuloPermisosDTO[]> {
  if (!prismaClient && permisosPorModuloCache && permisosPorModuloCache.expiresAt > Date.now()) {
    return permisosPorModuloCache.data
  }

  const client = getClient(prismaClient)

  const modulos = await client.modulo.findMany({
    where: { activo: true },
    orderBy: [{ nombre: 'asc' }],
    include: {
      permisos: {
        where: { activo: true },
        orderBy: [{ codigo: 'asc' }]
      }
    }
  })

  const resultado = modulos.map((modulo) => ({
    clave: modulo.clave,
    nombre: modulo.nombre,
    descripcion: modulo.descripcion,
    permisos: modulo.permisos.map<PermisoCatalogoDTO>((permiso) => ({
      id_permiso: permiso.id_permiso,
      codigo: permiso.codigo,
      nombre: permiso.nombre,
      descripcion: permiso.descripcion,
      modulo: permiso.modulo,
      agrupador: permiso.agrupador,
      activo: permiso.activo,
      creado_en: permiso.creado_en.toISOString(),
      actualizado_en: permiso.actualizado_en.toISOString(),
      modulo_nombre: modulo.nombre,
      modulo_descripcion: modulo.descripcion
    }))
  }))

  if (!prismaClient) {
    permisosPorModuloCache = {
      data: resultado.map((modulo) => ({
        ...modulo,
        permisos: modulo.permisos.map((permiso) => ({ ...permiso }))
      })),
      expiresAt: Date.now() + LISTAR_PERMISOS_TTL_MS
    }
  }

  return resultado
}

export type PermisoPersonalizado = {
  codigo: string
  concedido: boolean
  origen: string
  comentario: string | null
  permiso: Permiso
}

export type PermisoResuelto = {
  codigo: string
  concedido: boolean
  fuente: 'ROL' | 'EXTRA' | 'REVOCADO'
  permiso: Permiso
  origenPersonalizacion?: string
  comentarioPersonalizacion?: string | null
}

type SetPermisosRolInput = {
  idRol: number
  codigosPermisos: string[]
  usuarioActorId: number
  descripcion?: string
  prismaClient?: PrismaClient
}

type SetPermisosUsuarioInput = {
  idUsuario: number
  personalizaciones: Array<{
    codigo: string
    concedido: boolean
    origen: string
    comentario?: string | null
  }>
  usuarioActorId: number
  descripcion?: string
  prismaClient?: PrismaClient
}

type SincronizarPermisosUsuarioInput = {
  idUsuario: number
  usuarioActorId: number
  conservarPersonalizaciones?: boolean
  prismaClient?: PrismaClient
}

function getClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? defaultPrisma
}

export class PermisoNoEncontradoError extends Error {
  readonly codigos: string[]

  constructor(codigos: string[]) {
    super(`Permisos no encontrados: ${codigos.join(', ')}`)
    this.name = 'PermisoNoEncontradoError'
    this.codigos = codigos
  }
}

export function clearPermisosPorModuloCache(): void {
  permisosPorModuloCache = null
}

function assertPermisosEncontrados(codigosSolicitados: string[], permisos: Permiso[]) {
  const encontrados = new Set(permisos.map((permiso) => permiso.codigo))
  const faltantes = codigosSolicitados.filter((codigo) => !encontrados.has(codigo))

  if (faltantes.length) {
    throw new PermisoNoEncontradoError(faltantes)
  }
}

export async function listarCatalogoPermisos(
  filtros: CatalogoFiltro = {},
  prismaClient?: PrismaClient
): Promise<PermisoCatalogo[]> {
  const client = getClient(prismaClient)

  return client.permiso.findMany({
    where: filtros.incluirInactivos ? undefined : { activo: true },
    include: { moduloEntidad: true },
    orderBy: [{ modulo: 'asc' }, { codigo: 'asc' }]
  }).then((permisos) =>
    permisos.map((permiso) => {
      const { moduloEntidad, ...rest } = permiso
      return {
        ...rest,
        modulo_nombre: moduloEntidad?.nombre ?? null,
        modulo_descripcion: moduloEntidad?.descripcion ?? null
      }
    })
  )
}

export async function obtenerPermisosDeRol(
  idRol: number,
  prismaClient?: PrismaClient
): Promise<PermisoRol[]> {
  const client = getClient(prismaClient)

  const permisos = await client.rolPermiso.findMany({
    where: { id_rol: idRol },
    include: { permiso: true },
    orderBy: { permiso: { codigo: 'asc' } }
  })

  return permisos.map(({ permiso, descripcion, asignado_por, creado_en }) => ({
    id_permiso: permiso.id_permiso,
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    descripcion: permiso.descripcion,
    modulo: permiso.modulo,
    agrupador: permiso.agrupador,
    concedido: true,
    asignadoPorId: asignado_por ?? null,
    nota: descripcion ?? null,
    asignadoEn: creado_en
  }))
}

export async function setPermisosDeRol({
  idRol,
  codigosPermisos,
  usuarioActorId,
  descripcion,
  prismaClient
}: SetPermisosRolInput): Promise<PermisoRol[]> {
  const client = getClient(prismaClient)
  const codigosUnicos = Array.from(new Set(codigosPermisos))

  const permisosSeleccionados = codigosUnicos.length
    ? await client.permiso.findMany({
        where: { codigo: { in: codigosUnicos } }
      })
    : []

  assertPermisosEncontrados(codigosUnicos, permisosSeleccionados)

  const idsSeleccionados = permisosSeleccionados.map((permiso) => permiso.id_permiso)

  await client.$transaction(async (tx) => {
    if (idsSeleccionados.length) {
      await tx.rolPermiso.deleteMany({
        where: {
          id_rol: idRol,
          id_permiso: { notIn: idsSeleccionados }
        }
      })

      if (idsSeleccionados.length) {
        await tx.rolPermiso.createMany({
          data: idsSeleccionados.map((id_permiso) => ({
            id_rol: idRol,
            id_permiso,
            asignado_por: usuarioActorId,
            descripcion: descripcion ?? null
          })),
          skipDuplicates: true
        })

        await tx.rolPermiso.updateMany({
          where: {
            id_rol: idRol,
            id_permiso: { in: idsSeleccionados }
          },
          data: {
            asignado_por: usuarioActorId,
            ...(descripcion ? { descripcion } : {})
          }
        })
      }
    } else {
      await tx.rolPermiso.deleteMany({ where: { id_rol: idRol } })
    }

    await tx.bitacora.create({
      data: {
        id_usuario: usuarioActorId,
        accion: 'ROL_PERMISOS_ACTUALIZADO',
        descripcion: descripcion ?? `Actualización de permisos para el rol ${idRol}`,
        tabla: 'rol_permiso'
      }
    })
  })

  return obtenerPermisosDeRol(idRol, client)
}

export async function obtenerPermisosPersonalizadosDeUsuario(
  idUsuario: number,
  prismaClient?: PrismaClient
): Promise<PermisoPersonalizado[]> {
  const client = getClient(prismaClient)

  const personalizaciones = await client.usuarioPermiso.findMany({
    where: { id_usuario: idUsuario },
    include: { permiso: true },
    orderBy: { permiso: { codigo: 'asc' } }
  })

  return personalizaciones.map((personalizacion) => ({
    codigo: personalizacion.permiso.codigo,
    concedido: personalizacion.concedido,
    origen: personalizacion.origen,
    comentario: personalizacion.comentario,
    permiso: personalizacion.permiso
  }))
}

export async function obtenerPermisosResueltosDeUsuario(
  idUsuario: number,
  prismaClient?: PrismaClient
): Promise<PermisoResuelto[]> {
  const client = getClient(prismaClient)

  const usuario = await client.usuario.findUnique({
    where: { id_usuario: idUsuario },
    select: {
      id_usuario: true,
      id_rol: true,
      permisos: {
        include: { permiso: true }
      }
    }
  })

  if (!usuario) {
    return []
  }

  const permisosRol = await client.rolPermiso.findMany({
    where: { id_rol: usuario.id_rol },
    include: { permiso: true }
  })

  const resultado = new Map<string, PermisoResuelto>()

  for (const registro of permisosRol) {
    resultado.set(registro.permiso.codigo, {
      codigo: registro.permiso.codigo,
      concedido: true,
      fuente: 'ROL',
      permiso: registro.permiso
    })
  }

  for (const personalizacion of usuario.permisos) {
    const codigo = personalizacion.permiso.codigo
    if (!personalizacion.concedido) {
      resultado.set(codigo, {
        codigo,
        concedido: false,
        fuente: 'REVOCADO',
        permiso: personalizacion.permiso,
        origenPersonalizacion: personalizacion.origen,
        comentarioPersonalizacion: personalizacion.comentario
      })
      continue
    }

    resultado.set(codigo, {
      codigo,
      concedido: true,
      fuente: 'EXTRA',
      permiso: personalizacion.permiso,
      origenPersonalizacion: personalizacion.origen,
      comentarioPersonalizacion: personalizacion.comentario
    })
  }

  return Array.from(resultado.values()).sort((a, b) => a.codigo.localeCompare(b.codigo))
}

export async function setPermisosPersonalizadosDeUsuario({
  idUsuario,
  personalizaciones,
  usuarioActorId,
  descripcion,
  prismaClient
}: SetPermisosUsuarioInput): Promise<PermisoPersonalizado[]> {
  const client = getClient(prismaClient)
  const codigosUnicos = Array.from(new Set(personalizaciones.map((item) => item.codigo)))

  const permisosCatalogo = codigosUnicos.length
    ? await client.permiso.findMany({
        where: { codigo: { in: codigosUnicos } }
      })
    : []

  assertPermisosEncontrados(codigosUnicos, permisosCatalogo)

  const permisosPorCodigo = new Map(permisosCatalogo.map((permiso) => [permiso.codigo, permiso]))

  await client.$transaction(async (tx) => {
    if (permisosCatalogo.length) {
      const idsPermitidos = permisosCatalogo.map((permiso) => permiso.id_permiso)

      await tx.usuarioPermiso.deleteMany({
        where: {
          id_usuario: idUsuario,
          id_permiso: { notIn: idsPermitidos }
        }
      })

      for (const personalizacion of personalizaciones) {
        const permiso = permisosPorCodigo.get(personalizacion.codigo)!
        await tx.usuarioPermiso.upsert({
          where: {
            id_usuario_id_permiso: {
              id_usuario: idUsuario,
              id_permiso: permiso.id_permiso
            }
          },
          update: {
            concedido: personalizacion.concedido,
            origen: personalizacion.origen,
            comentario: personalizacion.comentario ?? null
          },
          create: {
            id_usuario: idUsuario,
            id_permiso: permiso.id_permiso,
            concedido: personalizacion.concedido,
            origen: personalizacion.origen,
            comentario: personalizacion.comentario ?? null
          }
        })
      }
    } else {
      await tx.usuarioPermiso.deleteMany({ where: { id_usuario: idUsuario } })
    }

    await tx.bitacora.create({
      data: {
        id_usuario: usuarioActorId,
        accion: 'USUARIO_PERMISOS_ACTUALIZADO',
        descripcion:
          descripcion ?? `Personalización de permisos para el usuario ${idUsuario}`,
        tabla: 'usuario_permiso'
      }
    })
  })

  return personalizaciones.map((personalizacion) => {
    const permiso = permisosPorCodigo.get(personalizacion.codigo)!
    return {
      codigo: permiso.codigo,
      concedido: personalizacion.concedido,
      origen: personalizacion.origen,
      comentario: personalizacion.comentario ?? null,
      permiso
    }
  })
}

export async function sincronizarPermisosUsuarioConRol({
  idUsuario,
  usuarioActorId,
  conservarPersonalizaciones = true,
  prismaClient
}: SincronizarPermisosUsuarioInput): Promise<{ totalBase: number }> {
  const client = getClient(prismaClient)

  return client.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { id_usuario: idUsuario },
      select: { id_usuario: true, id_rol: true }
    })

    if (!usuario) {
      throw new Error(`Usuario ${idUsuario} no encontrado`)
    }

    const base = await tx.rolPermiso.findMany({
      where: { id_rol: usuario.id_rol }
    })
    const baseIds = new Set(base.map((item) => item.id_permiso))

    if (!conservarPersonalizaciones) {
      await tx.usuarioPermiso.deleteMany({ where: { id_usuario: idUsuario } })
    } else {
      if (baseIds.size === 0) {
        await tx.usuarioPermiso.deleteMany({
          where: {
            id_usuario: idUsuario,
            concedido: false
          }
        })
      } else {
        await tx.usuarioPermiso.deleteMany({
          where: {
            id_usuario: idUsuario,
            concedido: false,
            id_permiso: { notIn: Array.from(baseIds) }
          }
        })
      }
    }

    await tx.bitacora.create({
      data: {
        id_usuario: usuarioActorId,
        accion: 'USUARIO_PERMISOS_SINCRONIZADO',
        descripcion: `Sincronización de permisos base para el usuario ${idUsuario}`,
        tabla: 'usuario_permiso'
      }
    })

    return { totalBase: base.length }
  })
}

export async function verificarPermiso({
  idUsuario,
  codigoPermiso,
  prismaClient
}: {
  idUsuario: number
  codigoPermiso: string
  prismaClient?: PrismaClient
}): Promise<boolean> {
  const client = getClient(prismaClient)

  const permiso = await client.permiso.findUnique({
    where: { codigo: codigoPermiso },
    select: { id_permiso: true }
  })

  if (!permiso) {
    return false
  }

  const override = await client.usuarioPermiso.findUnique({
    where: {
      id_usuario_id_permiso: {
        id_usuario: idUsuario,
        id_permiso: permiso.id_permiso
      }
    },
    select: { concedido: true }
  })

  if (override) {
    return override.concedido
  }

  const usuario = await client.usuario.findUnique({
    where: { id_usuario: idUsuario },
    select: { id_rol: true }
  })

  if (!usuario) {
    return false
  }

  const rolPermiso = await client.rolPermiso.findUnique({
    where: {
      id_rol_id_permiso: {
        id_rol: usuario.id_rol,
        id_permiso: permiso.id_permiso
      }
    },
    select: { id_permiso: true }
  })

  return Boolean(rolPermiso)
}
