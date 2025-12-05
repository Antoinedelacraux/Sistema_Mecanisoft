import { Prisma, PrismaClient, MetodoPagoVenta, EstadoPagoVenta, MovimientoTipo, MovimientoOrigen, OrigenComprobante, TipoItemComprobante, TipoComprobante, EstadoComprobante } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const decimal = (value: number) => new Prisma.Decimal(value)
const DAY_IN_MS = 1000 * 60 * 60 * 24
const RUN_TAG = Date.now().toString(36).toUpperCase().slice(-5)

const randomFrom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]
const formatNombrePersona = (persona: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null }) =>
  [persona.nombre, persona.apellido_paterno, persona.apellido_materno].filter(Boolean).join(' ').trim()
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000)
const clampDecimals = (value: number, precision = 2) => Number(value.toFixed(precision))

async function ensureTrabajadores(adminUserId: number) {
  const rolMecanico = await prisma.rol.findUnique({ where: { nombre_rol: 'Mecánico' } })
  const rolRecepcionista = await prisma.rol.findUnique({ where: { nombre_rol: 'Recepcionista' } })

  if (!rolMecanico || !rolRecepcionista) {
    throw new Error('Roles base no encontrados. Ejecuta el seed principal primero.')
  }

  const hashed = await bcrypt.hash('Taller123!', 10)

  const trabajadoresData = [
    {
      persona: {
        nombre: 'Lucía',
        apellido_paterno: 'Ramos',
        apellido_materno: 'Calderón',
        tipo_documento: 'DNI' as const,
        numero_documento: '72145678',
        sexo: 'F',
        telefono: '987654321',
        correo: 'lucia.ramos@mecanisoft.pe',
        direccion: 'Av. Los Maestros 455, Lima'
      },
      usuario: {
        nombre_usuario: 'recepcion.lucia',
        id_rol: rolRecepcionista.id_rol,
        password: hashed
      },
      trabajador: {
        codigo_empleado: 'REC-001',
        cargo: 'Recepcionista',
        especialidad: 'Coordinación de atención',
        nivel_experiencia: 'Senior',
        tarifa_hora: decimal(28),
        sueldo_mensual: decimal(2800)
      }
    },
    {
      persona: {
        nombre: 'Jorge',
        apellido_paterno: 'Medina',
        apellido_materno: 'Quispe',
        tipo_documento: 'DNI' as const,
        numero_documento: '74561234',
        sexo: 'M',
        telefono: '998812233',
        correo: 'jorge.medina@mecanisoft.pe',
        direccion: 'Jr. Talleristas 102, Lima'
      },
      usuario: {
        nombre_usuario: 'mecanico.jorge',
        id_rol: rolMecanico.id_rol,
        password: hashed
      },
      trabajador: {
        codigo_empleado: 'MEC-101',
        cargo: 'Mecánico General',
        especialidad: 'Mecánica integral',
        nivel_experiencia: 'Senior',
        tarifa_hora: decimal(48),
        sueldo_mensual: decimal(4200)
      }
    },
    {
      persona: {
        nombre: 'Sofía',
        apellido_paterno: 'Delgado',
        apellido_materno: 'Paredes',
        tipo_documento: 'DNI' as const,
        numero_documento: '73228990',
        sexo: 'F',
        telefono: '991122334',
        correo: 'sofia.delgado@mecanisoft.pe',
        direccion: 'Av. Tecnológica 777, Lima'
      },
      usuario: {
        nombre_usuario: 'mecanico.sofia',
        id_rol: rolMecanico.id_rol,
        password: hashed
      },
      trabajador: {
        codigo_empleado: 'MEC-102',
        cargo: 'Especialista en Diagnóstico',
        especialidad: 'Diagnóstico electrónico',
        nivel_experiencia: 'Especialista',
        tarifa_hora: decimal(52),
        sueldo_mensual: decimal(4500)
      }
    },
    {
      persona: {
        nombre: 'Luis',
        apellido_paterno: 'Castillo',
        apellido_materno: 'Ríos',
        tipo_documento: 'DNI' as const,
        numero_documento: '70894567',
        sexo: 'M',
        telefono: '987332211',
        correo: 'luis.castillo@mecanisoft.pe',
        direccion: 'Pasaje Motor 25, Lima'
      },
      usuario: null,
      trabajador: {
        codigo_empleado: 'AYU-203',
        cargo: 'Ayudante de Taller',
        especialidad: 'Apoyo general',
        nivel_experiencia: 'Junior',
        tarifa_hora: decimal(18),
        sueldo_mensual: decimal(1800)
      }
    }
  ]

  const trabajadoresCreados: Record<string, number> = {}

  for (const entry of trabajadoresData) {
    const persona = await prisma.persona.upsert({
      where: { numero_documento: entry.persona.numero_documento },
      update: {
        nombre: entry.persona.nombre,
        apellido_paterno: entry.persona.apellido_paterno,
        apellido_materno: entry.persona.apellido_materno,
        telefono: entry.persona.telefono,
        correo: entry.persona.correo,
        direccion: entry.persona.direccion
      },
      create: {
        nombre: entry.persona.nombre,
        apellido_paterno: entry.persona.apellido_paterno,
        apellido_materno: entry.persona.apellido_materno,
        tipo_documento: entry.persona.tipo_documento,
        numero_documento: entry.persona.numero_documento,
        sexo: entry.persona.sexo,
        telefono: entry.persona.telefono,
        correo: entry.persona.correo,
        direccion: entry.persona.direccion,
        registrar_empresa: false
      }
    })

    let usuarioId: number | null = null

    if (entry.usuario) {
      const usuario = await prisma.usuario.upsert({
        where: { nombre_usuario: entry.usuario.nombre_usuario },
        update: {
          id_persona: persona.id_persona,
          id_rol: entry.usuario.id_rol,
          password: entry.usuario.password,
          estado: true,
          estatus: true,
          requiere_cambio_password: false
        },
        create: {
          id_persona: persona.id_persona,
          id_rol: entry.usuario.id_rol,
          nombre_usuario: entry.usuario.nombre_usuario,
          password: entry.usuario.password,
          estado: true,
          estatus: true,
          requiere_cambio_password: false
        }
      })
      usuarioId = usuario.id_usuario
    }

    const trabajador = await prisma.trabajador.upsert({
      where: { id_persona: persona.id_persona },
      update: {
        id_usuario: usuarioId ?? undefined,
        codigo_empleado: entry.trabajador.codigo_empleado,
        cargo: entry.trabajador.cargo,
        especialidad: entry.trabajador.especialidad,
        nivel_experiencia: entry.trabajador.nivel_experiencia,
        tarifa_hora: entry.trabajador.tarifa_hora,
        sueldo_mensual: entry.trabajador.sueldo_mensual ?? undefined,
        activo: true,
        eliminado: false
      },
      create: {
        id_persona: persona.id_persona,
        id_usuario: usuarioId ?? undefined,
        codigo_empleado: entry.trabajador.codigo_empleado,
        cargo: entry.trabajador.cargo,
        especialidad: entry.trabajador.especialidad,
        nivel_experiencia: entry.trabajador.nivel_experiencia,
        tarifa_hora: entry.trabajador.tarifa_hora,
        sueldo_mensual: entry.trabajador.sueldo_mensual ?? undefined
      }
    })

    trabajadoresCreados[entry.trabajador.codigo_empleado] = trabajador.id_trabajador

    await prisma.bitacora.create({
      data: {
        id_usuario: adminUserId,
        accion: 'TRABAJADOR_SEED',
        descripcion: `Seed trabajadores - ${persona.nombre} ${persona.apellido_paterno}`,
        tabla: 'trabajador'
      }
    })
  }

  return trabajadoresCreados
}

