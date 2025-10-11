import { Prisma } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { generateCodigoEmpleado, resolveRolId } from './helpers'
import { defaultTrabajadorInclude } from './detail-controller'
import { ApiError } from './errors'

const documentoPermitido = z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE'])

const createTrabajadorSchema = z.object({
  nombre: z.string().min(1),
  apellido_paterno: z.string().min(1),
  apellido_materno: z.string().optional().nullable(),
  tipo_documento: documentoPermitido,
  numero_documento: z.string().min(5),
  fecha_nacimiento: z.union([z.string(), z.date()]).optional().nullable(),
  telefono: z.string().optional().nullable(),
  correo: z.string().email().optional().nullable(),
  direccion: z.string().optional().nullable(),
  cargo: z.string().min(1),
  especialidad: z.string().min(1),
  nivel_experiencia: z.string().min(1),
  tarifa_hora: z.union([z.number(), z.string()]).optional().nullable(),
  fecha_ingreso: z.union([z.string(), z.date()]).optional().nullable(),
  sueldo_mensual: z.union([z.number(), z.string()]).optional().nullable(),
  crear_usuario: z.boolean().optional().default(false),
  nombre_usuario: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  rol_usuario: z.string().optional().nullable(),
})

type CreateTrabajadorInput = z.infer<typeof createTrabajadorSchema>

const toDecimal = (value: CreateTrabajadorInput['tarifa_hora']) => {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numberValue)) {
    throw new ApiError(400, 'Los campos numéricos deben tener formato válido')
  }
  return new Prisma.Decimal(numberValue)
}

const toDate = (value: CreateTrabajadorInput['fecha_ingreso']) => {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'La fecha proporcionada no es válida')
  }
  return date
}

export async function createTrabajador(payload: unknown, sessionUserId: number) {
  const data = createTrabajadorSchema.parse(payload)

  const documentoExistente = await prisma.persona.findUnique({
    where: { numero_documento: data.numero_documento }
  })

  if (documentoExistente) {
    throw new ApiError(400, 'Ya existe una persona registrada con este documento')
  }

  if (data.crear_usuario) {
    if (!data.nombre_usuario || !data.password) {
      throw new ApiError(400, 'Debes proporcionar nombre de usuario y contraseña para crear credenciales')
    }

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { nombre_usuario: data.nombre_usuario }
    })

    if (usuarioExistente) {
      throw new ApiError(400, 'Ya existe un usuario con este nombre de usuario')
    }
  }

  const trabajador = await prisma.$transaction(async (tx) => {
    const persona = await tx.persona.create({
      data: {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno ?? undefined,
        tipo_documento: data.tipo_documento,
        numero_documento: data.numero_documento,
        telefono: data.telefono ?? undefined,
        correo: data.correo ?? undefined,
        direccion: data.direccion ?? undefined,
        registrar_empresa: false,
        fecha_nacimiento: data.fecha_nacimiento ? toDate(data.fecha_nacimiento) : undefined
      }
    })

    let usuarioId: number | null = null

    if (data.crear_usuario) {
      const rolId = await resolveRolId({ cargo: data.cargo, rolPreferido: data.rol_usuario }, tx)
      const hashedPassword = await bcrypt.hash(data.password!, 10)

      const usuario = await tx.usuario.create({
        data: {
          id_persona: persona.id_persona,
          id_rol: rolId,
          nombre_usuario: data.nombre_usuario!,
          password: hashedPassword,
          estado: true,
          estatus: true
        }
      })

      usuarioId = usuario.id_usuario
    }

    const codigoEmpleado = await generateCodigoEmpleado(tx)

    return tx.trabajador.create({
      data: {
        id_persona: persona.id_persona,
        id_usuario: usuarioId ?? undefined,
        codigo_empleado: codigoEmpleado,
        cargo: data.cargo,
        especialidad: data.especialidad,
        nivel_experiencia: data.nivel_experiencia,
        tarifa_hora: toDecimal(data.tarifa_hora) ?? new Prisma.Decimal(0),
        fecha_ingreso: toDate(data.fecha_ingreso) ?? undefined,
        sueldo_mensual: toDecimal(data.sueldo_mensual),
        activo: true,
        eliminado: false
      },
      include: defaultTrabajadorInclude
    })
  })

  await prisma.bitacora.create({
    data: {
      id_usuario: sessionUserId,
      accion: 'CREATE_TRABAJADOR',
      descripcion: `Trabajador creado: ${trabajador.codigo_empleado} - ${data.nombre} ${data.apellido_paterno}`,
      tabla: 'trabajador'
    }
  })

  return trabajador
}
