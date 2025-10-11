import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Redirigir a dashboard si está en la raíz
    if (req.nextUrl.pathname === "/") {
      if (req.nextauth.token?.requiresPasswordChange) {
        return NextResponse.redirect(new URL("/dashboard/cambio-password", req.url))
      }
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Si está autenticado y va a /login, redirigir a dashboard
    if (req.nextUrl.pathname === "/login" && req.nextauth.token) {
      if (req.nextauth.token.requiresPasswordChange) {
        return NextResponse.redirect(new URL("/dashboard/cambio-password", req.url))
      }
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    if (req.nextauth.token?.requiresPasswordChange && !req.nextUrl.pathname.startsWith('/dashboard/cambio-password')) {
      return NextResponse.redirect(new URL('/dashboard/cambio-password', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permitir acceso a /login sin autenticación
        if (req.nextUrl.pathname === "/login") {
          return true
        }

        // Para otras rutas, requiere token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/login'
  ]
}