import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERNAME = 'admin.pruebas'
const PASSWORD = 'Admin123!'
const DOCUMENTO = '99887766'
const CORREO = 'admin.pruebas@tallersystem.com'

async function main() {
  console.log('🔐 Creando usuario administrador de pruebas...')

  const rolAdmin = await prisma.rol.findUnique({
    where: { nombre_rol: 'Administrador' }
  })

  if (!rolAdmin) {
    throw new Error('No se encontró el rol Administrador. Ejecuta `npm run seed` primero.')
  }

  const persona = await prisma.persona.upsert({
    where: { numero_documento: DOCUMENTO },
    update: {
      nombre: 'Admin',
      apellido_paterno: 'Pruebas',
      apellido_materno: 'Taller',
      correo: CORREO,
      telefono: '999111222'
    },
    create: {
      nombre: 'Admin',
      apellido_paterno: 'Pruebas',
      apellido_materno: 'Taller',
      tipo_documento: 'DNI',
      numero_documento: DOCUMENTO,
      sexo: 'M',
      telefono: '999111222',
      correo: CORREO,
      registrar_empresa: false,
      fecha_nacimiento: new Date('1992-05-20')
    }
  })

  const hashedPassword = await bcrypt.hash(PASSWORD, 10)

  const usuario = await prisma.usuario.upsert({
    where: { nombre_usuario: USERNAME },
    update: {
      id_persona: persona.id_persona,
      id_rol: rolAdmin.id_rol,
      password: hashedPassword,
      estado: true,
      estatus: true,
      requiere_cambio_password: false,
      password_temporal: null,
      password_temporal_expira: null,
      envio_credenciales_pendiente: false,
      ultimo_error_envio: null
    },
    create: {
      id_persona: persona.id_persona,
      id_rol: rolAdmin.id_rol,
      nombre_usuario: USERNAME,
      password: hashedPassword,
      estado: true,
      estatus: true,
      requiere_cambio_password: false
    }
  })

  console.log('✅ Usuario administrador creado/actualizado:')
  console.log(`   Usuario: ${usuario.nombre_usuario}`)
  console.log(`   Persona asociada ID: ${usuario.id_persona}`)
  console.log('   Puedes iniciar sesión con las credenciales proporcionadas.')
}

main()
  .catch((error) => {
    console.error('❌ Error creando usuario administrador de pruebas:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
