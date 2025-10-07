import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')
  
  // Crear roles
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre_rol: 'Administrador' },
    update: {},
    create: {
      nombre_rol: 'Administrador',
    }
  })
  
  const rolMecanico = await prisma.rol.upsert({
    where: { nombre_rol: 'Mecánico' },
    update: {},
    create: {
      nombre_rol: 'Mecánico',
    }
  })
  
  const rolRecepcionista = await prisma.rol.upsert({
    where: { nombre_rol: 'Recepcionista' },
    update: {},
    create: {
      nombre_rol: 'Recepcionista',
    }
  })
  
  console.log('✅ Roles creados')
  
  // Crear persona administrador
  const personaAdmin = await prisma.persona.upsert({
    where: { numero_documento: '12345678' },
    update: {},
    create: {
      nombre: 'Admin',
      apellido_paterno: 'Sistema',
      apellido_materno: 'Principal',
  tipo_documento: 'DNI',
      numero_documento: '12345678',
      sexo: 'M',
      telefono: '999888777',
      correo: 'admin@tallersystem.com',
      registrar_empresa: false,
      fecha_nacimiento: new Date('1990-01-01'),
    }
  })
  
  // Crear usuario administrador
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  await prisma.usuario.upsert({
    where: { nombre_usuario: 'admin' },
    update: {
      password: hashedPassword, // Actualizar la contraseña por si cambia
    },
    create: {
      id_persona: personaAdmin.id_persona,
      id_rol: rolAdmin.id_rol,
      nombre_usuario: 'admin',
      password: hashedPassword,
    }
  })
  
  console.log('✅ Usuario administrador creado')
  
  // Crear categorías básicas (sin upsert porque nombre no es único)
  const categorias = [
    'Aceites y Lubricantes',
    'Frenos',
    'Motor',
    'Transmisión',
    'Suspensión',
    'Servicios'
  ]

  for (const cat of categorias) {
    const existe = await prisma.categoria.findFirst({ where: { nombre: cat } })
    if (!existe) {
      await prisma.categoria.create({ data: { nombre: cat } })
    }
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
    const existe = await prisma.unidadMedida.findFirst({ where: { nombre_unidad: unidad.nombre } })
    if (!existe) {
      await prisma.unidadMedida.create({
        data: {
          nombre_unidad: unidad.nombre,
          abreviatura: unidad.abrev
        }
      })
    }
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
    const existe = await prisma.fabricante.findFirst({ where: { nombre_fabricante: fab } })
    if (!existe) {
      await prisma.fabricante.create({
        data: {
          nombre_fabricante: fab,
          descripcion: `Fabricante ${fab}`
        }
      })
    }
  }
  
  console.log('✅ Fabricantes creados')
  
  // Crear configuración inicial
  await prisma.configuracion.upsert({
    where: { id_conf: 1 }, // Asumimos que solo habrá una fila de configuración
    update: {},
    create: {
      nombre_empresa: 'Taller Mecánico MecaniSoft',
      direccion: 'Av. Principal 123, Lima, Perú',
      telefono: '01-234-5678',
      celular: '999-888-777',
      correo: 'contacto@mecanisoft.com',
      precio_dolar: 3.75
    }
  })
  
  console.log('✅ Configuración inicial creada')

  // ✅ Agregar al final del seed existente, antes de console.log('🎉 Seed completado exitosamente!')

  // Crear marcas de vehículos
  const marcasVehiculos = [
    { nombre: 'Toyota', descripcion: 'Marca japonesa de automóviles' },
    { nombre: 'Honda', descripcion: 'Fabricante japonés de vehículos' },
    { nombre: 'Ford', descripcion: 'Marca americana de automóviles' },
    { nombre: 'Chevrolet', descripcion: 'División de General Motors' },
    { nombre: 'Nissan', descripcion: 'Fabricante japonés de vehículos' },
    { nombre: 'Volkswagen', descripcion: 'Marca alemana de automóviles' },
    { nombre: 'Hyundai', descripcion: 'Fabricante surcoreano' },
    { nombre: 'Kia', descripcion: 'Marca surcoreana de vehículos' }
  ]

  const marcasCreadas = [] as { id_marca: number; nombre_marca: string }[]
  for (const marcaData of marcasVehiculos) {
    let marca = await prisma.marca.findFirst({ where: { nombre_marca: marcaData.nombre } })
    if (!marca) {
      marca = await prisma.marca.create({
        data: {
          nombre_marca: marcaData.nombre,
          descripcion: marcaData.descripcion
        }
      })
    }
    marcasCreadas.push({ id_marca: marca.id_marca, nombre_marca: marca.nombre_marca })
  }

  console.log('✅ Marcas de vehículos creadas')

  // Crear modelos por marca
  const modelosPorMarca = {
    'Toyota': ['Corolla', 'Camry', 'RAV4', 'Prius', 'Hilux', 'Yaris'],
    'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'City', 'Pilot'],
    'Ford': ['Focus', 'Fiesta', 'Escape', 'Explorer', 'F-150', 'Ranger'],
    'Chevrolet': ['Spark', 'Cruze', 'Equinox', 'Tahoe', 'Silverado', 'Aveo'],
    'Nissan': ['Sentra', 'Altima', 'X-Trail', 'Frontier', 'Versa', 'Kicks'],
    'Volkswagen': ['Golf', 'Jetta', 'Tiguan', 'Passat', 'Polo', 'Amarok'],
    'Hyundai': ['Elantra', 'Tucson', 'Santa Fe', 'i10', 'i20', 'Creta'],
    'Kia': ['Rio', 'Cerato', 'Sportage', 'Sorento', 'Picanto', 'Stonic']
  }

  for (const marca of marcasCreadas) {
    const modelos = modelosPorMarca[marca.nombre_marca as keyof typeof modelosPorMarca] || []
    
    for (const modeloNombre of modelos) {
      const existeModelo = await prisma.modelo.findFirst({
        where: { id_marca: marca.id_marca, nombre_modelo: modeloNombre }
      })
      if (!existeModelo) {
        await prisma.modelo.create({
          data: {
            id_marca: marca.id_marca,
            nombre_modelo: modeloNombre,
            descripcion: `Modelo ${modeloNombre} de ${marca.nombre_marca}`
          }
        })
      }
    }
  }

  console.log('✅ Modelos de vehículos creados')

  // Crear clientes de ejemplo para el módulo
  console.log('✅ Creando clientes de ejemplo...')

  const personaClienteNatural = await prisma.persona.upsert({
    where: { numero_documento: '87654321' },
    update: {
      nombre: 'Juana',
      apellido_paterno: 'Torres',
      apellido_materno: 'Lopez',
      telefono: '987654321',
      correo: 'juana.torres@example.com',
      fecha_nacimiento: new Date('1992-07-14'),
      registrar_empresa: false
    },
    create: {
      nombre: 'Juana',
      apellido_paterno: 'Torres',
      apellido_materno: 'Lopez',
      tipo_documento: 'DNI',
      numero_documento: '87654321',
      sexo: 'F',
      telefono: '987654321',
      correo: 'juana.torres@example.com',
      fecha_nacimiento: new Date('1992-07-14'),
      registrar_empresa: false
    }
  })

  await prisma.cliente.upsert({
    where: { id_persona: personaClienteNatural.id_persona },
    update: {},
    create: {
      id_persona: personaClienteNatural.id_persona
    }
  })

  const personaClienteRuc = await prisma.persona.upsert({
    where: { numero_documento: '20123456789' },
    update: {
      nombre: 'Carlos',
      apellido_paterno: 'Rivas',
      apellido_materno: 'Salazar',
      telefono: '988112233',
      correo: 'carlos.rivas@example.com',
      nombre_comercial: 'CR Servicios Automotrices',
      fecha_nacimiento: new Date('1986-03-22'),
      registrar_empresa: false
    },
    create: {
      nombre: 'Carlos',
      apellido_paterno: 'Rivas',
      apellido_materno: 'Salazar',
      tipo_documento: 'RUC',
      numero_documento: '20123456789',
      sexo: 'M',
      telefono: '988112233',
      correo: 'carlos.rivas@example.com',
      nombre_comercial: 'CR Servicios Automotrices',
      fecha_nacimiento: new Date('1986-03-22'),
      registrar_empresa: false
    }
  })

  await prisma.cliente.upsert({
    where: { id_persona: personaClienteRuc.id_persona },
    update: {},
    create: {
      id_persona: personaClienteRuc.id_persona
    }
  })

  const personaRepresentante = await prisma.persona.upsert({
    where: { numero_documento: '44556677' },
    update: {
      nombre: 'María',
      apellido_paterno: 'Huamán',
      apellido_materno: 'Quispe',
      telefono: '977665544',
      correo: 'maria.huaman@example.com',
      fecha_nacimiento: new Date('1990-11-05'),
      registrar_empresa: true
    },
    create: {
      nombre: 'María',
      apellido_paterno: 'Huamán',
      apellido_materno: 'Quispe',
      tipo_documento: 'DNI',
      numero_documento: '44556677',
      sexo: 'F',
      telefono: '977665544',
      correo: 'maria.huaman@example.com',
      fecha_nacimiento: new Date('1990-11-05'),
      registrar_empresa: true
    }
  })

  await prisma.cliente.upsert({
    where: { id_persona: personaRepresentante.id_persona },
    update: {},
    create: {
      id_persona: personaRepresentante.id_persona
    }
  })

  await prisma.empresaPersona.upsert({
    where: { persona_id: personaRepresentante.id_persona },
    update: {
      ruc: '20987654321',
      razon_social: 'Servicios Integrales Huamán SAC',
      nombre_comercial: 'Servicios Huamán',
      direccion_fiscal: 'Av. Los Ingenieros 123, Lima'
    },
    create: {
      persona_id: personaRepresentante.id_persona,
      ruc: '20987654321',
      razon_social: 'Servicios Integrales Huamán SAC',
      nombre_comercial: 'Servicios Huamán',
      direccion_fiscal: 'Av. Los Ingenieros 123, Lima'
    }
  })

  console.log('✅ Clientes de ejemplo creados')

  // Crear algunos vehículos de ejemplo (opcional)
  // Solo si ya tienes clientes creados en el seed anterior
  
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