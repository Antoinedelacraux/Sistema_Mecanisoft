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
import { syncProductoStock } from '@/lib/inventario/sync-producto-stock';
import {
  ActualizarReservaDTO,
  CambiarEstadoReservaParams,
  InventarioError,
  ReservarStockDTO,
  ReservaInventarioDetallada,
} from '@/types/inventario';
import { logger } from '@/lib/logger';

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

  await syncProductoStock(tx, input.productoId);

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

  await syncProductoStock(tx, reserva.inventario.id_producto);

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

const DEFAULT_EXPIRATION_HOURS = 48;
const DEFAULT_RELEASE_LIMIT = 100;
const MAX_RELEASE_LIMIT = 500;

const resolveHours = (input?: number) => {
  const envValue = process.env.INVENTARIO_RESERVA_TTL_HOURS;
  const source = typeof input === 'number' && Number.isFinite(input) && input > 0
    ? input
    : envValue
      ? Number(envValue)
      : undefined;

  if (typeof source !== 'number' || Number.isNaN(source) || source <= 0) {
    return DEFAULT_EXPIRATION_HOURS;
  }
  return Math.min(source, 24 * 30); // máximo 30 días
};

const resolveLimit = (input?: number) => {
  const envValue = process.env.INVENTARIO_RESERVA_RELEASE_LIMIT;
  const source = typeof input === 'number' && Number.isFinite(input) ? input : envValue ? Number(envValue) : undefined;
  if (typeof source !== 'number' || Number.isNaN(source) || source <= 0) {
    return DEFAULT_RELEASE_LIMIT;
  }
  return Math.min(Math.floor(source), MAX_RELEASE_LIMIT);
};

export type LiberarReservasCaducadasParams = {
  limit?: number;
  ttlHours?: number;
  motivo?: string;
  triggeredBy?: number;
  metadata?: Prisma.JsonValue;
  dryRun?: boolean;
};

export type LiberarReservasCaducadasResultado = {
  encontrados: number;
  liberados: number;
  errores: Array<{ reservaId: number; error: string }>;
  cutoff: string;
};

export async function liberarReservasCaducadas(params: LiberarReservasCaducadasParams = {}): Promise<LiberarReservasCaducadasResultado> {
  const limit = resolveLimit(params.limit);
  const ttlHours = resolveHours(params.ttlHours);
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

  const pendientes = await prisma.reservaInventario.findMany({
    where: {
      estado: ReservaEstado.PENDIENTE,
      creado_en: { lt: cutoff },
    },
    select: {
      id_reserva_inventario: true,
      creado_en: true,
      inventario: {
        select: {
          id_inventario_producto: true,
          producto: {
            select: {
              id_producto: true,
              nombre: true,
              codigo_producto: true,
            },
          },
          almacen: {
            select: {
              id_almacen: true,
              nombre: true,
            },
          },
        },
      },
    },
    orderBy: [{ creado_en: 'asc' }],
    take: limit,
  });

  if (pendientes.length === 0) {
    logger.debug('[inventario] liberarReservasCaducadas: sin reservas pendientes');
    return { encontrados: 0, liberados: 0, errores: [], cutoff: cutoff.toISOString() };
  }

  let liberados = 0;
  const errores: Array<{ reservaId: number; error: string }> = [];
  const motivo = params.motivo?.trim() || 'Liberación automática por caducidad';
  const metadataBase: Prisma.JsonValue = params.metadata ?? {
    reason: 'AUTO_EXPIRED',
    triggeredBy: params.triggeredBy ?? null,
  };

  for (const reserva of pendientes) {
    if (params.dryRun) {
      continue;
    }
    try {
      await prisma.$transaction((tx: TxClient) =>
        liberarReservaEnTx(tx, {
          reservaId: reserva.id_reserva_inventario,
          motivo,
          metadata: metadataBase,
        }),
      );
      liberados += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errores.push({ reservaId: reserva.id_reserva_inventario, error: message });
      logger.error({ reservaId: reserva.id_reserva_inventario, err: message }, '[inventario] error liberando reserva caducada');
    }
  }

  if (!params.dryRun) {
    logger.info(
      {
        encontrados: pendientes.length,
        liberados,
        errores: errores.length,
        cutoff: cutoff.toISOString(),
      },
      '[inventario] liberación automática de reservas completada',
    );
  }

  return {
    encontrados: pendientes.length,
    liberados,
    errores,
    cutoff: cutoff.toISOString(),
  };
}
