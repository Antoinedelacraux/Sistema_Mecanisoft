import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    username: string
    role: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username: string
      role: string
    }
  }
}