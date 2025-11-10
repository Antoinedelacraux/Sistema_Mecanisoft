import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'
import {
  ensureTrabajadorDisponible,
  generateTemporalPassword,
  hashPassword,
  normalizeUsername,
  resolveRolParaTrabajador,
  defaultUsuarioSelect
} from './helpers'
import { createUsuarioSchema } from '@/lib/usuarios/validators'

const buildFechaExpiracion = (horas: number) => {
  const fecha = new Date()
  fecha.setHours(fecha.getHours() + horas)
  return fecha
}

export async function createUsuario(payload: unknown, sessionUserId: number) {
  const data = createUsuarioSchema.parse(payload)

  const trabajador = await ensureTrabajadorDisponible(data.id_trabajador)

  const nombreUsuarioNormalizado = normalizeUsername(data.nombre_usuario)

  const existing = await prisma.usuario.findUnique({
    where: { nombre_usuario: nombreUsuarioNormalizado }
  })

  if (existing) {
    throw new ApiError(400, 'Ya existe un usuario con este nombre de usuario')
  }

  let rolId: number
  try {
    rolId = await resolveRolParaTrabajador({
      cargo: trabajador.cargo,
      rolPreferido: data.rol
    }, prisma)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible resolver el rol solicitado'
    throw new ApiError(400, message)
  }

  const temporal = data.password ?? generateTemporalPassword()
  const hashedTemporal = await hashPassword(temporal)
  const hashedPlaceholder = await hashPassword(generateTemporalPassword(16))

  const usuario = await prisma.$transaction(async (tx) => {
    const personaCorreo = data.correo?.trim() || trabajador.persona.correo || undefined

    if (personaCorreo && personaCorreo !== trabajador.persona.correo) {
      await tx.persona.update({
        where: { id_persona: trabajador.persona.id_persona },
        data: { correo: personaCorreo }
      })
    }

    const nuevoUsuario = await tx.usuario.create({
      data: {
        id_persona: trabajador.persona.id_persona,
        id_rol: rolId,
        nombre_usuario: nombreUsuarioNormalizado,
        password: hashedPlaceholder,
        password_temporal: hashedTemporal,
        password_temporal_expira: buildFechaExpiracion(data.password_expira_en_horas),
        requiere_cambio_password: true,
        estado: data.estado,
        estatus: true,
        envio_credenciales_pendiente: data.enviar_correo,
        ultimo_envio_credenciales: null,
        ultimo_error_envio: null
      },
      select: defaultUsuarioSelect
    })

    await tx.trabajador.update({
      where: { id_trabajador: trabajador.id_trabajador },
      data: { id_usuario: nuevoUsuario.id_usuario }
    })

    await tx.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: 'CREATE_USUARIO',
        descripcion: `Usuario creado para trabajador ${trabajador.persona.nombre} ${trabajador.persona.apellido_paterno}`,
        tabla: 'usuario'
      }
    })

    return nuevoUsuario
  })

  return {
    usuario,
    passwordTemporal: temporal
  }
}
