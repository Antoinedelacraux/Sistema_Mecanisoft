import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encode } from 'next-auth/jwt'
import { obtenerPermisosResueltosDeUsuario } from '@/lib/permisos/service'

const MAX_AGE = 8 * 60 * 60 // match session maxAge in auth.ts (8 hours)

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const usuarioId = Number(session.user.id)
    const usuario = await prisma.usuario.findUnique({ where: { id_usuario: usuarioId }, include: { persona: true, rol: true } })
    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const permisosResueltos = await obtenerPermisosResueltosDeUsuario(usuario.id_usuario, prisma)
    const permisosActivos = permisosResueltos.filter(p => p.concedido).map(p => p.codigo)

    const tokenPayload: any = {
      sub: usuario.id_usuario.toString(),
      name: `${usuario.persona.nombre} ${usuario.persona.apellido_paterno}`,
      email: usuario.persona.correo || '',
      username: usuario.nombre_usuario,
      role: usuario.rol.nombre_rol,
      image: usuario.imagen_usuario ?? null,
      permisos: permisosActivos,
      requiresPasswordChange: Boolean(usuario.requiere_cambio_password)
    }

    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) return NextResponse.json({ error: 'NEXTAUTH_SECRET no configurado' }, { status: 500 })

    const jwt = await encode({ token: tokenPayload, secret, maxAge: MAX_AGE })

    // choose cookie name depending on environment (NextAuth default)
    const cookieName = process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    const secure = process.env.NODE_ENV === 'production'

    const res = NextResponse.json({ success: true, refreshed: true })
    const cookie = `${cookieName}=${jwt}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (err) {
    console.error('[auth/refresh-session] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
