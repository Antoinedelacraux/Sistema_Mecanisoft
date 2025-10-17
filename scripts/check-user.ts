import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const username = process.argv[2]
  if (!username) {
    console.error('Usage: tsx scripts/check-user.ts <nombre_usuario>')
    process.exit(1)
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { nombre_usuario: username },
      include: { persona: true, rol: true, trabajador: true }
    })

    if (!usuario) {
      console.log(`NOT_FOUND: Usuario ${username} no existe en la DB conectada.`)
      process.exit(0)
    }

    const out = {
      id_usuario: usuario.id_usuario,
      nombre_usuario: usuario.nombre_usuario,
      estado: usuario.estado,
      estatus: usuario.estatus,
      requiere_cambio_password: usuario.requiere_cambio_password,
      tiene_password_temporal: Boolean(usuario.password_temporal),
      persona_correo: usuario.persona?.correo ?? null,
      rol: usuario.rol?.nombre_rol ?? null,
      trabajador: usuario.trabajador ?? null
    }

    console.log('FOUND:', JSON.stringify(out, null, 2))
  } catch (error) {
    console.error('ERROR querying DB:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