async function ensureClientes(): Promise<Record<string, ClienteSeedEntry>> {
  const modelos = await prisma.modelo.findMany({
    where: {
      nombre_modelo: {
        in: ['Corolla', 'Civic', 'Ranger', 'RAV4']
      }
    },
    include: { marca: true }
  })

  if (modelos.length === 0) {
    throw new Error('No se encontraron modelos de vehículos. Verifica el seed base.')
  }

  const modeloPorNombre = new Map(modelos.map((m) => [m.nombre_modelo, m]))

  const clientesData = [
    {
      persona: {
        nombre: 'Carlos',
        apellido_paterno: 'Huamán',
        apellido_materno: 'Soto',
        tipo_documento: 'DNI' as const,
        numero_documento: '45678901',
        sexo: 'M',
        telefono: '989877665',
        correo: 'carlos.huaman@cliente.pe',
        direccion: 'Av. Los Ingenieros 123, Lima'
      },
      vehiculos: [
        {
          placa: 'D3K-218',
          modelo: 'Corolla',
          tipo: 'Sedán',
          año: 2019,
          tipo_combustible: 'Gasolina',
          transmision: 'Automática',
          observaciones: 'Cliente prefiere aceite sintético'
        },
        {
          placa: 'F5P-442',
          modelo: 'Ranger',
          tipo: 'Pickup',
          año: 2021,
          tipo_combustible: 'Diesel',
          transmision: 'Manual'
        }
      ]
    },
    {
      persona: {
        nombre: 'María',
        apellido_paterno: 'Torres',
        apellido_materno: 'Aguilar',
        tipo_documento: 'DNI' as const,
        numero_documento: '49876543',
        sexo: 'F',
        telefono: '987000321',
        correo: 'maria.torres@cliente.pe',
        direccion: 'Jr. Primavera 540, Surco'
      },
      vehiculos: [
        {
          placa: 'H2V-903',
          modelo: 'Civic',
          tipo: 'Sedán',
          año: 2020,
          tipo_combustible: 'Gasolina',
          transmision: 'CVT',
          observaciones: 'Trae historial de mantenimientos en concesionario'
        }
      ]
    },
    {
      persona: {
        nombre: 'Transportes',
        apellido_paterno: 'Andinos',
        apellido_materno: 'SAC',
        tipo_documento: 'RUC' as const,
        numero_documento: '20567890123',
        sexo: null,
        telefono: '016789541',
        correo: 'logistica@transportesandinos.com',
        direccion: 'Parque Industrial Callao Nave 8'
      },
      vehiculos: [
        {
          placa: 'T7Z-611',
          modelo: 'RAV4',
          tipo: 'SUV',
          año: 2022,
          tipo_combustible: 'Gasolina',
          transmision: 'Automática',
          observaciones: 'Unidad de supervisión de flota'
        }
      ]
    }
  ]

  const clientesPorDocumento: Record<string, ClienteSeedEntry> = {}

  for (const cliente of clientesData) {
    const persona = await prisma.persona.upsert({
      where: { numero_documento: cliente.persona.numero_documento },
      update: {
        nombre: cliente.persona.nombre,
        apellido_paterno: cliente.persona.apellido_paterno,
        apellido_materno: cliente.persona.apellido_materno,
        telefono: cliente.persona.telefono,
        correo: cliente.persona.correo,
        direccion: cliente.persona.direccion,
        registrar_empresa: cliente.persona.tipo_documento === 'RUC'
      },
      create: {
        nombre: cliente.persona.nombre,
        apellido_paterno: cliente.persona.apellido_paterno,
        apellido_materno: cliente.persona.apellido_materno,
        tipo_documento: cliente.persona.tipo_documento,
        numero_documento: cliente.persona.numero_documento,
        sexo: cliente.persona.sexo ?? undefined,
        telefono: cliente.persona.telefono,
        correo: cliente.persona.correo,
        direccion: cliente.persona.direccion,
        registrar_empresa: cliente.persona.tipo_documento === 'RUC'
      }
    })

    const clienteDb = await prisma.cliente.upsert({
      where: { id_persona: persona.id_persona },
      update: { estatus: true },
      create: {
        id_persona: persona.id_persona
      }
    })

    const vehiculosMap: Record<string, number> = {}

    for (const vehiculo of cliente.vehiculos) {
      const modelo = modeloPorNombre.get(vehiculo.modelo)
      if (!modelo) {
        throw new Error(`Modelo ${vehiculo.modelo} no encontrado en base.`)
      }

      const vehiculoDb = await prisma.vehiculo.upsert({
        where: { placa: vehiculo.placa },
        update: {
          id_cliente: clienteDb.id_cliente,
          id_modelo: modelo.id_modelo,
          tipo: vehiculo.tipo,
          ['año']: vehiculo['año'],
          tipo_combustible: vehiculo.tipo_combustible,
          transmision: vehiculo.transmision,
          observaciones: vehiculo.observaciones ?? null
        },
        create: {
          id_cliente: clienteDb.id_cliente,
          id_modelo: modelo.id_modelo,
          placa: vehiculo.placa,
          tipo: vehiculo.tipo,
          ['año']: vehiculo['año'],
          tipo_combustible: vehiculo.tipo_combustible,
          transmision: vehiculo.transmision,
          observaciones: vehiculo.observaciones ?? null
        }
      })

      vehiculosMap[vehiculo.placa] = vehiculoDb.id_vehiculo
    }

    clientesPorDocumento[cliente.persona.numero_documento] = {
      idCliente: clienteDb.id_cliente,
      idPersona: persona.id_persona,
      vehiculos: vehiculosMap
    }
  }

  return clientesPorDocumento
}

