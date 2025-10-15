import { PrismaClient, TipoComprobante } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')
  
  // Crear roles
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre_rol: 'Administrador' },
    update: {
      descripcion: 'Acceso total a todas las áreas del sistema',
      estatus: true
    },
    create: {
      nombre_rol: 'Administrador',
      descripcion: 'Acceso total a todas las áreas del sistema'
    }
  })
  
  const rolMecanico = await prisma.rol.upsert({
    where: { nombre_rol: 'Mecánico' },
    update: {
      descripcion: 'Rol operativo para técnicos/mecánicos del taller',
      estatus: true
    },
    create: {
      nombre_rol: 'Mecánico',
      descripcion: 'Rol operativo para técnicos/mecánicos del taller'
    }
  })
  
  const rolRecepcionista = await prisma.rol.upsert({
    where: { nombre_rol: 'Recepcionista' },
    update: {
      descripcion: 'Rol operativo para recepción y atención al cliente',
      estatus: true
    },
    create: {
      nombre_rol: 'Recepcionista',
      descripcion: 'Rol operativo para recepción y atención al cliente'
    }
  })
  
  console.log('✅ Roles creados')

  // Crear catálogo base de permisos
  const moduloMetadata: Record<string, { nombre: string; descripcion: string }> = {
    dashboard: {
      nombre: 'Dashboard',
      descripcion: 'Indicadores generales del taller'
    },
    clientes: {
      nombre: 'Clientes',
      descripcion: 'Gestión de clientes y personas asociadas'
    },
    inventario: {
      nombre: 'Inventario',
      descripcion: 'Stock, movimientos y compras de inventario'
    },
    ordenes: {
      nombre: 'Órdenes de trabajo',
      descripcion: 'Flujos de órdenes y tareas del taller'
    },
    facturacion: {
      nombre: 'Facturación',
      descripcion: 'Emisión de comprobantes y ventas'
    },
    usuarios: {
      nombre: 'Usuarios',
      descripcion: 'Administración de cuentas y credenciales'
    },
    cotizaciones: {
      nombre: 'Cotizaciones',
      descripcion: 'Gestión de cotizaciones comerciales'
    },
    servicios: {
      nombre: 'Servicios',
      descripcion: 'Catálogo de servicios ofrecidos'
    },
    tareas: {
      nombre: 'Tareas',
      descripcion: 'Kanban y seguimiento de tareas internas'
    },
    reportes: {
      nombre: 'Reportes',
      descripcion: 'Reportes analíticos y descargas'
    },
    roles: {
      nombre: 'Roles',
      descripcion: 'Plantillas de permisos y asignaciones'
    }
  }

  const permisosBase = [
    {
      codigo: 'dashboard.ver',
      nombre: 'Ver dashboard',
      descripcion: 'Acceso al panel principal con indicadores del taller',
      modulo: 'dashboard',
      agrupador: 'general'
    },
    {
      codigo: 'clientes.listar',
      nombre: 'Listar clientes',
      descripcion: 'Puede ver el listado de clientes y sus datos asociados',
      modulo: 'clientes',
      agrupador: 'gestion_clientes'
    },
    {
      codigo: 'clientes.editar',
      nombre: 'Crear y editar clientes',
      descripcion: 'Permite registrar y actualizar información de clientes',
      modulo: 'clientes',
      agrupador: 'gestion_clientes'
    },
    {
      codigo: 'inventario.ver',
      nombre: 'Ver inventario',
      descripcion: 'Consulta stock y movimientos de inventario',
      modulo: 'inventario',
      agrupador: 'gestion_inventario'
    },
    {
      codigo: 'inventario.movimientos',
      nombre: 'Registrar movimientos de inventario',
      descripcion: 'Autoriza ingresos, salidas y ajustes de inventario',
      modulo: 'inventario',
      agrupador: 'gestion_inventario'
    },
    {
      codigo: 'inventario.compras',
      nombre: 'Registrar compras de inventario',
      descripcion: 'Permite crear compras y actualizar inventario disponible',
      modulo: 'inventario',
      agrupador: 'gestion_inventario'
    },
    {
      codigo: 'ordenes.crear',
      nombre: 'Crear órdenes de trabajo',
      descripcion: 'Genera nuevas órdenes y asigna responsables',
      modulo: 'ordenes',
      agrupador: 'gestion_ordenes'
    },
    {
      codigo: 'ordenes.cerrar',
      nombre: 'Cerrar órdenes de trabajo',
      descripcion: 'Permite marcar órdenes como completadas y registrar cierre',
      modulo: 'ordenes',
      agrupador: 'gestion_ordenes'
    },
    {
      codigo: 'facturacion.emitir',
      nombre: 'Emitir comprobantes',
      descripcion: 'Genera boletas y facturas desde órdenes o cotizaciones',
      modulo: 'facturacion',
      agrupador: 'gestion_facturacion'
    },
    {
      codigo: 'usuarios.administrar',
      nombre: 'Administrar usuarios',
      descripcion: 'Gestiona cuentas de usuarios y reset de credenciales',
      modulo: 'usuarios',
      agrupador: 'seguridad'
    },
    {
      codigo: 'permisos.asignar',
      nombre: 'Asignar permisos',
      descripcion: 'Puede asignar o revocar permisos adicionales a usuarios',
      modulo: 'usuarios',
      agrupador: 'seguridad'
    },
    {
      codigo: 'roles.ver',
      nombre: 'Ver módulo de roles',
      descripcion: 'Permite visualizar el listado de roles del sistema',
      modulo: 'roles',
      agrupador: 'seguridad'
    },
    {
      codigo: 'roles.administrar',
      nombre: 'Administrar roles',
      descripcion: 'Crea, edita, asigna permisos y desactiva roles',
      modulo: 'roles',
      agrupador: 'seguridad'
    },
    {
      codigo: 'cotizaciones.listar',
      nombre: 'Listar cotizaciones',
      descripcion: 'Permite visualizar el módulo y listado de cotizaciones',
      modulo: 'cotizaciones',
      agrupador: 'gestion_cotizaciones'
    },
    {
      codigo: 'cotizaciones.gestionar',
      nombre: 'Gestionar cotizaciones',
      descripcion: 'Autoriza crear, editar, convertir y eliminar cotizaciones',
      modulo: 'cotizaciones',
      agrupador: 'gestion_cotizaciones'
    },
    {
      codigo: 'servicios.listar',
      nombre: 'Listar servicios',
      descripcion: 'Permite acceder al catálogo de servicios del taller',
      modulo: 'servicios',
      agrupador: 'gestion_servicios'
    },
    {
      codigo: 'servicios.gestionar',
      nombre: 'Gestionar servicios',
      descripcion: 'Autoriza la creación, actualización y desactivación de servicios',
      modulo: 'servicios',
      agrupador: 'gestion_servicios'
    },
    {
      codigo: 'tareas.ver',
      nombre: 'Ver tablero de tareas',
      descripcion: 'Permite acceder al tablero general de tareas del taller',
      modulo: 'tareas',
      agrupador: 'gestion_tareas'
    },
    {
      codigo: 'tareas.gestionar',
      nombre: 'Gestionar tareas',
      descripcion: 'Autoriza actualizar estados y asignaciones de tareas',
      modulo: 'tareas',
      agrupador: 'gestion_tareas'
    },
    {
      codigo: 'reportes.ver',
      nombre: 'Ver reportes',
      descripcion: 'Permite acceder al módulo de reportes e indicadores avanzados',
      modulo: 'reportes',
      agrupador: 'analitica'
    }
  ]

  const modulosUnicos = Array.from(new Set(permisosBase.map((permiso) => permiso.modulo)))

  for (const clave of modulosUnicos) {
    const metadata = moduloMetadata[clave] ?? {
      nombre: clave.charAt(0).toUpperCase() + clave.slice(1),
      descripcion: ''
    }

    await prisma.modulo.upsert({
      where: { clave },
      update: {
        nombre: metadata.nombre,
        descripcion: metadata.descripcion || null,
        activo: true
      },
      create: {
        clave,
        nombre: metadata.nombre,
        descripcion: metadata.descripcion || null
      }
    })
  }

  await prisma.permiso.createMany({ data: permisosBase, skipDuplicates: true })

  const permisosRegistrados = await prisma.permiso.findMany({
    where: {
      codigo: {
        in: permisosBase.map((permiso) => permiso.codigo)
      }
    },
    select: {
      id_permiso: true
    }
  })

  await prisma.rolPermiso.createMany({
    data: permisosRegistrados.map((permisoItem: { id_permiso: number }) => ({
      id_rol: rolAdmin.id_rol,
      id_permiso: permisoItem.id_permiso
    })),
    skipDuplicates: true
  })

  // Asegurar que los permisos base queden únicamente en el rol Administrador.
  // Esto elimina asignaciones previas de los mismos permisos en otros roles.
  await prisma.rolPermiso.deleteMany({
    where: {
      AND: [
        { id_rol: { not: rolAdmin.id_rol } },
        { id_permiso: { in: permisosRegistrados.map((p: { id_permiso: number }) => p.id_permiso) } }
      ]
    }
  })

  console.log('✅ Permisos base configurados')
  
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

  // Configuración de facturación
  await prisma.facturacionConfig.upsert({
    where: { id_config: 1 },
    update: {},
    create: {
      afecta_igv: true,
      igv_porcentaje: 0.18,
      serie_boleta_default: 'B001',
      serie_factura_default: 'F001',
      precios_incluyen_igv_default: true,
      moneda_default: 'PEN'
    }
  })

  await prisma.facturacionSerie.upsert({
    where: {
      tipo_serie: {
        tipo: TipoComprobante.BOLETA,
        serie: 'B001'
      }
    },
    update: {},
    create: {
      tipo: TipoComprobante.BOLETA,
      serie: 'B001',
      correlativo_actual: 0,
      descripcion: 'Serie por defecto para boletas'
    }
  })

  await prisma.facturacionSerie.upsert({
    where: {
      tipo_serie: {
        tipo: TipoComprobante.BOLETA,
        serie: 'B001'
      }
    },
    update: {},
    create: {
      tipo: TipoComprobante.BOLETA,
      serie: 'B001',
      correlativo_actual: 0,
      descripcion: 'Serie por defecto para boletas'
    }
  })

  await prisma.facturacionSerie.upsert({
    where: {
      tipo_serie: {
        tipo: TipoComprobante.FACTURA,
        serie: 'F001'
      }
    },
    update: {},
    create: {
      tipo: TipoComprobante.FACTURA,
      serie: 'F001',
      correlativo_actual: 0,
      descripcion: 'Serie por defecto para facturas'
    }
  })

  console.log('✅ Configuración de facturación lista')

  // Crear almacén y ubicaciones base para inventario
  let almacenCentral = await prisma.almacen.findFirst({ where: { nombre: 'Almacén Central' } })

  if (!almacenCentral) {
    almacenCentral = await prisma.almacen.create({
      data: {
        nombre: 'Almacén Central',
        descripcion: 'Almacén principal del taller',
        direccion: 'Av. Principal 123, Lima'
      }
    })
  }

  const ubicaciones = [
    { codigo: 'EST-001', descripcion: 'Estantería principal' },
    { codigo: 'PISO-001', descripcion: 'Área de recepción de mercadería' }
  ]

  for (const ubicacion of ubicaciones) {
    const existente = await prisma.almacenUbicacion.findFirst({
      where: { codigo: ubicacion.codigo }
    })

    if (!existente) {
      await prisma.almacenUbicacion.create({
        data: {
          codigo: ubicacion.codigo,
          descripcion: ubicacion.descripcion,
          id_almacen: almacenCentral.id_almacen
        }
      })
    }
  }

  console.log('✅ Inventario base configurado')

  // Crear proveedor e inventario simplificado inicial para el nuevo módulo
  const personaProveedorDemo = await prisma.persona.upsert({
    where: { numero_documento: '20123450001' },
    update: {
      nombre: 'Distribuidora',
      apellido_paterno: 'Andina',
      apellido_materno: 'SAC',
      telefono: '016543210',
      correo: 'contacto@andina.com.pe',
      registrar_empresa: true,
    },
    create: {
      nombre: 'Distribuidora',
      apellido_paterno: 'Andina',
      apellido_materno: 'SAC',
      tipo_documento: 'RUC',
      numero_documento: '20123450001',
      telefono: '016543210',
      correo: 'contacto@andina.com.pe',
      registrar_empresa: true,
    },
  })

  const proveedorDemo = await prisma.proveedor.upsert({
    where: { id_persona: personaProveedorDemo.id_persona },
    update: {
      razon_social: 'Distribuidora Andina SAC',
      contacto: 'Lucía Salazar',
      numero_contacto: '999556677',
    },
    create: {
      id_persona: personaProveedorDemo.id_persona,
      razon_social: 'Distribuidora Andina SAC',
      contacto: 'Lucía Salazar',
      numero_contacto: '999556677',
    },
  })

  const productosParaInventario = await prisma.producto.findMany({
    where: { estatus: true },
    orderBy: { id_producto: 'asc' },
    take: 3,
  })

  for (const producto of productosParaInventario) {
    await prisma.inventario.upsert({
      where: { id_producto: producto.id_producto },
      update: {
        stock_disponible: { increment: 5 },
      },
      create: {
        id_producto: producto.id_producto,
        stock_disponible: 5,
        stock_comprometido: 0,
        costo_promedio: producto.precio_compra,
      },
    })
  }

  if (productosParaInventario.length > 0) {
    console.log(
      `✅ Inventario simplificado inicial listo para ${productosParaInventario.length} producto(s) con proveedor ${proveedorDemo.razon_social}`,
    )
  }

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