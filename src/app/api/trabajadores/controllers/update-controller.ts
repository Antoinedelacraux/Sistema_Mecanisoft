import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getTrabajadorOrThrow, defaultTrabajadorInclude } from './detail-controller'
import { ApiError } from './errors'
import { resolveRolId } from './helpers'
import { sendMail } from '@/lib/mailer'
import { DNI_REGEX, TELEFONO_REGEX, isAdult, parseDateInput } from './validation'

const documentoPermitido = z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE'])

const updateSchema = z.object({
  nombre: z.string().max(100).optional(),
  apellido_paterno: z.string().max(100).optional(),
  apellido_materno: z.string().max(100).optional().nullable(),
  tipo_documento: documentoPermitido.optional(),
  numero_documento: z.string().optional(),
  fecha_nacimiento: z.union([z.string(), z.date()]).optional().nullable(),
  telefono: z.string().optional().nullable(),
  correo: z.string().email().optional().nullable(),
  direccion: z.string().optional().nullable(),
  cargo: z.string().max(100).optional(),
  especialidad: z.string().max(100).optional(),
  nivel_experiencia: z.string().max(20).optional(),
  fecha_ingreso: z.union([z.string(), z.date()]).optional().nullable(),
  sueldo_mensual: z.union([z.number(), z.string()]).optional().nullable(),
  activo: z.boolean().optional(),
  crear_usuario: z.boolean().optional(),
  nombre_usuario: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  rol_usuario: z.string().optional().nullable(),
})

type UpdateInput = z.infer<typeof updateSchema>

