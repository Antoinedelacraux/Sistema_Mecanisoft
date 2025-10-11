import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getTrabajadorOrThrow, defaultTrabajadorInclude } from './detail-controller'
import { ApiError } from './errors'
import { resolveRolId } from './helpers'

const documentoPermitido = z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE'])

const updateSchema = z.object({
  nombre: z.string().optional(),
  apellido_paterno: z.string().optional(),
  apellido_materno: z.string().optional().nullable(),
  tipo_documento: documentoPermitido.optional(),
  numero_documento: z.string().optional(),
  fecha_nacimiento: z.union([z.string(), z.date()]).optional().nullable(),
  telefono: z.string().optional().nullable(),
  correo: z.string().email().optional().nullable(),
  direccion: z.string().optional().nullable(),
  cargo: z.string().optional(),
  especialidad: z.string().optional(),
  nivel_experiencia: z.string().optional(),
  tarifa_hora: z.union([z.number(), z.string()]).optional().nullable(),
  fecha_ingreso: z.union([z.string(), z.date()]).optional().nullable(),
  sueldo_mensual: z.union([z.number(), z.string()]).optional().nullable(),
  activo: z.boolean().optional(),
  crear_usuario: z.boolean().optional(),
  nombre_usuario: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  rol_usuario: z.string().optional().nullable(),
})

type UpdateInput = z.infer<typeof updateSchema>

const toDecimal = (value: UpdateInput['tarifa_hora']) => {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numberValue)) {
    throw new ApiError(400, 'Los campos numéricos deben tener formato válido')
  }
  return new Prisma.Decimal(numberValue)
}

const toDate = (value: UpdateInput['fecha_ingreso']) => {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'La fecha proporcionada no es válida')
  }
  return date
}

export async function updateTrabajador(id: number, payload: unknown, sessionUserId: number) {
  const data = updateSchema.parse(payload)

  const trabajadorActual = await getTrabajadorOrThrow(id)

  if (data.numero_documento && data.numero_documento !== trabajadorActual.persona.numero_documento) {
    const existingDoc = await prisma.persona.findUnique({ where: { numero_documento: data.numero_documento } })
    if (existingDoc) {
      throw new ApiError(400, 'Ya existe una persona registrada con este número de documento')
    }
  }

  if (data.nombre_usuario) {
    const nombreUsuario = data.nombre_usuario.trim()
    if (nombreUsuario !== trabajadorActual.usuario?.nombre_usuario) {
      const existingUser = await prisma.usuario.findUnique({ where: { nombre_usuario: nombreUsuario } })
      if (existingUser) {
        throw new ApiError(400, 'Ya existe un usuario con este nombre de usuario')
      }
    }
  }

  const trabajador = await prisma.$transaction(async (tx) => {
    await tx.persona.update({
      where: { id_persona: trabajadorActual.id_persona },
      data: {
        nombre: data.nombre ?? trabajadorActual.persona.nombre,
        apellido_paterno: data.apellido_paterno ?? trabajadorActual.persona.apellido_paterno,
        apellido_materno: data.apellido_materno ?? trabajadorActual.persona.apellido_materno,
        tipo_documento: data.tipo_documento ?? trabajadorActual.persona.tipo_documento,
        numero_documento: data.numero_documento ?? trabajadorActual.persona.numero_documento,
        telefono: data.telefono ?? trabajadorActual.persona.telefono,
        correo: data.correo ?? trabajadorActual.persona.correo,
        direccion: data.direccion ?? trabajadorActual.persona.direccion,
        fecha_nacimiento: data.fecha_nacimiento ? toDate(data.fecha_nacimiento) : trabajadorActual.persona.fecha_nacimiento
      }
    })

    let usuarioId = trabajadorActual.id_usuario

    if (data.crear_usuario && !trabajadorActual.id_usuario) {
      if (!data.nombre_usuario || !data.password) {
        throw new ApiError(400, 'Debes proporcionar nombre de usuario y contraseña para crear credenciales')
      }

      const rolId = await resolveRolId({ cargo: data.cargo ?? trabajadorActual.cargo, rolPreferido: data.rol_usuario }, tx)
      const hashedPassword = await bcrypt.hash(data.password, 10)

      const usuario = await tx.usuario.create({
        data: {
          id_persona: trabajadorActual.id_persona,
          id_rol: rolId,
          nombre_usuario: data.nombre_usuario,
          password: hashedPassword,
          estado: data.activo ?? trabajadorActual.activo,
          estatus: data.activo ?? trabajadorActual.activo
        }
      })

      usuarioId = usuario.id_usuario
    }

    if (usuarioId) {
      const updates: Prisma.UsuarioUpdateInput = {}

      if (data.nombre_usuario && data.nombre_usuario !== trabajadorActual.usuario?.nombre_usuario) {
        updates.nombre_usuario = data.nombre_usuario
      }

      if (data.password) {
        updates.password = await bcrypt.hash(data.password, 10)
      }

      if (data.rol_usuario || data.cargo) {
        const rolId = await resolveRolId({ cargo: data.cargo ?? trabajadorActual.cargo, rolPreferido: data.rol_usuario }, tx)
        updates.rol = {
          connect: { id_rol: rolId }
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx.usuario.update({
          where: { id_usuario: usuarioId },
          data: updates
        })
      }
    }

    return tx.trabajador.update({
      where: { id_trabajador: id },
      data: {
        cargo: data.cargo ?? trabajadorActual.cargo,
        especialidad: data.especialidad ?? trabajadorActual.especialidad,
        nivel_experiencia: data.nivel_experiencia ?? trabajadorActual.nivel_experiencia,
        tarifa_hora: toDecimal(data.tarifa_hora) ?? trabajadorActual.tarifa_hora,
        fecha_ingreso: toDate(data.fecha_ingreso) ?? trabajadorActual.fecha_ingreso,
        sueldo_mensual: toDecimal(data.sueldo_mensual) ?? trabajadorActual.sueldo_mensual,
        activo: data.activo ?? trabajadorActual.activo,
        id_usuario: usuarioId ?? undefined
      },
      include: defaultTrabajadorInclude
    })
  })

  await prisma.bitacora.create({
    data: {
      id_usuario: sessionUserId,
      accion: 'UPDATE_TRABAJADOR',
      descripcion: `Trabajador actualizado: ${trabajador.codigo_empleado}`,
      tabla: 'trabajador'
    }
  })

  return trabajador
}