async function ensureServicios() {
  const modeloCorolla = await prisma.modelo.findFirst({ where: { nombre_modelo: 'Corolla' } })
  const modeloCivic = await prisma.modelo.findFirst({ where: { nombre_modelo: 'Civic' } })

  const servicios = [
    {
      codigo_servicio: 'SERV-MTTO-ACEITE',
      nombre: 'Cambio de aceite y filtro sintético 5W-30',
      descripcion: 'Servicio completo de drenado, reemplazo de filtro y revisión de fugas.',
      id_modelo: modeloCorolla?.id_modelo ?? null,
      precio_base: decimal(180),
      tiempo_minimo: 90,
      tiempo_maximo: 120,
      unidad_tiempo: 'minutos'
    },
    {
      codigo_servicio: 'SERV-FRENOS-DEL',
      nombre: 'Servicio de frenos delantero completo',
      descripcion: 'Cambio de pastillas, limpieza de cálipers y purga de circuito.',
      id_modelo: modeloCivic?.id_modelo ?? null,
      precio_base: decimal(320),
      tiempo_minimo: 120,
      tiempo_maximo: 150,
      unidad_tiempo: 'minutos'
    },
    {
      codigo_servicio: 'SERV-DIAG-ELEC',
      nombre: 'Diagnóstico eléctrico avanzado',
      descripcion: 'Escaneo con scanner automotriz, prueba de alternador y batería.',
      id_modelo: null,
      precio_base: decimal(150),
      tiempo_minimo: 60,
      tiempo_maximo: 90,
      unidad_tiempo: 'minutos'
    }
  ]

  const serviciosCreados: Record<string, number> = {}

  for (const servicio of servicios) {
    const servicioDb = await prisma.servicio.upsert({
      where: { codigo_servicio: servicio.codigo_servicio },
      update: {
        nombre: servicio.nombre,
        descripcion: servicio.descripcion,
        id_modelo: servicio.id_modelo ?? undefined,
        precio_base: servicio.precio_base,
        tiempo_minimo: servicio.tiempo_minimo,
        tiempo_maximo: servicio.tiempo_maximo,
        unidad_tiempo: servicio.unidad_tiempo,
        estatus: true
      },
      create: {
        codigo_servicio: servicio.codigo_servicio,
        nombre: servicio.nombre,
        descripcion: servicio.descripcion,
        id_modelo: servicio.id_modelo ?? undefined,
        precio_base: servicio.precio_base,
        tiempo_minimo: servicio.tiempo_minimo,
        tiempo_maximo: servicio.tiempo_maximo,
        unidad_tiempo: servicio.unidad_tiempo
      }
    })

    serviciosCreados[servicio.codigo_servicio] = servicioDb.id_servicio
  }

  return serviciosCreados
}

async function ensureProductos(adminUserId: number): Promise<Record<string, ProductoSeedEntry>> {
  const almacenCentral = await prisma.almacen.findFirst({ where: { nombre: 'Almacén Central' } })
  const ubicacionPrincipal = await prisma.almacenUbicacion.findFirst({ where: { codigo: 'EST-001' } })

  if (!almacenCentral || !ubicacionPrincipal) {
    throw new Error('No se encontró el almacén base o la ubicación principal.')
  }

  const categoriaAceites = await prisma.categoria.findFirst({ where: { nombre: 'Aceites y Lubricantes' } })
  const categoriaFrenos = await prisma.categoria.findFirst({ where: { nombre: 'Frenos' } })
  const categoriaMotor = await prisma.categoria.findFirst({ where: { nombre: 'Motor' } })
  const unidadUnidad = await prisma.unidadMedida.findFirst({ where: { nombre_unidad: 'Unidad' } })
  const unidadLitro = await prisma.unidadMedida.findFirst({ where: { nombre_unidad: 'Litros' } })
  const fabricanteGenerico = await prisma.fabricante.findFirst({ where: { nombre_fabricante: 'Genérico' } })
  const fabricanteToyota = await prisma.fabricante.findFirst({ where: { nombre_fabricante: 'Toyota' } })

  if (!categoriaAceites || !categoriaFrenos || !categoriaMotor || !unidadUnidad || !unidadLitro || !fabricanteGenerico || !fabricanteToyota) {
    throw new Error('Faltan catálogos base de productos. Ejecuta el seed principal.')
  }

  const productos = [
    {
      codigo: 'ACE-5W30-SYNT',
      nombre: 'Aceite sintético 5W-30 (4L)',
      categoria: categoriaAceites.id_categoria,
      fabricante: fabricanteGenerico.id_fabricante,
      unidad: unidadLitro.id_unidad,
      tipo: 'producto',
      descripcion: 'Lubricante premium 5W-30, ideal para motores modernos.',
      stock: 40,
      stock_minimo: 8,
      precio_compra: decimal(95),
      precio_venta: decimal(145)
    },
    {
      codigo: 'FLT-ACE-TOY',
      nombre: 'Filtro de aceite Toyota Genuine',
      categoria: categoriaMotor.id_categoria,
      fabricante: fabricanteToyota.id_fabricante,
      unidad: unidadUnidad.id_unidad,
      tipo: 'producto',
      descripcion: 'Filtro original para motores Toyota serie NZ-FE.',
      stock: 25,
      stock_minimo: 5,
      precio_compra: decimal(32),
      precio_venta: decimal(58)
    },
    {
      codigo: 'PST-FRN-DEL',
      nombre: 'Juego de pastillas de freno delanteras ceramicadas',
      categoria: categoriaFrenos.id_categoria,
      fabricante: fabricanteGenerico.id_fabricante,
      unidad: unidadUnidad.id_unidad,
      tipo: 'producto',
      descripcion: 'Juego de pastillas con sensor de desgaste para sedanes compactos.',
      stock: 18,
      stock_minimo: 4,
      precio_compra: decimal(110),
      precio_venta: decimal(189)
    }
  ]

  const productosCreados: Record<string, ProductoSeedEntry> = {}

  for (const producto of productos) {
    const productoDb = await prisma.producto.upsert({
      where: { codigo_producto: producto.codigo },
      update: {
        id_categoria: producto.categoria,
        id_fabricante: producto.fabricante,
        id_unidad: producto.unidad,
        tipo: producto.tipo,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        stock: producto.stock,
        stock_minimo: producto.stock_minimo,
        precio_compra: producto.precio_compra,
        precio_venta: producto.precio_venta,
        estatus: true
      },
      create: {
        id_categoria: producto.categoria,
        id_fabricante: producto.fabricante,
        id_unidad: producto.unidad,
        tipo: producto.tipo,
        codigo_producto: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        stock: producto.stock,
        stock_minimo: producto.stock_minimo,
        precio_compra: producto.precio_compra,
        precio_venta: producto.precio_venta
      }
    })

    await prisma.inventario.upsert({
      where: { id_producto: productoDb.id_producto },
      update: {
        stock_disponible: decimal(producto.stock),
        stock_comprometido: decimal(0),
        costo_promedio: producto.precio_compra
      },
      create: {
        id_producto: productoDb.id_producto,
        stock_disponible: decimal(producto.stock),
        stock_comprometido: decimal(0),
        costo_promedio: producto.precio_compra
      }
    })

    const inventarioProducto = await prisma.inventarioProducto.upsert({
      where: {
        id_producto_id_almacen_id_almacen_ubicacion: {
          id_producto: productoDb.id_producto,
          id_almacen: almacenCentral.id_almacen,
          id_almacen_ubicacion: ubicacionPrincipal.id_almacen_ubicacion
        }
      },
      update: {
        stock_disponible: decimal(producto.stock),
        stock_comprometido: decimal(0),
        stock_minimo: decimal(producto.stock_minimo),
        costo_promedio: producto.precio_compra
      },
      create: {
        id_producto: productoDb.id_producto,
        id_almacen: almacenCentral.id_almacen,
        id_almacen_ubicacion: ubicacionPrincipal.id_almacen_ubicacion,
        stock_disponible: decimal(producto.stock),
        stock_comprometido: decimal(0),
        stock_minimo: decimal(producto.stock_minimo),
        costo_promedio: producto.precio_compra
      }
    })

    const ingresoPrevio = await prisma.movimientoInventario.findFirst({
      where: {
        referencia_origen: 'Seed inicial',
        id_producto: productoDb.id_producto,
        tipo: MovimientoTipo.INGRESO
      }
    })

    if (!ingresoPrevio) {
      await prisma.movimientoInventario.create({
        data: {
          tipo: MovimientoTipo.INGRESO,
          id_producto: productoDb.id_producto,
          id_inventario_producto: inventarioProducto.id_inventario_producto,
          cantidad: decimal(producto.stock),
          costo_unitario: producto.precio_compra,
          referencia_origen: 'Seed inicial',
          origen_tipo: MovimientoOrigen.COMPRA,
          observaciones: 'Carga inicial automatizada',
          id_usuario: adminUserId
        }
      })
    }

    productosCreados[producto.codigo] = {
      idProducto: productoDb.id_producto,
      inventarioProductoId: inventarioProducto.id_inventario_producto
    }
  }

  return productosCreados
}

