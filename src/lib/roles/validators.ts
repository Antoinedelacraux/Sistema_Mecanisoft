import { z } from 'zod'

import type { AssignPermissionsInput, CreateRoleInput, ListRolesOptions, UpdateRoleInput } from '@/lib/roles/types'

const nombreSchema = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(80, 'El nombre no debe superar los 80 caracteres')

const descripcionSchema = z
  .string()
  .trim()
  .max(255, 'La descripción no debe superar los 255 caracteres')
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))

const booleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    return Boolean(value)
  })

const createRoleSchema = z.object({
  nombre: nombreSchema,
  descripcion: descripcionSchema,
  activo: booleanSchema.optional().default(true)
})

const updateRoleSchema = z
  .object({
    nombre: nombreSchema.optional(),
    descripcion: descripcionSchema,
    activo: booleanSchema.optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar'
  })

const assignPermissionsSchema = z.object({
  permisos: z
    .array(z.string().trim().min(1, 'Cada permiso debe tener al menos 1 carácter'))
    .max(200, 'No se pueden asignar más de 200 permisos en una sola operación'),
  nota: z
    .string()
    .trim()
    .max(300, 'La nota no debe superar los 300 caracteres')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
})

export function parseCreateRolePayload(payload: unknown): CreateRoleInput {
  const result = createRoleSchema.parse(payload)
  return {
    nombre: result.nombre,
    descripcion: result.descripcion ?? null,
    activo: result.activo
  }
}

export function parseUpdateRolePayload(payload: unknown): UpdateRoleInput {
  const result = updateRoleSchema.parse(payload)
  const output: UpdateRoleInput = {}

  if (typeof result.nombre === 'string') {
    output.nombre = result.nombre
  }

  if (result.descripcion !== undefined) {
    output.descripcion = result.descripcion
  }

  if (typeof result.activo === 'boolean') {
    output.activo = result.activo
  }

  return output
}

export function parseAssignPermissionsPayload(payload: unknown): AssignPermissionsInput {
  const result = assignPermissionsSchema.parse(payload)
  return {
    permisos: result.permisos,
    nota: result.nota ?? null
  }
}

export function parseListRolesQuery(searchParams: URLSearchParams): ListRolesOptions {
  const search = searchParams.get('search')?.trim() ?? undefined
  const includeInactiveRaw = searchParams.get('includeInactive')
  const includeStatsRaw = searchParams.get('includeStats')

  const includeInactive = includeInactiveRaw === null ? false : includeInactiveRaw === 'true' || includeInactiveRaw === '1'
  const includeStats = includeStatsRaw === null ? false : includeStatsRaw === 'true' || includeStatsRaw === '1'

  return {
    search: search && search.length > 0 ? search : undefined,
    includeInactive,
    includeStats
  }
}
