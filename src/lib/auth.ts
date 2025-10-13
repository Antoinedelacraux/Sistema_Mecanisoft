import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
// Usar el cliente Prisma compartido para evitar múltiples conexiones en dev
import { prisma } from '@/lib/prisma'
import { obtenerPermisosResueltosDeUsuario } from '@/lib/permisos/service'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          const rawUser = credentials.username
          const username = rawUser.trim().toLowerCase()
          const password = credentials.password
          if (username !== rawUser) {
            console.log('[AUTH] Username normalizado (trim+lowercase):', JSON.stringify(rawUser), '->', JSON.stringify(username))
          }
          if (!process.env.NEXTAUTH_SECRET) {
            console.warn('[AUTH] NEXTAUTH_SECRET no está definido. Configurar para producción.')
          }
          console.log('[AUTH] Intento de login:', username)

          // Buscar usuario en la BD (normalizando el usuario)
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
            // Intento secundario solo por nombre_usuario para diagnosticar si está inactivo
            const existeUsuario = await prisma.usuario.findFirst({
              where: { nombre_usuario: username },
              include: { persona: true, rol: true }
            })
            if (existeUsuario) {
              console.log("❌ Usuario inactivo o deshabilitado:", username, {
                estado: existeUsuario.estado,
                estatus: existeUsuario.estatus
              })
            } else {
              console.log("❌ Usuario no encontrado:", username)
            }
            return null
          }

          if (!usuario.estatus) {
            console.log('❌ Usuario dado de baja:', username)
            return null
          }

          if (!usuario.estado) {
            console.log('❌ Usuario bloqueado/inactivo:', username, {
              bloqueado_en: usuario.bloqueado_en,
              motivo_bloqueo: usuario.motivo_bloqueo
            })
            return null
          }

          if (usuario.trabajador && (!usuario.trabajador.activo || usuario.trabajador.eliminado)) {
            console.log('❌ Trabajador asociado no apto para login:', username, {
              activo: usuario.trabajador.activo,
              eliminado: usuario.trabajador.eliminado
            })
            return null
          }

          const ahora = new Date()
          const tienePasswordTemporal = Boolean(usuario.password_temporal)
          const expiracionTemporal = usuario.password_temporal_expira ? new Date(usuario.password_temporal_expira) : null
          const temporalVigente = tienePasswordTemporal && (!expiracionTemporal || expiracionTemporal >= ahora)

          let requiereCambioPassword = Boolean(usuario.requiere_cambio_password)
          let passwordValido = false

          if (requiereCambioPassword) {
            if (!temporalVigente) {
              console.log('❌ Contraseña temporal expirada o ausente para usuario que requiere cambio:', username)
              if (!usuario.envio_credenciales_pendiente) {
                await prisma.usuario.update({
                  where: { id_usuario: usuario.id_usuario },
                  data: { envio_credenciales_pendiente: true, ultimo_error_envio: 'Contraseña temporal expirada. Reenviar credenciales.' }
                })
              }
              return null
            }
            passwordValido = await bcrypt.compare(password, usuario.password_temporal as string)
            if (!passwordValido) {
              console.log('❌ Contraseña temporal incorrecta para usuario:', username)
              return null
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
              console.log("❌ Contraseña incorrecta para usuario:", username)
              return null
            }
          }

          console.log("✅ Login exitoso para:", usuario.nombre_usuario)

          const permisosResueltos = await obtenerPermisosResueltosDeUsuario(usuario.id_usuario, prisma)
          const permisosActivos = permisosResueltos
            .filter((permiso) => permiso.concedido)
            .map((permiso) => permiso.codigo)

          // Registrar en bitácora
          await prisma.bitacora.create({
            data: {
              id_usuario: usuario.id_usuario,
              accion: "LOGIN",
              descripcion: `Usuario ${usuario.nombre_usuario} inició sesión`,
              tabla: "usuario"
            }
          })

          // Retornar datos del usuario para la sesión
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
          console.error("❌ Error en autenticación:", error)
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