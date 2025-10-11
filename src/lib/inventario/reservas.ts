import { Prisma, ReservaEstado } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  DECIMAL_ZERO,
  assertPositiveCantidad,
  obtenerInventario,
  toDecimal,
  validarProducto,
  validarUbicacion,
} from '@/lib/inventario/services';
import {
  ActualizarReservaDTO,
  CambiarEstadoReservaParams,
  InventarioError,
  ReservarStockDTO,
  ReservaInventarioDetallada,
} from '@/types/inventario';

const buildInclude = (): Prisma.ReservaInventarioInclude => ({
  inventario: {
    include: {
      producto: true,
      almacen: true,
      ubicacion: true,
    },
  },
  transaccion: true,
  detalle_transaccion: true,
});

type TxClient = Prisma.TransactionClient;

const assertReservaPendiente = (estado: ReservaEstado) => {
  if (estado !== ReservaEstado.PENDIENTE) {
    throw new InventarioError('La reserva ya fue gestionada previamente', 409, 'RESERVA_NO_PENDIENTE');
  }
};

const reservarStockTx = async (tx: TxClient, input: ReservarStockDTO): Promise<ReservaInventarioDetallada> => {
  const cantidadDecimal = toDecimal(input.cantidad);
  assertPositiveCantidad(cantidadDecimal, 'La cantidad a reservar debe ser mayor a cero');

  await validarProducto(tx, input.productoId);
  await validarUbicacion(tx, input.almacenId, input.ubicacionId ?? null);

  const inventario = await obtenerInventario(tx, input.productoId, input.almacenId, input.ubicacionId ?? null);

  if (inventario.stock_disponible.lt(cantidadDecimal)) {
    throw new InventarioError('Stock insuficiente para realizar la reserva solicitada', 409, 'STOCK_INSUFICIENTE');
  }

  await tx.inventarioProducto.update({
    where: { id_inventario_producto: inventario.id_inventario_producto },
    data: {
      stock_disponible: inventario.stock_disponible.sub(cantidadDecimal),
      stock_comprometido: inventario.stock_comprometido.add(cantidadDecimal),
    },
  });

  const reserva = await tx.reservaInventario.create({
    data: {
      id_inventario_producto: inventario.id_inventario_producto,
      id_transaccion: input.transaccionId ?? null,
      id_detalle_transaccion: input.detalleTransaccionId ?? null,
      cantidad: cantidadDecimal,
      motivo: input.motivo ?? null,
  metadata: input.metadata ?? Prisma.JsonNull,
    },
    include: buildInclude(),
  }) as ReservaInventarioDetallada;

  return reserva;
};

export const reservarStockEnTx = reservarStockTx;

export const reservarStock = async (input: ReservarStockDTO): Promise<ReservaInventarioDetallada> => {
  return prisma.$transaction(async (tx: TxClient) => reservarStockTx(tx, input));
};

const obtenerReserva = async (tx: TxClient, reservaId: number) => {
  const reserva = await tx.reservaInventario.findUnique({
    where: { id_reserva_inventario: reservaId },
    include: buildInclude(),
  });

  if (!reserva) {
    throw new InventarioError('La reserva indicada no existe', 404, 'RESERVA_NO_ENCONTRADA');
  }

  return reserva;
};

const cambiarEstadoReserva = async (
  tx: TxClient,
  params: CambiarEstadoReservaParams,
): Promise<ReservaInventarioDetallada> => {
  const reserva = await obtenerReserva(tx, params.reservaId);

  assertReservaPendiente(reserva.estado);

  let stockDisponible = reserva.inventario.stock_disponible;
  let stockComprometido = reserva.inventario.stock_comprometido;

  if (params.estadoDestino === ReservaEstado.CONFIRMADA) {
    stockComprometido = stockComprometido.sub(reserva.cantidad);
  } else if (params.estadoDestino === ReservaEstado.LIBERADA || params.estadoDestino === ReservaEstado.CANCELADA) {
    stockComprometido = stockComprometido.sub(reserva.cantidad);
    stockDisponible = stockDisponible.add(reserva.cantidad);
  }

  if (stockComprometido.lt(DECIMAL_ZERO)) {
    throw new InventarioError('La reserva supera el stock comprometido disponible', 409, 'STOCK_COMPROMETIDO_INVALIDO');
  }

  await tx.inventarioProducto.update({
    where: { id_inventario_producto: reserva.id_inventario_producto },
    data: {
      stock_disponible: stockDisponible,
      stock_comprometido: stockComprometido,
    },
  });

  const reservaActualizada = await tx.reservaInventario.update({
    where: { id_reserva_inventario: reserva.id_reserva_inventario },
    data: {
      estado: params.estadoDestino,
      motivo: params.motivo ?? reserva.motivo,
  metadata: params.metadata ?? reserva.metadata ?? Prisma.JsonNull,
    },
    include: buildInclude(),
  }) as ReservaInventarioDetallada;

  return reservaActualizada;
};

const confirmarReservaTx = async (tx: TxClient, input: ActualizarReservaDTO) =>
  cambiarEstadoReserva(tx, {
    reservaId: input.reservaId,
    motivo: input.motivo,
    metadata: input.metadata,
    estadoDestino: ReservaEstado.CONFIRMADA,
  });

const liberarReservaTx = async (tx: TxClient, input: ActualizarReservaDTO) =>
  cambiarEstadoReserva(tx, {
    reservaId: input.reservaId,
    motivo: input.motivo,
    metadata: input.metadata,
    estadoDestino: ReservaEstado.LIBERADA,
  });

const cancelarReservaTx = async (tx: TxClient, input: ActualizarReservaDTO) =>
  cambiarEstadoReserva(tx, {
    reservaId: input.reservaId,
    motivo: input.motivo,
    metadata: input.metadata,
    estadoDestino: ReservaEstado.CANCELADA,
  });

export const confirmarReservaEnTx = confirmarReservaTx;
export const liberarReservaEnTx = liberarReservaTx;
export const cancelarReservaEnTx = cancelarReservaTx;

export const confirmarReserva = async (
  input: ActualizarReservaDTO,
): Promise<ReservaInventarioDetallada> => {
  return prisma.$transaction(async (tx: TxClient) => confirmarReservaTx(tx, input));
};

export const liberarReserva = async (
  input: ActualizarReservaDTO,
): Promise<ReservaInventarioDetallada> => {
  return prisma.$transaction(async (tx: TxClient) => liberarReservaTx(tx, input));
};

export const cancelarReserva = async (
  input: ActualizarReservaDTO,
): Promise<ReservaInventarioDetallada> => {
  return prisma.$transaction(async (tx: TxClient) => cancelarReservaTx(tx, input));
};
