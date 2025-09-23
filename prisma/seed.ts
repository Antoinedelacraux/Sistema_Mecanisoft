import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')
  
  // Crear roles
  const rolAdmin = await prisma.rol.create({
    data: {
      nombre_rol: 'Administrador',
    }
  })
  
  const rolMecanico = await prisma.rol.create({
    data: {
      nombre_rol: 'Mecánico',
    }
  })
  
  const rolRecepcionista = await prisma.rol.create({
    data: {
      nombre_rol: 'Recepcionista',
    }
  })
  
  console.log('✅ Roles creados')
  
  // Crear persona administrador
  const personaAdmin = await prisma.persona.create({
    data: {
      nombre: 'Admin',
      apellido_paterno: 'Sistema',
      apellido_materno: 'Principal',
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      sexo: 'M',
      telefono: '999888777',
      correo: 'admin@tallersystem.com',
    }
  })
  
  // Crear usuario administrador
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  await prisma.usuario.create({
    data: {
      id_persona: personaAdmin.id_persona,
      id_rol: rolAdmin.id_rol,
      nombre_usuario: 'admin',
      password: hashedPassword,
    }
  })
  
  console.log('✅ Usuario administrador creado')
  
  // Crear categorías básicas
  const categorias = [
    'Aceites y Lubricantes',
    'Frenos',
    'Motor',
    'Transmisión',
    'Suspensión',
    'Servicios'
  ]
  
  for (const cat of categorias) {
    await prisma.categoria.create({
      data: { nombre: cat }
    })
  }
  
  console.log('✅ Categorías creadas')
  
  // Crear unidades de medida
  const unidades = [
    { nombre: 'Unidad', abrev: 'und' },
    { nombre: 'Litros', abrev: 'lt' },
    { nombre: 'Kilogramos', abrev: 'kg' },
    { nombre: 'Horas', abrev: 'hrs' }
  ]
  
  for (const unidad of unidades) {
    await prisma.unidadMedida.create({
      data: {
        nombre_unidad: unidad.nombre,
        abreviatura: unidad.abrev
      }
    })
  }
  
  console.log('✅ Unidades de medida creadas')
  
  // Crear fabricantes básicos
  const fabricantes = [
    'Toyota',
    'Honda',
    'Ford',
    'Chevrolet',
    'Nissan',
    'Genérico'
  ]
  
  for (const fab of fabricantes) {
    await prisma.fabricante.create({
      data: {
        nombre_fabricante: fab,
        descripcion: `Fabricante ${fab}`
      }
    })
  }
  
  console.log('✅ Fabricantes creados')
  
  // Crear configuración inicial
  await prisma.configuracion.create({
    data: {
      nombre_empresa: 'Taller Mecánico MecaniSoft',
      direccion: 'Av. Principal 123, Lima, Perú',
      telefono: '01-234-5678',
      celular: '999-888-777',
      correo: 'contacto@mecanisoft.com',
      precio_dolar: 3.75
    }
  })
  
  console.log('✅ Configuración inicial creada')
  console.log('🎉 Seed completado exitosamente!')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })