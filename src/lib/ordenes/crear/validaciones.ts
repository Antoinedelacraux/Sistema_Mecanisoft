import type { PrismaClient } from '@prisma/client'

import { OrdenServiceError } from '../errors'
import { convertirATotalMinutos, toInt } from '../helpers'
import type { CrearOrdenInput } from '../validators'
import type { ItemValidado, ContextoValidacion, CatalogosCargados, ClienteConPersona, VehiculoConModelo } from './types'

async function cargarCatalogos(prisma: PrismaClient, itemIds: number[]): Promise<CatalogosCargados> {
  const [productos, servicios] = await Promise.all([
    prisma.producto.findMany({ where: { id_producto: { in: itemIds } } }),
    prisma.servicio.findMany({ where: { id_servicio: { in: itemIds } } }),
  ])

  return {
    productos: new Map(productos.map((p) => [p.id_producto, p])),
    servicios: new Map(servicios.map((s) => [s.id_servicio, s])),
  }
}

function asegurarCliente(datosCliente: { estatus: boolean } | null): asserts datosCliente is NonNullable<typeof datosCliente> {
  if (!datosCliente || !datosCliente.estatus) {
    throw new OrdenServiceError(400, 'El cliente no existe o está inactivo')
  }
}

function asegurarVehiculo<T extends { id_cliente: number }>(datosVehiculo: T | null, idCliente: number): asserts datosVehiculo is T {
  if (!datosVehiculo || datosVehiculo.id_cliente !== idCliente) {
    throw new OrdenServiceError(400, 'El vehículo no pertenece al cliente seleccionado')
  }
}

function asegurarTrabajadorDisponible(trabajador: { activo: boolean } | null) {
  if (!trabajador || !trabajador.activo) {
    throw new OrdenServiceError(400, 'El trabajador seleccionado no está disponible')
  }
}

function asegurarAlmacenPrincipal(almacen: { id_almacen: number } | null): asserts almacen is { id_almacen: number } {
  if (!almacen) {
    throw new OrdenServiceError(409, 'No hay almacenes activos configurados')
  }
}

function validarItem(
  raw: CrearOrdenInput['items'][number],
  modoSoloServicios: boolean,
  catalogos: CatalogosCargados,
  almacenReservaId: number,
): ItemValidado {
  if (modoSoloServicios && raw.tipo === 'producto') {
    throw new OrdenServiceError(400, 'Modo Solo servicios activo: no se permiten productos en la orden.')
  }

  const idItem = toInt(raw.id_producto)
  if (!idItem) {
    throw new OrdenServiceError(400, 'ID de producto/servicio inválido')
  }

  const tipoSolicitado = raw.tipo
  const producto = catalogos.productos.get(idItem)
  const servicio = catalogos.servicios.get(idItem)

  let tipo: ItemValidado['tipo']
  if (tipoSolicitado === 'producto') {
    if (!producto || producto.estatus === false) {
      throw new OrdenServiceError(400, `Producto con ID ${idItem} no está disponible`)
    }
    tipo = 'producto'
  } else if (tipoSolicitado === 'servicio') {
    if (!servicio || servicio.estatus === false) {
      throw new OrdenServiceError(400, `Servicio con ID ${idItem} no está disponible`)
    }
    tipo = 'servicio'
  } else if (servicio && servicio.estatus !== false) {
    tipo = 'servicio'
  } else if (producto && producto.estatus !== false) {
    tipo = 'producto'
  } else {
    throw new OrdenServiceError(400, `Item con ID ${idItem} no está disponible`)
  }

  const cantidad = toInt(raw.cantidad)
  if (!cantidad) {
    throw new OrdenServiceError(400, `Cantidad inválida para item ${idItem}`)
  }

  const precio = typeof raw.precio_unitario === 'string'
    ? parseFloat(raw.precio_unitario)
    : Number(raw.precio_unitario ?? 0)

  const descuento = raw.descuento
    ? typeof raw.descuento === 'string'
      ? parseFloat(raw.descuento)
      : Number(raw.descuento)
    : 0

  if (descuento < 0 || descuento > 100) {
    throw new OrdenServiceError(400, `Descuento inválido para item ${producto?.nombre || servicio?.nombre || idItem}`)
  }

  if (tipo === 'producto' && producto && producto.stock < cantidad) {
    throw new OrdenServiceError(400, `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`)
  }

  const almacenSeleccionado = tipo === 'producto' ? toInt(raw.almacen_id) ?? almacenReservaId : undefined
  const ubicacionSeleccionada = tipo === 'producto'
    ? (raw.ubicacion_id === null || raw.ubicacion_id === undefined ? null : toInt(raw.ubicacion_id) ?? null)
    : undefined

  if (tipo === 'producto' && !almacenSeleccionado) {
    throw new OrdenServiceError(400, `Debe seleccionar un almacén válido para el producto ${producto?.nombre || idItem}`)
  }

  const totalItem = cantidad * precio * (1 - descuento / 100)

  const servicioInfo = catalogos.servicios.get(idItem)
  const tiempoServicio = tipo === 'servicio' && servicioInfo
    ? {
        minimo: servicioInfo.tiempo_minimo,
        maximo: servicioInfo.tiempo_maximo,
        unidad: servicioInfo.unidad_tiempo,
        minimoMinutos: convertirATotalMinutos(servicioInfo.tiempo_minimo, servicioInfo.unidad_tiempo) * cantidad,
        maximoMinutos: convertirATotalMinutos(servicioInfo.tiempo_maximo, servicioInfo.unidad_tiempo) * cantidad,
      }
    : undefined

  return {
    ...(tipo === 'producto' ? { id_producto: idItem } : { id_servicio: idItem }),
    cantidad,
    precio,
    descuento,
    total: totalItem,
    tipo,
    ...(tipo === 'producto' && raw.servicio_ref ? { servicio_ref: toInt(raw.servicio_ref) ?? undefined } : {}),
    ...(tipo === 'producto' ? { almacenId: almacenSeleccionado ?? almacenReservaId } : {}),
    ...(tipo === 'producto' ? { ubicacionId: ubicacionSeleccionada ?? null } : {}),
    ...(tiempoServicio ? { tiempo_servicio: tiempoServicio } : {}),
  }
}

