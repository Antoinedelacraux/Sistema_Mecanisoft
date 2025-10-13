import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    username: string
    role: string
    requiresPasswordChange?: boolean
    permisos: string[]
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username: string
      role: string
      requiresPasswordChange: boolean
      permisos: string[]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string
    role?: string
    requiresPasswordChange?: boolean
    permisos?: string[]
  }
}