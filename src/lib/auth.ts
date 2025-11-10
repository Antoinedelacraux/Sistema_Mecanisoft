import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
// Usar el cliente Prisma compartido para evitar múltiples conexiones en dev
import { prisma } from '@/lib/prisma'
import { obtenerPermisosResueltosDeUsuario } from '@/lib/permisos/service'
import { logger } from '@/lib/logger'
import {
  extractClientIp,
  registerLoginAttempt,
  resetLoginAttempts,
  recordFailedLogin,
  resetFailedLogin,
  isUserTemporarilyBlocked,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES
} from '@/lib/auth/login-security'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          logger.warn({ hasUsername: Boolean(credentials?.username) }, "[auth] Missing credentials in login attempt")
          return null
        }

        try {
          const rawUser = credentials.username
          const username = rawUser.trim().toLowerCase()
          const password = credentials.password
          const ip = extractClientIp(req)

          if (username !== rawUser) {
            logger.debug({ rawUser, normalized: username }, "[auth] normalized username")
          }
          if (!process.env.NEXTAUTH_SECRET) {
            logger.warn("[auth] NEXTAUTH_SECRET is not defined. Configure it for production.")
          }

          const rateLimit = await registerLoginAttempt(username, ip)
          if (!rateLimit.allowed) {
            logger.warn({ username, ip, scope: rateLimit.scope, count: rateLimit.count }, "[auth] Login blocked by rate limiter")
            return null
          }

          logger.info({ username, ip }, "[auth] Login attempt received")

          const usuario = await prisma.usuario.findUnique({
            where: {
              nombre_usuario: username
            },
            include: {
              persona: true,
              rol: true,
              trabajador: {
                select: {
                  id_trabajador: true,
                  activo: true,
                  eliminado: true
                }
              }
            }
          })

          if (!usuario) {
            logger.warn({ username, ip }, "[auth] Login failed: user not found")
            return null
          }

          const usuarioSeguridad = usuario as typeof usuario & { intentos_fallidos_login: number; ultimo_intento_fallido: Date | null }

          if (isUserTemporarilyBlocked(usuarioSeguridad)) {
            logger.warn({ username, ip, lockoutMinutes: LOCKOUT_MINUTES, attempts: usuarioSeguridad.intentos_fallidos_login }, "[auth] User temporarily locked due to failed attempts")
            return null
          }

          const handleFailure = async (reason: string, record = true) => {
            logger.warn({ username, ip, reason }, "[auth] Login failed")
            if (record) {
              const count = await recordFailedLogin(usuarioSeguridad.id_usuario)
              if (count && count >= MAX_FAILED_ATTEMPTS) {
                logger.warn({ username, ip, attempts: count, lockoutMinutes: LOCKOUT_MINUTES }, "[auth] Failed login threshold reached")
              }
            }
            return null
          }

          if (!usuario.estatus) {
            return handleFailure("usuario dado de baja", false)
          }

          if (!usuario.estado) {
            return handleFailure("usuario bloqueado/inactivo", false)
          }

          if (usuario.trabajador && (!usuario.trabajador.activo || usuario.trabajador.eliminado)) {
            return handleFailure("trabajador asociado inactivo o eliminado", false)
          }

          const ahora = new Date()
          const tienePasswordTemporal = Boolean(usuario.password_temporal)
          const expiracionTemporal = usuario.password_temporal_expira ? new Date(usuario.password_temporal_expira) : null
          const temporalVigente = tienePasswordTemporal && (!expiracionTemporal || expiracionTemporal >= ahora)

          let requiereCambioPassword = Boolean(usuario.requiere_cambio_password)
          let passwordValido = false

          if (requiereCambioPassword) {
            if (!temporalVigente) {
              logger.warn({ username, ip }, "[auth] Contraseña temporal expirada o ausente")
              if (!usuario.envio_credenciales_pendiente) {
                await prisma.usuario.update({
                  where: { id_usuario: usuario.id_usuario },
                  data: { envio_credenciales_pendiente: true, ultimo_error_envio: 'Contraseña temporal expirada. Reenviar credenciales.' }
                })
              }
              return handleFailure("contraseña temporal expirada", false)
            }
            passwordValido = await bcrypt.compare(password, usuario.password_temporal as string)
            if (!passwordValido) {
              return handleFailure("contraseña temporal incorrecta")
            }
          } else {
            passwordValido = await bcrypt.compare(password, usuario.password)

            if (!passwordValido && temporalVigente) {
              const passwordTemporalValido = await bcrypt.compare(password, usuario.password_temporal as string)
              if (passwordTemporalValido) {
                requiereCambioPassword = true
                passwordValido = true
              }
            }

            if (!passwordValido) {
              return handleFailure("contraseña incorrecta")
            }
          }

          await resetLoginAttempts(username, ip)
          if (usuarioSeguridad.intentos_fallidos_login > 0) {
            await resetFailedLogin(usuarioSeguridad.id_usuario)
          }

          logger.info({ username, ip }, "[auth] Login exitoso")

          const permisosResueltos = await obtenerPermisosResueltosDeUsuario(usuario.id_usuario, prisma)
          const permisosActivos = permisosResueltos
            .filter((permiso) => permiso.concedido)
            .map((permiso) => permiso.codigo)

          try {
            const { logEvent } = await import('@/lib/bitacora/log-event')
            await logEvent({ usuarioId: usuario.id_usuario, accion: 'LOGIN', descripcion: `Usuario ${usuario.nombre_usuario} inició sesión`, tabla: 'usuario', ip: ip ?? undefined })
          } catch (error) {
            logger.error({ error }, "[auth] no se pudo registrar en bitácora")
          }

          return {
            id: usuario.id_usuario.toString(),
            name: `${usuario.persona.nombre} ${usuario.persona.apellido_paterno}`,
            email: usuario.persona.correo || "",
            username: usuario.nombre_usuario,
            role: usuario.rol.nombre_rol,
            image: usuario.imagen_usuario,
            requiresPasswordChange: requiereCambioPassword,
            permisos: permisosActivos
          }
        } catch (error) {
          logger.error({ error }, "[auth] Error en autenticación")
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username
        token.role = user.role
        token.image = (user as any).image ?? null
        token.requiresPasswordChange = (user as unknown as { requiresPasswordChange?: boolean }).requiresPasswordChange ?? false
        token.permisos = (user as unknown as { permisos?: string[] }).permisos ?? []
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || ""
        session.user.username = token.username as string
        session.user.role = token.role as string
        session.user.image = token.image as string | undefined
        session.user.requiresPasswordChange = Boolean(token.requiresPasswordChange)
        session.user.permisos = Array.isArray(token.permisos) ? token.permisos : []
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas
  },
  secret: process.env.NEXTAUTH_SECRET,
}