function validarProductosAsociados(itemsValidados: ItemValidado[]) {
  const cuenta = new Map<number, number>()
  for (const item of itemsValidados.filter((i) => i.tipo === 'producto' && i.servicio_ref)) {
    const servicioId = item.servicio_ref!
    const acumulado = cuenta.get(servicioId) ?? 0
    if (acumulado >= 1) {
      throw new OrdenServiceError(400, `Cada servicio solo puede tener 0 o 1 producto asociado (servicio ${servicioId})`)
    }
    cuenta.set(servicioId, acumulado + 1)
  }
}

export async function prepararContextoCreacion(prisma: PrismaClient, data: CrearOrdenInput): Promise<ContextoValidacion> {
  const idCliente = toInt(data.id_cliente)
  const idVehiculo = toInt(data.id_vehiculo)
  const trabajadorPrincipalId = toInt(data.id_trabajador_principal) ?? null
  const trabajadoresSecundarios = (data.trabajadores_secundarios || [])
    .map(toInt)
    .filter((n): n is number => Boolean(n))

  if (!idCliente || !idVehiculo) {
    throw new OrdenServiceError(400, 'Cliente o vehículo inválido')
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id_cliente: idCliente },
    include: { persona: true },
  })
  asegurarCliente(cliente)

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id_vehiculo: idVehiculo },
    include: { modelo: { include: { marca: true } } },
  })
  asegurarVehiculo(vehiculo, idCliente)

  if (trabajadorPrincipalId) {
    const trabajador = await prisma.trabajador.findUnique({
      where: { id_trabajador: trabajadorPrincipalId },
      select: { activo: true },
    })
    asegurarTrabajadorDisponible(trabajador)
  }

  const almacenPrincipal = await prisma.almacen.findFirst({
    where: { activo: true },
    orderBy: { id_almacen: 'asc' },
  })
  asegurarAlmacenPrincipal(almacenPrincipal)

  const itemIds = [...new Set(data.items.map((item) => toInt(item.id_producto)).filter((n): n is number => Boolean(n)))]
  const catalogos = await cargarCatalogos(prisma, itemIds)

  const modoSoloServicios = (data.modo_orden || 'servicios_y_productos') === 'solo_servicios'

  const itemsValidados: ItemValidado[] = []
  let subtotal = 0
  let totalMinutosMin = 0
  let totalMinutosMax = 0

  for (const raw of data.items) {
    const itemValidado = validarItem(raw, modoSoloServicios, catalogos, almacenPrincipal.id_almacen)
    itemsValidados.push(itemValidado)
    subtotal += itemValidado.total
    if (itemValidado.tiempo_servicio) {
      totalMinutosMin += itemValidado.tiempo_servicio.minimoMinutos
      totalMinutosMax += itemValidado.tiempo_servicio.maximoMinutos
    }
  }

  validarProductosAsociados(itemsValidados)

  return {
    idCliente,
    idVehiculo,
    trabajadorPrincipalId,
    trabajadoresSecundarios,
    cliente: cliente as ClienteConPersona,
    vehiculo: vehiculo as VehiculoConModelo,
    almacenReservaId: almacenPrincipal.id_almacen,
    modoSoloServicios,
    itemsValidados,
    subtotal,
    totalMinutosMin,
    totalMinutosMax,
  }
}