async function crearCompraInicial(adminUserId: number, productos: Record<string, ProductoSeedEntry>) {
  const proveedor = await prisma.proveedor.findFirst({ where: { razon_social: 'Proveedor Aceites SAC' } })
  if (!proveedor) {
    console.warn('Proveedor demo no encontrado; omitiendo compra inicial')
    return null
  }

  const fechaCompra = new Date('2025-10-01T10:00:00Z')

  const compraExistente = await prisma.compra.findFirst({
    where: {
      id_proveedor: proveedor.id_proveedor,
      creado_por: adminUserId,
      fecha: fechaCompra
    }
  })

  const compra = compraExistente
    ? await prisma.compra.update({
        where: { id_compra: compraExistente.id_compra },
        data: {
          total: decimal(1425),
          estado: 'RECIBIDO'
        }
      })
    : await prisma.compra.create({
        data: {
          id_proveedor: proveedor.id_proveedor,
          fecha: fechaCompra,
          total: decimal(1425),
          creado_por: adminUserId,
          estado: 'RECIBIDO'
        }
      })

  await prisma.compraDetalle.deleteMany({ where: { id_compra: compra.id_compra } })

  await prisma.compraDetalle.createMany({
    data: [
      {
        id_compra: compra.id_compra,
        id_producto: productos['ACE-5W30-SYNT'].idProducto,
        cantidad: decimal(10),
        precio_unitario: decimal(95),
        subtotal: decimal(950)
      },
      {
        id_compra: compra.id_compra,
        id_producto: productos['FLT-ACE-TOY'].idProducto,
        cantidad: decimal(5),
        precio_unitario: decimal(32),
        subtotal: decimal(160)
      },
      {
        id_compra: compra.id_compra,
        id_producto: productos['PST-FRN-DEL'].idProducto,
        cantidad: decimal(2.5),
        precio_unitario: decimal(110),
        subtotal: decimal(275)
      }
    ]
  })

  return compra
}

