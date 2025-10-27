import { prisma } from '@/lib/prisma'

async function main() {
  const user = await prisma.usuario.findUnique({
    where: { nombre_usuario: 'admin.pruebas' },
    select: {
      id_usuario: true,
      nombre_usuario: true,
      estado: true,
      estatus: true,
      password: true,
      password_temporal: true,
      requiere_cambio_password: true,
      password_temporal_expira: true,
    },
  })

  console.log(user)
}

main().finally(async () => {
  await prisma.$disconnect()
})
