import type { Session } from 'next-auth'
import type { PrismaClient } from '@prisma/client'

import {
  obtenerPermisosResueltosDeUsuario,
  verificarPermiso
} from '@/lib/permisos/service'

export class SesionInvalidaError extends Error {
  constructor(mensaje = 'Sesión inválida o usuario no autenticado') {
    super(mensaje)
    this.name = 'SesionInvalidaError'
  }
}

export class PermisoDenegadoError extends Error {
  readonly codigoPermiso: string

  constructor(codigoPermiso: string, mensaje?: string) {
    super(mensaje ?? `No cuentas con el permiso requerido: ${codigoPermiso}`)
    this.name = 'PermisoDenegadoError'
    this.codigoPermiso = codigoPermiso
  }
}

type CheckerConfig = {
  session: Session | null
  prismaClient?: PrismaClient
  preload?: string[]
}

export class PermisosChecker {
  private readonly usuarioId: number
  private readonly prisma?: PrismaClient
  private readonly cache = new Map<string, boolean>()

  constructor(usuarioId: number, opts: { prismaClient?: PrismaClient; preload?: string[] } = {}) {
    this.usuarioId = usuarioId
    this.prisma = opts.prismaClient

    if (Array.isArray(opts.preload) && opts.preload.length > 0) {
      for (const codigo of opts.preload) {
        this.cache.set(codigo, true)
      }
    }
  }

  private get prismaClient(): PrismaClient | undefined {
    return this.prisma
  }

  async has(codigoPermiso: string): Promise<boolean> {
    if (this.cache.has(codigoPermiso)) {
      return this.cache.get(codigoPermiso) ?? false
    }

    const concedido = await verificarPermiso({
      idUsuario: this.usuarioId,
      codigoPermiso,
      prismaClient: this.prismaClient
    })

    this.cache.set(codigoPermiso, concedido)
    return concedido
  }

  async require(codigoPermiso: string, mensaje?: string): Promise<void> {
    const concedido = await this.has(codigoPermiso)
    if (!concedido) {
      throw new PermisoDenegadoError(codigoPermiso, mensaje)
    }
  }

  async listarPermisosResueltos(): Promise<string[]> {
    const resueltos = await obtenerPermisosResueltosDeUsuario(this.usuarioId, this.prismaClient)
    const concedidos = resueltos.filter((permiso) => permiso.concedido).map((permiso) => permiso.codigo)

    for (const codigo of concedidos) {
      this.cache.set(codigo, true)
    }

    return concedidos
  }
}

export async function crearPermisosChecker({ session, prismaClient, preload }: CheckerConfig): Promise<PermisosChecker> {
  if (!session?.user?.id) {
    throw new SesionInvalidaError()
  }

  const usuarioId = Number.parseInt(session.user.id, 10)
  if (!Number.isFinite(usuarioId)) {
    throw new SesionInvalidaError('Identificador de usuario inválido en la sesión')
  }

  const permisosPreCargados = Array.isArray(preload)
    ? preload
    : Array.isArray(session.user.permisos)
      ? session.user.permisos
      : []

  return new PermisosChecker(usuarioId, {
    prismaClient,
    preload: permisosPreCargados
  })
}

export async function asegurarPermiso(
  session: Session | null,
  codigoPermiso: string,
  opts: { prismaClient?: PrismaClient; mensaje?: string } = {}
): Promise<PermisosChecker> {
  const checker = await crearPermisosChecker({ session, prismaClient: opts.prismaClient })
  await checker.require(codigoPermiso, opts.mensaje)
  return checker
}

export function sessionTienePermiso(session: Session | null, codigoPermiso: string): boolean {
  if (!session?.user?.permisos) {
    return false
  }
  return session.user.permisos.includes(codigoPermiso)
}