const toDecimal = (value: UpdateInput['sueldo_mensual']) => {
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
  const telefono = data.telefono?.trim() || undefined
  if (telefono && !TELEFONO_REGEX.test(telefono)) {
    throw new ApiError(400, 'El número de celular debe tener exactamente 9 dígitos.')
  }

  const tipoDocumentoFinal = data.tipo_documento ?? trabajadorActual.persona.tipo_documento
  const numeroDocumentoActualizado = typeof data.numero_documento === 'string' ? data.numero_documento.trim() : undefined
  const numeroDocumentoFinal = numeroDocumentoActualizado && numeroDocumentoActualizado.length > 0
    ? numeroDocumentoActualizado
    : trabajadorActual.persona.numero_documento
  if (tipoDocumentoFinal === 'DNI' && numeroDocumentoFinal && !DNI_REGEX.test(numeroDocumentoFinal)) {
    throw new ApiError(400, 'El DNI debe tener exactamente 8 dígitos numéricos.')
  }

  const fechaNacimiento = data.fecha_nacimiento ? parseDateInput(data.fecha_nacimiento) : null
  if (data.fecha_nacimiento && !fechaNacimiento) {
    throw new ApiError(400, 'Debes proporcionar una fecha de nacimiento válida.')
  }
  if (fechaNacimiento && !isAdult(fechaNacimiento)) {
    throw new ApiError(400, 'Solo se pueden registrar trabajadores mayores de 18 años.')
  }

  let credencialesParaEnviar: { usuario: string; password: string } | null = null
  let usuarioDestinoId: number | null = trabajadorActual.id_usuario ?? null

  if (data.password) {
    const correoDestino = data.correo?.trim() || trabajadorActual.persona.correo?.trim()
    if (!correoDestino) {
      throw new ApiError(400, 'Debes registrar un correo electrónico para enviar las credenciales')
    }
  }

  if (numeroDocumentoActualizado && numeroDocumentoFinal !== trabajadorActual.persona.numero_documento) {
    const existingDoc = await prisma.persona.findUnique({ where: { numero_documento: numeroDocumentoFinal } })
    if (existingDoc) {
      const message = tipoDocumentoFinal === 'DNI'
        ? 'Ya existe una persona registrada con este DNI.'
        : 'Ya existe una persona registrada con este número de documento.'
      throw new ApiError(400, message)
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
        tipo_documento: tipoDocumentoFinal,
        numero_documento: numeroDocumentoFinal,
        telefono: telefono ?? trabajadorActual.persona.telefono,
        correo: data.correo ?? trabajadorActual.persona.correo,
        direccion: data.direccion ?? trabajadorActual.persona.direccion,
        fecha_nacimiento: fechaNacimiento ?? trabajadorActual.persona.fecha_nacimiento
      }
    })

    let usuarioId = trabajadorActual.id_usuario

    if (data.crear_usuario && !trabajadorActual.id_usuario) {
      if (!data.nombre_usuario || !data.password) {
        throw new ApiError(400, 'Debes proporcionar nombre de usuario y contraseña para crear credenciales')
      }

      const correoParaEnvio = data.correo?.trim() || trabajadorActual.persona.correo?.trim()
      if (!correoParaEnvio) {
        throw new ApiError(400, 'Debes registrar un correo electrónico para enviar las credenciales')
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
          estatus: data.activo ?? trabajadorActual.activo,
          requiere_cambio_password: true,
          envio_credenciales_pendiente: true
        }
      })

      usuarioId = usuario.id_usuario
      usuarioDestinoId = usuario.id_usuario
      credencialesParaEnviar = {
        usuario: data.nombre_usuario,
        password: data.password
      }
    }

    if (usuarioId) {
      const updates: Prisma.UsuarioUpdateInput = {}

      if (data.nombre_usuario && data.nombre_usuario !== trabajadorActual.usuario?.nombre_usuario) {
        updates.nombre_usuario = data.nombre_usuario
        if (!credencialesParaEnviar && data.password) {
          credencialesParaEnviar = {
            usuario: data.nombre_usuario,
            password: data.password
          }
        }
      }

      if (data.password) {
        updates.password = await bcrypt.hash(data.password, 10)
        updates.requiere_cambio_password = true
        updates.envio_credenciales_pendiente = true
        if (!credencialesParaEnviar) {
          const usuarioNombre = data.nombre_usuario ?? trabajadorActual.usuario?.nombre_usuario ?? trabajadorActual.persona.numero_documento
          credencialesParaEnviar = {
            usuario: usuarioNombre,
            password: data.password
          }
        }
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
        usuarioDestinoId = usuarioId
      }
    }

    return tx.trabajador.update({
      where: { id_trabajador: id },
      data: {
        cargo: data.cargo ?? trabajadorActual.cargo,
        especialidad: data.especialidad ?? trabajadorActual.especialidad,
        nivel_experiencia: data.nivel_experiencia ?? trabajadorActual.nivel_experiencia,
        fecha_ingreso: toDate(data.fecha_ingreso) ?? trabajadorActual.fecha_ingreso,
        sueldo_mensual: toDecimal(data.sueldo_mensual) ?? trabajadorActual.sueldo_mensual,
        activo: data.activo ?? trabajadorActual.activo,
        id_usuario: usuarioId ?? undefined
      },
      include: defaultTrabajadorInclude
    })
  })

  try {
    const { logEvent } = await import('@/lib/bitacora/log-event')
    await logEvent({ usuarioId: sessionUserId, accion: 'UPDATE_TRABAJADOR', descripcion: `Trabajador actualizado: ${trabajador.codigo_empleado}`, tabla: 'trabajador' })
  } catch (err) {
    console.error('[trabajadores] no se pudo registrar en bitácora:', err)
  }

  let credencialesEnviadas = false
  let credencialesError: string | null = null

  if (credencialesParaEnviar && usuarioDestinoId) {
    const { usuario: usuarioCredencial, password: passwordTemporal } = credencialesParaEnviar
    const correoDestino = trabajador.persona.correo ?? trabajador.usuario?.persona?.correo
    if (!correoDestino) {
      credencialesError = 'No hay un correo registrado para enviar las credenciales.'
    } else {
      try {
        await sendMail({
          to: correoDestino,
          subject: 'Actualización de credenciales del sistema',
          html: `
            <p>Hola ${trabajador.persona.nombre} ${trabajador.persona.apellido_paterno ?? ''},</p>
            <p>Se actualizaron tus credenciales de acceso al sistema del taller:</p>
            <ul>
              <li><strong>Usuario:</strong> ${usuarioCredencial}</li>
              <li><strong>Contraseña temporal:</strong> ${passwordTemporal}</li>
            </ul>
            <p>Al ingresar se te solicitará cambiar la contraseña.</p>
          `
        })

        credencialesEnviadas = true

        await prisma.usuario.update({
          where: { id_usuario: usuarioDestinoId },
          data: { envio_credenciales_pendiente: false }
        })

        if (trabajador.usuario && trabajador.usuario.id_usuario === usuarioDestinoId) {
          trabajador.usuario.envio_credenciales_pendiente = false
        }
      } catch (error) {
        console.error('[Trabajadores] Error enviando credenciales (update):', error)
        credencialesError = error instanceof Error ? error.message : 'No se pudieron enviar las credenciales actualizadas'
      }
    }
  }

  return {
    trabajador,
    credenciales: {
      enviadas: credencialesEnviadas,
      error: credencialesError
    }
  }
}
