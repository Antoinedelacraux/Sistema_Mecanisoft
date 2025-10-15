/// <reference types="jest" />

import { Prisma, ReservaEstado } from '@prisma/client';

import { cancelarReserva, confirmarReserva, liberarReserva, reservarStock } from '@/lib/inventario/reservas';
import { InventarioError } from '@/types/inventario';

type InventarioRecord = {
  id_inventario_producto: number;
  id_producto: number;
  id_almacen: number;
  id_almacen_ubicacion: number | null;
  stock_disponible: Prisma.Decimal;
  stock_comprometido: Prisma.Decimal;
  stock_minimo: Prisma.Decimal;
  stock_maximo: Prisma.Decimal | null;
  costo_promedio: Prisma.Decimal;
  creado_en: Date;
  actualizado_en: Date;
  almacen: {
    id_almacen: number;
    nombre: string;
  } | null;
  ubicacion: {
    id_almacen_ubicacion: number;
    codigo: string;
    descripcion: string | null;
  } | null;
  producto: {
    id_producto: number;
    stock: number;
  };
};

type ReservaRecord = {
  id_reserva_inventario: number;
  id_inventario_producto: number;
  id_transaccion: number | null;
  id_detalle_transaccion: number | null;
  cantidad: Prisma.Decimal;
  estado: ReservaEstado;
  motivo: string | null;
  metadata: Prisma.JsonValue | null;
  creado_en: Date;
  actualizado_en: Date;
  inventario: InventarioRecord;
  transaccion: unknown;
  detalle_transaccion: unknown;
};

type TransactionClientMock = {
  producto: {
    findUnique: jest.Mock<Promise<{ estatus: boolean } | null>, [unknown?]>;
    update: jest.Mock<Promise<unknown>, [unknown?]>;
  };
  almacenUbicacion: { findUnique: jest.Mock<Promise<{ id_almacen: number; activo: boolean } | null>, [unknown?]> };
  inventarioProducto: {
    findFirst: jest.Mock<Promise<InventarioRecord | null>, [unknown?]>;
    create: jest.Mock<Promise<InventarioRecord>, [unknown]>;
    update: jest.Mock<Promise<InventarioRecord>, [unknown]>;
    aggregate: jest.Mock<Promise<{ _sum: { stock_disponible: Prisma.Decimal | null } }>, [unknown?]>;
  };
  inventario: {
    findUnique: jest.Mock<Promise<{ stock_disponible: Prisma.Decimal } | null>, [unknown?]>;
  };
  reservaInventario: {
    create: jest.Mock<Promise<ReservaRecord>, [unknown]>;
    findUnique: jest.Mock<Promise<ReservaRecord | null>, [unknown?]>;
    update: jest.Mock<Promise<ReservaRecord>, [unknown]>;
  };
};

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown>, [(tx: TransactionClientMock) => unknown | Promise<unknown>]>;
  __tx: TransactionClientMock;
};

jest.mock('@/lib/prisma', () => {
  const transactionClient: TransactionClientMock = {
    producto: {
      findUnique: jest.fn<Promise<{ estatus: boolean } | null>, [unknown?]>(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    almacenUbicacion: { findUnique: jest.fn<Promise<{ id_almacen: number; activo: boolean } | null>, [unknown?]>() },
    inventarioProducto: {
      findFirst: jest.fn<Promise<InventarioRecord | null>, [unknown?]>(),
      create: jest.fn<Promise<InventarioRecord>, [unknown]>(),
      update: jest.fn<Promise<InventarioRecord>, [unknown]>(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { stock_disponible: new Prisma.Decimal(0) } }),
    },
    inventario: {
      findUnique: jest.fn().mockResolvedValue({ stock_disponible: new Prisma.Decimal(0) }),
    },
    reservaInventario: {
      create: jest.fn<Promise<ReservaRecord>, [unknown]>(),
      findUnique: jest.fn<Promise<ReservaRecord | null>, [unknown?]>(),
      update: jest.fn<Promise<ReservaRecord>, [unknown]>(),
    },
  };

  const prismaMock: PrismaMock = {
    $transaction: jest.fn(async (callback) => callback(transactionClient)),
    __tx: transactionClient,
  };

  return { prisma: prismaMock };
});

const getMocks = () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: PrismaMock };
  return {
    prisma,
    tx: prisma.__tx,
  };
};