async function crearCotizacionOrdenYVenta(
  adminUserId: number,
  trabajadores: Record<string, number>,
  clientes: Record<string, ClienteSeedEntry>,
  productos: Record<string, ProductoSeedEntry>,
  servicios: Record<string, number>
) {
  const cliente = clientes['45678901']
  const vehiculoPlaca = cliente.vehiculos['D3K-218']
  if (!cliente || !vehiculoPlaca) {
    throw new Error('No se encontró el cliente demo esperado.')
  }

  const subtotal = decimal(145 + 58 + 180)
  const igv = subtotal.mul(0.18)
  const total = subtotal.add(igv)

  const cotizacion = await prisma.cotizacion.upsert({
    where: { codigo_cotizacion: 'COT-2025-0001' },
    update: {
      id_cliente: cliente.idCliente,
      id_vehiculo: vehiculoPlaca,
      id_usuario: adminUserId,
      estado: 'aprobada',
      subtotal,
      descuento_global: decimal(0),
      impuesto: igv,
      total,
      fecha_aprobacion: new Date(),
      aprobado_por: 'cliente_presencial'
    },
    create: {
      codigo_cotizacion: 'COT-2025-0001',
      id_cliente: cliente.idCliente,
      id_vehiculo: vehiculoPlaca,
      id_usuario: adminUserId,
      estado: 'aprobada',
      vigencia_hasta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subtotal,
      descuento_global: decimal(0),
      impuesto: igv,
      total,
      fecha_aprobacion: new Date(),
      aprobado_por: 'cliente_presencial'
    }
  })

  await prisma.detalleCotizacion.deleteMany({ where: { id_cotizacion: cotizacion.id_cotizacion } })

  await prisma.detalleCotizacion.createMany({
    data: [
      {
        id_cotizacion: cotizacion.id_cotizacion,
        id_servicio: servicios['SERV-MTTO-ACEITE'],
        cantidad: 1,
        precio_unitario: decimal(180),
        descuento: decimal(0),
        total: decimal(180)
      },
      {
        id_cotizacion: cotizacion.id_cotizacion,
        id_producto: productos['ACE-5W30-SYNT'].idProducto,
        cantidad: 1,
        precio_unitario: decimal(145),
        descuento: decimal(0),
        total: decimal(145)
      },
      {
        id_cotizacion: cotizacion.id_cotizacion,
        id_producto: productos['FLT-ACE-TOY'].idProducto,
        cantidad: 1,
        precio_unitario: decimal(58),
        descuento: decimal(0),
        total: decimal(58)
      }
    ]
  })

  const orden = await prisma.transaccion.upsert({
    where: { codigo_transaccion: 'OT-2025-0001' },
    update: {
      id_persona: cliente.idPersona,
      id_usuario: adminUserId,
      id_trabajador_principal: trabajadores['MEC-101'],
      tipo_transaccion: 'orden',
      tipo_comprobante: 'OT',
      estado_orden: 'en_proceso',
      prioridad: 'alta',
      fecha_inicio: new Date(),
      fecha_fin_estimada: new Date(Date.now() + 4 * 60 * 60 * 1000),
      descuento: decimal(0),
      impuesto: igv,
      total,
      cantidad_pago: decimal(0),
      observaciones: 'Orden generada a partir de la cotización COT-2025-0001',
      estado_pago: 'pendiente'
    },
    create: {
      id_persona: cliente.idPersona,
      id_usuario: adminUserId,
      id_trabajador_principal: trabajadores['MEC-101'],
      tipo_transaccion: 'orden',
      tipo_comprobante: 'OT',
      codigo_transaccion: 'OT-2025-0001',
      estado_orden: 'en_proceso',
      prioridad: 'alta',
      fecha_inicio: new Date(),
      fecha_fin_estimada: new Date(Date.now() + 4 * 60 * 60 * 1000),
      descuento: decimal(0),
      impuesto: igv,
      total,
      cantidad_pago: decimal(0),
      observaciones: 'Orden generada a partir de la cotización COT-2025-0001',
      estado_pago: 'pendiente'
    }
  })

  await prisma.transaccionVehiculo.upsert({
    where: { id_transaccion_id_vehiculo: { id_transaccion: orden.id_transaccion, id_vehiculo: vehiculoPlaca } },
    update: {
      id_usuario: adminUserId,
      nivel_combustible: '3/4',
      kilometraje_millas: 31500
    },
    create: {
      id_transaccion: orden.id_transaccion,
      id_vehiculo: vehiculoPlaca,
      id_usuario: adminUserId,
      nivel_combustible: '3/4',
      kilometraje_millas: 31500
    }
  })

  await prisma.transaccionTrabajador.createMany({
    data: [
      {
        id_transaccion: orden.id_transaccion,
        id_trabajador: trabajadores['MEC-102'],
        rol: 'Asistente'
      },
      {
        id_transaccion: orden.id_transaccion,
        id_trabajador: trabajadores['AYU-203'],
        rol: 'Apoyo'
      }
    ],
    skipDuplicates: true
  })

  const existingDetalles = await prisma.detalleTransaccion.findMany({
    where: { id_transaccion: orden.id_transaccion },
    select: { id_detalle_transaccion: true }
  })
  const detalleIds = existingDetalles.map((d) => d.id_detalle_transaccion)
  if (detalleIds.length > 0) {
    await prisma.tarea.deleteMany({ where: { id_detalle_transaccion: { in: detalleIds } } })
  }
  await prisma.detalleTransaccion.deleteMany({ where: { id_transaccion: orden.id_transaccion } })

  const detalleServicio = await prisma.detalleTransaccion.create({
    data: {
      id_transaccion: orden.id_transaccion,
      id_servicio: servicios['SERV-MTTO-ACEITE'],
      cantidad: 1,
      precio: decimal(180),
      total: decimal(180)
    }
  })

  const detalleAceite = await prisma.detalleTransaccion.create({
    data: {
      id_transaccion: orden.id_transaccion,
      id_producto: productos['ACE-5W30-SYNT'].idProducto,
      cantidad: 1,
      precio: decimal(145),
      total: decimal(145),
      id_detalle_servicio_asociado: detalleServicio.id_detalle_transaccion
    }
  })

  const detalleFiltro = await prisma.detalleTransaccion.create({
    data: {
      id_transaccion: orden.id_transaccion,
      id_producto: productos['FLT-ACE-TOY'].idProducto,
      cantidad: 1,
      precio: decimal(58),
      total: decimal(58)
    }
  })

  await prisma.tarea.create({
    data: {
      id_detalle_transaccion: detalleServicio.id_detalle_transaccion,
      id_trabajador: trabajadores['MEC-101'],
      estado: 'en_proceso',
      fecha_inicio: new Date(),
      tiempo_estimado: 120,
      notas_trabajador: 'Verificar fugas antes de entregar.'
    }
  })

  await prisma.movimientoInventario.deleteMany({ where: { referencia_origen: 'Consumo OT-2025-0001' } })

  await prisma.movimientoInventario.createMany({
    data: [
      {
        tipo: MovimientoTipo.SALIDA,
        id_producto: productos['ACE-5W30-SYNT'].idProducto,
        id_inventario_producto: productos['ACE-5W30-SYNT'].inventarioProductoId,
        cantidad: decimal(1),
        costo_unitario: decimal(95),
        referencia_origen: 'Consumo OT-2025-0001',
        origen_tipo: MovimientoOrigen.ORDEN_TRABAJO,
        observaciones: 'Consumo de aceite en servicio',
        id_usuario: adminUserId
      },
      {
        tipo: MovimientoTipo.SALIDA,
        id_producto: productos['FLT-ACE-TOY'].idProducto,
        id_inventario_producto: productos['FLT-ACE-TOY'].inventarioProductoId,
        cantidad: decimal(1),
        costo_unitario: decimal(32),
        referencia_origen: 'Consumo OT-2025-0001',
        origen_tipo: MovimientoOrigen.ORDEN_TRABAJO,
        observaciones: 'Filtro reemplazado',
        id_usuario: adminUserId
      }
    ]
  })

  await prisma.pago.deleteMany({ where: { id_transaccion: orden.id_transaccion } })

  await prisma.pago.create({
    data: {
      id_transaccion: orden.id_transaccion,
      tipo_pago: 'tarjeta',
      monto: total.mul(0.5),
      numero_operacion: 'POS-785421',
      registrado_por: adminUserId,
      observaciones: 'Pago parcial con tarjeta VISA'
    }
  })

  const serieBoleta = await prisma.facturacionSerie.findFirst({ where: { tipo: TipoComprobante.BOLETA, serie: 'B001' } })

  let correlativo = 1
  if (serieBoleta) {
    const ultimo = await prisma.comprobante.findFirst({
      where: { serie: 'B001' },
      orderBy: { numero: 'desc' }
    })
    correlativo = (ultimo?.numero ?? 0) + 1
  }

  const persona = await prisma.persona.findUniqueOrThrow({ where: { id_persona: cliente.idPersona } })

  const comprobante = await prisma.comprobante.upsert({
    where: { origen_tipo_origen_id: { origen_tipo: OrigenComprobante.ORDEN, origen_id: orden.id_transaccion } },
    update: {
      subtotal,
      igv,
      total,
      estado: EstadoComprobante.EMITIDO,
      estado_pago: 'pagado',
      fecha_emision: new Date(),
      numero: correlativo,
      serie: 'B001',
      receptor_nombre: `${persona.nombre} ${persona.apellido_paterno}`.trim(),
      receptor_documento: persona.numero_documento,
      creado_por: adminUserId
    },
    create: {
      tipo: TipoComprobante.BOLETA,
      serie: 'B001',
      numero: correlativo,
      origen_tipo: OrigenComprobante.ORDEN,
      origen_id: orden.id_transaccion,
      estado_pago: 'pagado',
      estado: EstadoComprobante.EMITIDO,
      subtotal,
      igv,
      total,
      receptor_nombre: `${persona.nombre} ${persona.apellido_paterno}`.trim(),
      receptor_documento: persona.numero_documento,
      descripcion: 'Servicios de mantenimiento correctivo',
      precios_incluyen_igv: true,
      fecha_emision: new Date(),
      creado_por: adminUserId,
      id_persona: cliente.idPersona,
      id_cliente: cliente.idCliente,
      id_transaccion: orden.id_transaccion
    }
  })

  await prisma.comprobanteDetalle.deleteMany({ where: { id_comprobante: comprobante.id_comprobante } })

  await prisma.comprobanteDetalle.createMany({
    data: [
      {
        id_comprobante: comprobante.id_comprobante,
        tipo_item: TipoItemComprobante.SERVICIO,
        descripcion: 'Cambio de aceite y filtro sintético 5W-30',
        cantidad: decimal(1),
        unidad_medida: 'SERV',
        precio_unitario: decimal(180),
        descuento: decimal(0),
        subtotal: decimal(180),
        igv: decimal(32.4),
        total: decimal(212.4),
        id_servicio: servicios['SERV-MTTO-ACEITE']
      },
      {
        id_comprobante: comprobante.id_comprobante,
        tipo_item: TipoItemComprobante.PRODUCTO,
        descripcion: 'Aceite sintético 5W-30 (4L)',
        cantidad: decimal(1),
        unidad_medida: 'UND',
        precio_unitario: decimal(145),
        descuento: decimal(0),
        subtotal: decimal(145),
        igv: decimal(26.1),
        total: decimal(171.1),
        id_producto: productos['ACE-5W30-SYNT'].idProducto
      },
      {
        id_comprobante: comprobante.id_comprobante,
        tipo_item: TipoItemComprobante.PRODUCTO,
        descripcion: 'Filtro de aceite Toyota Genuine',
        cantidad: decimal(1),
        unidad_medida: 'UND',
        precio_unitario: decimal(58),
        descuento: decimal(0),
        subtotal: decimal(58),
        igv: decimal(10.44),
        total: decimal(68.44),
        id_producto: productos['FLT-ACE-TOY'].idProducto
      }
    ]
  })

  const venta = await prisma.venta.upsert({
    where: { id_comprobante: comprobante.id_comprobante },
    update: {
      total,
      total_pagado: total,
      saldo: decimal(0),
      estado_pago: EstadoPagoVenta.pagado,
      metodo_principal: MetodoPagoVenta.TARJETA
    },
    create: {
      id_comprobante: comprobante.id_comprobante,
      total,
      total_pagado: total,
      saldo: decimal(0),
      estado_pago: EstadoPagoVenta.pagado,
      metodo_principal: MetodoPagoVenta.TARJETA
    }
  })

  await prisma.ventaPago.deleteMany({ where: { id_venta: venta.id_venta } })

  await prisma.ventaPago.create({
    data: {
      id_venta: venta.id_venta,
      metodo: MetodoPagoVenta.TARJETA,
      monto: total,
      referencia: 'POS-785421',
      registrado_por: adminUserId
    }
  })

  const feedbackExistente = await prisma.feedback.findFirst({ where: { orden_id: orden.id_transaccion } })

  if (feedbackExistente) {
    await prisma.feedback.update({
      where: { id_feedback: feedbackExistente.id_feedback },
      data: {
        score: 5,
        comentario: 'Excelente atención y explicación detallada del trabajo realizado.'
      }
    })
  } else {
    await prisma.feedback.create({
      data: {
        orden_id: orden.id_transaccion,
        score: 5,
        comentario: 'Excelente atención y explicación detallada del trabajo realizado.'
      }
    })
  }

  return { cotizacion, orden, comprobante, venta, detalles: { detalleServicio, detalleAceite, detalleFiltro } }
}

