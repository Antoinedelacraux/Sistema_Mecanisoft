import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
          // Buscar usuario en la BD
          const usuario = await prisma.usuario.findUnique({
            where: {
              nombre_usuario: credentials.username,
              estado: true,
              estatus: true
            },
            include: {
              persona: true,
              rol: true
            }
          })

          if (!usuario) {
            console.log("❌ Usuario no encontrado")
            return null
          }

          // Verificar password
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            usuario.password
          )

          if (!isPasswordValid) {
            console.log("❌ Contraseña incorrecta")
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