const buildInventarioBase = (overrides: Partial<InventarioRecord> = {}): InventarioRecord => ({
  id_inventario_producto: 5,
  id_producto: 99,
  id_almacen: 3,
  id_almacen_ubicacion: null,
  stock_disponible: new Prisma.Decimal(10),
  stock_comprometido: new Prisma.Decimal(0),
  stock_minimo: new Prisma.Decimal(0),
  stock_maximo: new Prisma.Decimal(0),
  costo_promedio: new Prisma.Decimal(0),
  creado_en: new Date('2025-01-01T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
  almacen: {
    id_almacen: 3,
    nombre: 'Central',
  },
  ubicacion: null,
  producto: {
    id_producto: overrides.id_producto ?? 99,
    stock: 0,
  },
  ...overrides,
});

const buildReservaBase = (overrides: Partial<ReservaRecord> = {}): ReservaRecord => ({
  id_reserva_inventario: 777,
  id_inventario_producto: 5,
  id_transaccion: null,
  id_detalle_transaccion: null,
  cantidad: new Prisma.Decimal(2),
  estado: ReservaEstado.PENDIENTE,
  motivo: null,
  metadata: null,
  creado_en: new Date('2025-01-02T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
  inventario: buildInventarioBase(),
  transaccion: null,
  detalle_transaccion: null,
  ...overrides,
});

describe('Servicios de reservas de inventario', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks();
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: TransactionClientMock) => unknown) => callback(tx));
    tx.inventario.findUnique.mockResolvedValue({ stock_disponible: new Prisma.Decimal(0) });
    tx.inventarioProducto.aggregate.mockResolvedValue({ _sum: { stock_disponible: new Prisma.Decimal(0) } });
    tx.producto.update.mockResolvedValue(undefined);
  });

  describe('reservarStock', () => {
    it('crea una reserva y ajusta el inventario', async () => {
      const { tx } = getMocks();
      const inventarioExistente = buildInventarioBase();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 3, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(inventarioExistente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventarioBase({
        stock_disponible: new Prisma.Decimal(7),
        stock_comprometido: new Prisma.Decimal(3),
      }));

      const reservaCreada = buildReservaBase({
        cantidad: new Prisma.Decimal(3),
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(7),
          stock_comprometido: new Prisma.Decimal(3),
        }),
      });
      tx.reservaInventario.create.mockResolvedValue(reservaCreada);

      const resultado = await reservarStock({
        productoId: 99,
        almacenId: 3,
        usuarioId: 42,
        cantidad: '3',
        motivo: 'Reserva para orden',
      });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          stock_disponible: expect.any(Prisma.Decimal),
          stock_comprometido: expect.any(Prisma.Decimal),
        }),
      }));
      expect(tx.reservaInventario.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ cantidad: new Prisma.Decimal(3) }),
      }));
      expect(resultado.cantidad.toString()).toBe('3');
      expect(resultado.inventario.stock_disponible.toString()).toBe('7');
    });

    it('lanza error cuando no hay stock disponible suficiente', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 3, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(buildInventarioBase({ stock_disponible: new Prisma.Decimal(1) }));

      await expect(
        reservarStock({ productoId: 1, almacenId: 3, usuarioId: 2, cantidad: '5' }),
      ).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' } as Partial<InventarioError>);
    });
  });

  describe('confirmarReserva', () => {
    it('reduce el stock comprometido al confirmar', async () => {
      const { tx } = getMocks();
      const reservaPendiente = buildReservaBase({
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(4),
          stock_comprometido: new Prisma.Decimal(2),
        }),
      });
      tx.reservaInventario.findUnique.mockResolvedValue(reservaPendiente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventarioBase({
        stock_disponible: new Prisma.Decimal(4),
        stock_comprometido: new Prisma.Decimal(0),
      }));

      const reservaActualizada = buildReservaBase({
        estado: ReservaEstado.CONFIRMADA,
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(4),
          stock_comprometido: new Prisma.Decimal(0),
        }),
      });
      tx.reservaInventario.update.mockResolvedValue(reservaActualizada);

      const resultado = await confirmarReserva({ reservaId: 777, usuarioId: 88 });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          stock_disponible: new Prisma.Decimal(4),
          stock_comprometido: new Prisma.Decimal(0),
        }),
      }));
      expect(resultado.estado).toBe(ReservaEstado.CONFIRMADA);
    });

    it('evita confirmar una reserva que no está pendiente', async () => {
      const { tx } = getMocks();
      tx.reservaInventario.findUnique.mockResolvedValue(
        buildReservaBase({ estado: ReservaEstado.CONFIRMADA }),
      );

      await expect(confirmarReserva({ reservaId: 1, usuarioId: 1 })).rejects.toMatchObject({ code: 'RESERVA_NO_PENDIENTE' } as Partial<InventarioError>);
    });
  });

  describe('liberarReserva', () => {
    it('regresa el stock disponible y libera comprometido', async () => {
      const { tx } = getMocks();
      const reservaPendiente = buildReservaBase({
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(2),
          stock_comprometido: new Prisma.Decimal(5),
        }),
      });
      tx.reservaInventario.findUnique.mockResolvedValue(reservaPendiente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventarioBase({
        stock_disponible: new Prisma.Decimal(4),
        stock_comprometido: new Prisma.Decimal(3),
      }));

      const reservaActualizada = buildReservaBase({
        estado: ReservaEstado.LIBERADA,
        motivo: 'Orden cancelada',
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(4),
          stock_comprometido: new Prisma.Decimal(3),
        }),
      });
      tx.reservaInventario.update.mockResolvedValue(reservaActualizada);

      const resultado = await liberarReserva({ reservaId: 777, usuarioId: 88, motivo: 'Orden cancelada' });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          stock_disponible: new Prisma.Decimal(4),
          stock_comprometido: new Prisma.Decimal(3),
        }),
      }));
      expect(resultado.estado).toBe(ReservaEstado.LIBERADA);
      expect(resultado.motivo).toBe('Orden cancelada');
    });
  });

  describe('cancelarReserva', () => {
    it('restaura stock y marca como cancelada', async () => {
      const { tx } = getMocks();
      const reservaPendiente = buildReservaBase({
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(6),
          stock_comprometido: new Prisma.Decimal(2),
        }),
      });
      tx.reservaInventario.findUnique.mockResolvedValue(reservaPendiente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventarioBase({
        stock_disponible: new Prisma.Decimal(8),
        stock_comprometido: new Prisma.Decimal(0),
      }));

      const reservaActualizada = buildReservaBase({
        estado: ReservaEstado.CANCELADA,
        motivo: 'Orden anulada',
        inventario: buildInventarioBase({
          stock_disponible: new Prisma.Decimal(8),
          stock_comprometido: new Prisma.Decimal(0),
        }),
      });
      tx.reservaInventario.update.mockResolvedValue(reservaActualizada);

      const resultado = await cancelarReserva({ reservaId: 777, usuarioId: 99, motivo: 'Orden anulada' });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          stock_disponible: new Prisma.Decimal(8),
          stock_comprometido: new Prisma.Decimal(0),
        }),
      }));
      expect(resultado.estado).toBe(ReservaEstado.CANCELADA);
      expect(resultado.motivo).toBe('Orden anulada');
    });
  });
});