async function crearMantenimientoPreventivo(adminUserId: number, clientes: Record<string, ClienteSeedEntry>) {
  const cliente = clientes['49876543']
  if (!cliente) return null

  const vehiculoId = Object.values(cliente.vehiculos)[0]

  const mantenimiento = await prisma.mantenimiento.upsert({
    where: { codigo: 'MTTO-2025-0001' },
    update: {
      id_cliente: cliente.idCliente,
      id_vehiculo: vehiculoId,
      titulo: 'Mantenimiento preventivo 30,000 km',
      descripcion: 'Cambio de aceite, filtro de aire y revisión de frenos.',
      prioridad: 'media',
      fecha_programada: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    },
    create: {
      codigo: 'MTTO-2025-0001',
      id_cliente: cliente.idCliente,
      id_vehiculo: vehiculoId,
      titulo: 'Mantenimiento preventivo 30,000 km',
      descripcion: 'Cambio de aceite, filtro de aire y revisión de frenos.',
      prioridad: 'media',
      fecha_programada: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    }
  })

  await prisma.mantenimientoHistorial.create({
    data: {
      mantenimiento_id: mantenimiento.id_mantenimiento,
      old_fecha: null,
      new_fecha: mantenimiento.fecha_programada,
      reason: 'Agenda inicial desde seed',
      changed_by: adminUserId
    }
  })

  return mantenimiento
}

type ClienteSeedEntry = {
  idCliente: number
  idPersona: number
  vehiculos: Record<string, number>
}

type ProductoSeedEntry = {
  idProducto: number
  inventarioProductoId: number
}

type ActividadResumen = {
  ordenes: number
  comprobantes: number
  ventas: number
}

