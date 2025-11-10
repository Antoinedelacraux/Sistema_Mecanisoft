import { z } from 'zod'

export const createUsuarioSchema = z.object({
  id_trabajador: z.number().int().positive(),
  nombre_usuario: z.string().min(4),
  correo: z.string().email().optional().nullable(),
  rol: z.string().optional().nullable(),
  estado: z.boolean().optional().default(true),
  enviar_correo: z.boolean().optional().default(true),
  password: z.string().min(8).optional().nullable(),
  confirmar_password: z.string().min(8).optional().nullable(),
  password_expira_en_horas: z.number().int().min(1).max(336).optional().default(72)
}).refine((data) => {
  if (data.password || data.confirmar_password) {
    return data.password === data.confirmar_password
  }
  return true
}, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar_password']
})

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>

export const updateUsuarioSchema = z.object({
  nombre_usuario: z.string().min(4).optional(),
  correo: z.string().email().optional().nullable(),
  rol: z.string().optional().nullable(),
  estado: z.boolean().optional(),
  motivo_bloqueo: z.string().optional().nullable()
})

export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>

export const enviarCredencialesSchema = z.object({
  asunto: z.string().min(3).max(120).optional().default('Credenciales de acceso'),
  mensaje_adicional: z.string().max(500).optional().nullable()
})

export type EnviarCredencialesInput = z.infer<typeof enviarCredencialesSchema>
