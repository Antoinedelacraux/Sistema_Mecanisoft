import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
// Usar el cliente Prisma compartido para evitar múltiples conexiones en dev
import { prisma } from '@/lib/prisma'

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
          const username = rawUser.trim()
          const password = credentials.password
          if (username !== rawUser) {
            console.log('[AUTH] Username normalizado (trim):', JSON.stringify(rawUser), '->', JSON.stringify(username))
          }
          if (!process.env.NEXTAUTH_SECRET) {
            console.warn('[AUTH] NEXTAUTH_SECRET no está definido. Configurar para producción.')
          }
          console.log('[AUTH] Intento de login:', username)

          // Buscar usuario en la BD (solo activos)
          const usuario = await prisma.usuario.findFirst({
            where: {
              nombre_usuario: username,
              estado: true,
              estatus: true
            },
            include: { persona: true, rol: true }
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

          // Verificar password
          const isPasswordValid = await bcrypt.compare(
            password,
            usuario.password
          )

          if (!isPasswordValid) {
            console.log("❌ Contraseña incorrecta para usuario:", username)
            return null
          }

          console.log("✅ Login exitoso para:", usuario.nombre_usuario)

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
            image: usuario.imagen_usuario
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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || ""
        session.user.username = token.username as string
        session.user.role = token.role as string
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