async function crearActividadMensualDemo(
  adminUserId: number,
  trabajadores: Record<string, number>,
  clientes: Record<string, ClienteSeedEntry>,
  productos: Record<string, ProductoSeedEntry>,
  servicios: Record<string, number>
): Promise<ActividadResumen> {
  const trabajadorIds = Object.values(trabajadores)
  if (trabajadorIds.length < 2) {
    console.warn('No hay suficientes trabajadores activos para poblar actividad demo.')
    return { ordenes: 0, comprobantes: 0, ventas: 0 }
  }

  const clienteEntries = Object.values(clientes).filter((cliente) => Object.keys(cliente.vehiculos).length > 0)
  if (clienteEntries.length === 0) {
    console.warn('No hay clientes con vehículos para generar actividad demo.')
    return { ordenes: 0, comprobantes: 0, ventas: 0 }
  }

  const personaRecords = await prisma.persona.findMany({
    where: { id_persona: { in: clienteEntries.map((c) => c.idPersona) } },
    select: { id_persona: true, nombre: true, apellido_paterno: true, apellido_materno: true, numero_documento: true, direccion: true }
  })
  const personaMap = new Map(personaRecords.map((persona) => [persona.id_persona, persona]))

  const servicioRecords = await prisma.servicio.findMany({
    where: { id_servicio: { in: Object.values(servicios) } },
    select: {
      id_servicio: true,
      codigo_servicio: true,
      nombre: true,
      precio_base: true,
      tiempo_minimo: true,
      tiempo_maximo: true
    }
  })
  if (servicioRecords.length === 0) {
    console.warn('No hay servicios disponibles para generar actividad demo.')
    return { ordenes: 0, comprobantes: 0, ventas: 0 }
  }

  const productoMetaById = new Map(
    Object.values(productos).map((producto) => [producto.idProducto, producto.inventarioProductoId])
  )

  const productoRecords = await prisma.producto.findMany({
    where: { id_producto: { in: Array.from(productoMetaById.keys()) } },
    select: {
      id_producto: true,
      codigo_producto: true,
      nombre: true,
      precio_venta: true,
      precio_compra: true
    }
  })

  if (productoRecords.length === 0) {
    console.warn('No hay productos con inventario para generar actividad demo.')
    return { ordenes: 0, comprobantes: 0, ventas: 0 }
  }

  const inventarioRecords = await prisma.inventarioProducto.findMany({
    where: { id_inventario_producto: { in: Array.from(productoMetaById.values()) } },
    select: { id_inventario_producto: true, costo_promedio: true }
  })
  const inventarioMap = new Map(inventarioRecords.map((item) => [item.id_inventario_producto, item]))

  const productoPool = productoRecords
    .map((producto) => {
      const inventarioProductoId = productoMetaById.get(producto.id_producto)
      if (!inventarioProductoId) return null
      const inventarioInfo = inventarioMap.get(inventarioProductoId)
      return {
        ...producto,
        inventarioProductoId,
        costo_promedio: inventarioInfo?.costo_promedio ?? producto.precio_compra
      }
    })
    .filter(Boolean) as Array<
    typeof productoRecords[number] & {
      inventarioProductoId: number
      costo_promedio: Prisma.Decimal
    }
  >

  if (productoPool.length === 0) {
    console.warn('No se encontró inventario disponible para los productos demo.')
    return { ordenes: 0, comprobantes: 0, ventas: 0 }
  }

  type EscenarioConfig = {
    estadoOrden: string
    ventaEstado: EstadoPagoVenta | null
    metodo?: MetodoPagoVenta
  }

  const escenarios: EscenarioConfig[] = [
    { estadoOrden: 'completado', ventaEstado: EstadoPagoVenta.pagado, metodo: MetodoPagoVenta.TARJETA },
    { estadoOrden: 'completado', ventaEstado: EstadoPagoVenta.parcial, metodo: MetodoPagoVenta.TRANSFERENCIA },
    { estadoOrden: 'en_proceso', ventaEstado: null },
    { estadoOrden: 'pendiente', ventaEstado: null },
    { estadoOrden: 'por_hacer', ventaEstado: null },
    { estadoOrden: 'completado', ventaEstado: EstadoPagoVenta.pendiente, metodo: MetodoPagoVenta.EFECTIVO }
  ]

  const ultimaBoleta = await prisma.comprobante.findFirst({
    where: { tipo: TipoComprobante.BOLETA, serie: 'B001' },
    orderBy: { numero: 'desc' }
  })
  let siguienteBoleta = (ultimaBoleta?.numero ?? 0) + 1

  const totalOrdenes = Math.min(24, clienteEntries.length * 6)
  const ahora = new Date()
  const inicioVentana = ahora.getTime() - DAY_IN_MS * 26
  const separacion = (DAY_IN_MS * 24) / Math.max(totalOrdenes, 1)

  let ordenesCreadas = 0
  let comprobantesCreados = 0
  let ventasCreadas = 0

  for (let i = 0; i < totalOrdenes; i++) {
    const escenario = escenarios[i % escenarios.length]
    const cliente = clienteEntries[i % clienteEntries.length]
    const persona = personaMap.get(cliente.idPersona)
    if (!persona) continue

    const vehiculos = Object.values(cliente.vehiculos)
    if (vehiculos.length === 0) continue

    const principalId = trabajadorIds[i % trabajadorIds.length]
    const asistenteId = trabajadorIds[(i + 1) % trabajadorIds.length]
    const servicio = servicioRecords[i % servicioRecords.length]
    const producto = productoPool[i % productoPool.length]

    const productQty = escenario.estadoOrden === 'completado' && i % 3 === 0 ? 2 : 1
    const servicePrice = Number(servicio.precio_base.toString())
    const productPrice = Number(producto.precio_venta.toString())
    const productCost = Number(producto.costo_promedio.toString())

    const subtotalBase = clampDecimals(servicePrice + productPrice * productQty)
    const igv = clampDecimals(subtotalBase * 0.18)
    const total = clampDecimals(subtotalBase + igv)

    const ventaEstado = escenario.ventaEstado
    const paidAmount =
      ventaEstado === EstadoPagoVenta.pagado
        ? total
        : ventaEstado === EstadoPagoVenta.parcial
          ? clampDecimals(total * 0.55)
          : 0
    const saldo = clampDecimals(total - paidAmount)

    const estadoPagoOrden = paidAmount >= total ? 'pagado' : paidAmount > 0 ? 'parcial' : 'pendiente'

    let fechaBase = new Date(inicioVentana + i * separacion + Math.floor(Math.random() * 4 * 60 * 60 * 1000))
    if (escenario.estadoOrden === 'por_hacer') {
      const futurosDias = (i % 4) + 1
      fechaBase = new Date(ahora.getTime() + futurosDias * DAY_IN_MS)
    }

    const estimadoMinutos = servicio.tiempo_maximo ?? 120
    const realMinutos = servicio.tiempo_minimo ?? 90
    const fechaFinEstimada = addMinutes(fechaBase, estimadoMinutos)
    const fechaFinReal = escenario.estadoOrden === 'completado' ? addMinutes(fechaBase, realMinutos) : null

    const codigoOrden = `OT-DEMO-${RUN_TAG}-${String(i + 1).padStart(3, '0')}`
    const prioridad = ['alta', 'media', 'baja'][i % 3]

    const orden = await prisma.transaccion.create({
      data: {
        id_persona: cliente.idPersona,
        id_usuario: adminUserId,
        id_trabajador_principal: principalId,
        tipo_transaccion: 'orden',
        tipo_comprobante: 'OT',
        codigo_transaccion: codigoOrden,
        fecha: fechaBase,
        fecha_inicio: fechaBase,
        fecha_fin_estimada: fechaFinEstimada,
        fecha_fin_real: fechaFinReal,
        fecha_cierre: fechaFinReal,
        estado_orden: escenario.estadoOrden,
        prioridad,
        descuento: decimal(0),
        impuesto: decimal(igv),
        total: decimal(total),
        cantidad_pago: decimal(paidAmount),
        observaciones: `Orden demo para ${servicio.nombre}`,
        estado_pago: estadoPagoOrden,
        fecha_entrega: fechaFinReal
      }
    })

    ordenesCreadas += 1

    await prisma.transaccionVehiculo.create({
      data: {
        id_transaccion: orden.id_transaccion,
        id_vehiculo: vehiculos[i % vehiculos.length],
        id_usuario: adminUserId,
        nivel_combustible: randomFrom(['1/4', '1/2', '3/4', 'Full']),
        kilometraje_millas: 25000 + i * 320 + Math.floor(Math.random() * 150)
      }
    })

    await prisma.transaccionTrabajador.createMany({
      data: [
        {
          id_transaccion: orden.id_transaccion,
          id_trabajador: principalId,
          rol: 'Principal',
          asignado_en: fechaBase
        },
        {
          id_transaccion: orden.id_transaccion,
          id_trabajador: asistenteId,
          rol: 'Asistente',
          asignado_en: fechaBase
        }
      ]
    })

    const detalleServicio = await prisma.detalleTransaccion.create({
      data: {
        id_transaccion: orden.id_transaccion,
        id_servicio: servicio.id_servicio,
        cantidad: 1,
        precio: decimal(servicePrice),
        descuento: decimal(0),
        total: decimal(servicePrice)
      }
    })

    await prisma.detalleTransaccion.create({
      data: {
        id_transaccion: orden.id_transaccion,
        id_producto: producto.id_producto,
        cantidad: productQty,
        precio: decimal(productPrice),
        descuento: decimal(0),
        total: decimal(productPrice * productQty),
        id_detalle_servicio_asociado: detalleServicio.id_detalle_transaccion
      }
    })

    await prisma.tarea.create({
      data: {
        id_detalle_transaccion: detalleServicio.id_detalle_transaccion,
        id_trabajador: principalId,
        estado: escenario.estadoOrden === 'completado' ? 'completado' : escenario.estadoOrden === 'pendiente' ? 'pendiente' : 'en_proceso',
        fecha_inicio: fechaBase,
        fecha_fin: fechaFinReal ?? undefined,
        tiempo_estimado: estimadoMinutos,
        tiempo_real: fechaFinReal ? realMinutos : null,
        notas_trabajador: `Checklist completado (${servicio.codigo_servicio})`
      }
    })

    await prisma.movimientoInventario.create({
      data: {
        tipo: MovimientoTipo.SALIDA,
        id_producto: producto.id_producto,
        id_inventario_producto: producto.inventarioProductoId,
        cantidad: decimal(productQty),
        costo_unitario: decimal(productCost),
        referencia_origen: `Consumo ${codigoOrden}`,
        origen_tipo: MovimientoOrigen.ORDEN_TRABAJO,
        observaciones: 'Consumo automático demo',
        id_usuario: adminUserId,
        fecha: fechaBase
      }
    })

    try {
      await prisma.inventarioProducto.update({
        where: { id_inventario_producto: producto.inventarioProductoId },
        data: {
          stock_disponible: {
            decrement: decimal(productQty)
          }
        }
      })
    } catch (error) {
      console.warn('No se pudo actualizar el stock para', producto.codigo_producto, error)
    }

    await prisma.bitacora.create({
      data: {
        id_usuario: adminUserId,
        accion: 'DEMO_ORDEN',
        descripcion: `Orden ${codigoOrden} generada para ${formatNombrePersona(persona)}`,
        tabla: 'orden'
      }
    })

    if (ventaEstado) {
      const receptorNombre = formatNombrePersona(persona)
      const comprobante = await prisma.comprobante.create({
        data: {
          tipo: TipoComprobante.BOLETA,
          serie: 'B001',
          numero: siguienteBoleta++,
          origen_tipo: OrigenComprobante.ORDEN,
          origen_id: orden.id_transaccion,
          estado_pago: ventaEstado === EstadoPagoVenta.pagado ? 'pagado' : ventaEstado === EstadoPagoVenta.parcial ? 'parcial' : 'pendiente',
          estado: EstadoComprobante.EMITIDO,
          subtotal: decimal(subtotalBase),
          igv: decimal(igv),
          total: decimal(total),
          receptor_nombre: receptorNombre,
          receptor_documento: persona.numero_documento ?? '00000000',
          receptor_direccion: persona.direccion ?? 'Dirección no registrada',
          descripcion: servicio.nombre,
          precios_incluyen_igv: true,
          fecha_emision: fechaFinReal ?? fechaFinEstimada,
          creado_por: adminUserId,
          id_persona: cliente.idPersona,
          id_cliente: cliente.idCliente,
          id_transaccion: orden.id_transaccion
        }
      })

      comprobantesCreados += 1

      const serviceIgv = clampDecimals(servicePrice * 0.18)
      const productSubtotal = clampDecimals(productPrice * productQty)
      const productIgv = clampDecimals(productSubtotal * 0.18)

      await prisma.comprobanteDetalle.createMany({
        data: [
          {
            id_comprobante: comprobante.id_comprobante,
            tipo_item: TipoItemComprobante.SERVICIO,
            descripcion: servicio.nombre,
            cantidad: decimal(1),
            unidad_medida: 'SERV',
            precio_unitario: decimal(servicePrice),
            descuento: decimal(0),
            subtotal: decimal(servicePrice),
            igv: decimal(serviceIgv),
            total: decimal(servicePrice + serviceIgv),
            id_servicio: servicio.id_servicio
          },
          {
            id_comprobante: comprobante.id_comprobante,
            tipo_item: TipoItemComprobante.PRODUCTO,
            descripcion: producto.nombre,
            cantidad: decimal(productQty),
            unidad_medida: 'UND',
            precio_unitario: decimal(productPrice),
            descuento: decimal(0),
            subtotal: decimal(productSubtotal),
            igv: decimal(productIgv),
            total: decimal(productSubtotal + productIgv),
            id_producto: producto.id_producto
          }
        ]
      })

      const venta = await prisma.venta.create({
        data: {
          id_comprobante: comprobante.id_comprobante,
          fecha: fechaFinReal ?? fechaBase,
          total: decimal(total),
          total_pagado: decimal(paidAmount),
          saldo: decimal(saldo),
          metodo_principal: escenario.metodo ?? MetodoPagoVenta.EFECTIVO,
          estado_pago: ventaEstado
        }
      })

      ventasCreadas += 1

      if (paidAmount > 0) {
        const referencia = escenario.metodo === MetodoPagoVenta.TRANSFERENCIA ? `TRX-${RUN_TAG}-${i + 1}` : `POS-${RUN_TAG}-${i + 1}`
        await prisma.ventaPago.create({
          data: {
            id_venta: venta.id_venta,
            metodo: escenario.metodo ?? MetodoPagoVenta.EFECTIVO,
            monto: decimal(paidAmount),
            referencia,
            registrado_por: adminUserId,
            fecha_pago: fechaFinReal ?? fechaBase,
            notas: ventaEstado === EstadoPagoVenta.parcial ? 'Abono parcial demo' : 'Pago completo demo'
          }
        })

        await prisma.pago.create({
          data: {
            id_transaccion: orden.id_transaccion,
            tipo_pago: (escenario.metodo ?? MetodoPagoVenta.EFECTIVO).toLowerCase(),
            monto: decimal(paidAmount),
            numero_operacion: referencia,
            registrado_por: adminUserId,
            fecha_pago: fechaFinReal ?? fechaBase,
            observaciones: ventaEstado === EstadoPagoVenta.parcial ? 'Abono parcial registrado' : 'Pago completado'
          }
        })
      }

      await prisma.bitacora.create({
        data: {
          id_usuario: adminUserId,
          accion: 'DEMO_COMPROBANTE',
          descripcion: `Comprobante ${comprobante.serie}-${comprobante.numero} para ${codigoOrden}`,
          tabla: 'comprobante'
        }
      })
    }

    if (escenario.estadoOrden === 'completado' && i % 2 === 0) {
      await prisma.feedback.create({
        data: {
          orden_id: orden.id_transaccion,
          score: 4 + (i % 2),
          comentario: 'Servicio ágil y comunicación constante (demo).'
        }
      })
    }
  }

  return { ordenes: ordenesCreadas, comprobantes: comprobantesCreados, ventas: ventasCreadas }
}

async function main() {
  console.log('🚀 Creando dataset integral de demostración...')

  const adminUser = await prisma.usuario.findFirst({
    where: { nombre_usuario: { in: ['admin.pruebas', 'admin'] } },
    orderBy: { id_usuario: 'asc' }
  })

  if (!adminUser) {
    throw new Error('Debe existir al menos un usuario administrador (admin o admin.pruebas).')
  }

  const trabajadores = await ensureTrabajadores(adminUser.id_usuario)
  console.log('👷‍♂️ Trabajadores registrados:', Object.keys(trabajadores).length)

  const clientes = await ensureClientes()
  console.log('👥 Clientes registrados:', Object.keys(clientes).length)

  const servicios = await ensureServicios()
  console.log('🛠️ Servicios registrados:', Object.keys(servicios).length)

  const productos = await ensureProductos(adminUser.id_usuario)
  console.log('📦 Productos registrados:', Object.keys(productos).length)

  await crearCompraInicial(adminUser.id_usuario, productos)
  console.log('🧾 Compra inicial registrada')

  const { orden } = await crearCotizacionOrdenYVenta(adminUser.id_usuario, trabajadores, clientes, productos, servicios)
  console.log(`📄 Cotización y orden enlazadas: ${orden.codigo_transaccion}`)

  await crearMantenimientoPreventivo(adminUser.id_usuario, clientes)
  console.log('🗓️ Mantenimiento preventivo programado')

  const actividadMensual = await crearActividadMensualDemo(adminUser.id_usuario, trabajadores, clientes, productos, servicios)
  console.log(
    `📊 Actividad mensual: ${actividadMensual.ordenes} órdenes, ${actividadMensual.comprobantes} comprobantes, ${actividadMensual.ventas} ventas`
  )

  console.log('✅ Dataset de demostración listo. Puedes iniciar sesión como admin.pruebas / Admin123!')
}

main()
  .catch((error) => {
    console.error('❌ Error generando dataset de demostración:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
