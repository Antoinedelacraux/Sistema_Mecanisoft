/// <reference types="jest" />

import { MovimientoTipo, Prisma, TransferenciaEstado } from '@prisma/client';

import { anularTransferencia, confirmarTransferencia, crearTransferencia } from '@/lib/inventario/services';
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
};

type MovimientoRecord = {
  id_movimiento_inventario: number;
  tipo: MovimientoTipo;
  id_producto: number;
  id_inventario_producto: number;
  cantidad: Prisma.Decimal;
  costo_unitario: Prisma.Decimal;
  referencia_origen: string | null;
  origen_tipo: string | null;
  observaciones: string | null;
  id_usuario: number;
  fecha: Date;
  inventario: InventarioRecord;
  producto: {
    id_producto: number;
    codigo_producto: string;
    nombre: string;
    tipo: string;
  };
  usuario: {
    id_usuario: number;
    nombre_usuario: string;
    persona: {
      nombre: string;
      apellido_paterno: string;
      apellido_materno: string;
    };
  };
};

type TransferenciaRecord = {
  id_movimiento_transferencia: number;
  estado: TransferenciaEstado;
  movimiento_envio: MovimientoRecord;
  movimiento_recepcion: MovimientoRecord;
};

type TransactionClientMock = {
  producto: { findUnique: jest.Mock<Promise<{ estatus: boolean } | null>, [unknown?]> };
  almacenUbicacion: { findUnique: jest.Mock<Promise<{ id_almacen: number; activo: boolean } | null>, [unknown?]> };
  inventarioProducto: {
    findFirst: jest.Mock<Promise<InventarioRecord | null>, [unknown?]>;
    create: jest.Mock<Promise<InventarioRecord>, [unknown]>;
    update: jest.Mock<Promise<InventarioRecord>, [unknown]>;
  };
  movimientoInventario: {
    create: jest.Mock<Promise<MovimientoRecord>, [unknown]>;
    update: jest.Mock<Promise<MovimientoRecord>, [unknown]>;
  };
  movimientoTransferencia: {
    create: jest.Mock<Promise<TransferenciaRecord>, [unknown]>;
    findUnique: jest.Mock<Promise<TransferenciaRecord | null>, [unknown?]>;
    update: jest.Mock<Promise<TransferenciaRecord>, [unknown]>;
  };
  bitacoraInventario: { create: jest.Mock<Promise<unknown>, [unknown]> };
};

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown>, [(tx: TransactionClientMock) => unknown | Promise<unknown>]>;
  __tx: TransactionClientMock;
};

jest.mock('@/lib/prisma', () => {
  const transactionClient: TransactionClientMock = {
    producto: { findUnique: jest.fn<Promise<{ estatus: boolean } | null>, [unknown?]>() },
    almacenUbicacion: { findUnique: jest.fn<Promise<{ id_almacen: number; activo: boolean } | null>, [unknown?]>() },
    inventarioProducto: {
      findFirst: jest.fn<Promise<InventarioRecord | null>, [unknown?]>(),
      create: jest.fn<Promise<InventarioRecord>, [unknown]>(),
      update: jest.fn<Promise<InventarioRecord>, [unknown]>(),
    },
    movimientoInventario: {
      create: jest.fn<Promise<MovimientoRecord>, [unknown]>(),
      update: jest.fn<Promise<MovimientoRecord>, [unknown]>(),
    },
    movimientoTransferencia: {
      create: jest.fn<Promise<TransferenciaRecord>, [unknown]>(),
      findUnique: jest.fn<Promise<TransferenciaRecord | null>, [unknown?]>(),
      update: jest.fn<Promise<TransferenciaRecord>, [unknown]>(),
    },
    bitacoraInventario: { create: jest.fn<Promise<unknown>, [unknown]>() },
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

const buildInventario = (overrides: Partial<InventarioRecord> = {}): InventarioRecord => ({
  id_inventario_producto: 10,
  id_producto: 55,
  id_almacen: 1,
  id_almacen_ubicacion: null,
  stock_disponible: new Prisma.Decimal(10),
  stock_comprometido: new Prisma.Decimal(0),
  stock_minimo: new Prisma.Decimal(0),
  stock_maximo: new Prisma.Decimal(0),
  costo_promedio: new Prisma.Decimal(8),
  creado_en: new Date('2025-01-01T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
  almacen: {
    id_almacen: overrides.id_almacen ?? 1,
    nombre: overrides.id_almacen === 2 ? 'Secundario' : 'Central',
  },
  ubicacion: null,
  ...overrides,
});

const buildMovimiento = (overrides: Partial<MovimientoRecord> = {}): MovimientoRecord => ({
  id_movimiento_inventario: 99,
  tipo: MovimientoTipo.TRANSFERENCIA_ENVIO,
  id_producto: 55,
  id_inventario_producto: 10,
  cantidad: new Prisma.Decimal(3),
  costo_unitario: new Prisma.Decimal(8),
  referencia_origen: 'TR-2025-01',
  origen_tipo: 'TRANSFERENCIA',
  observaciones: null,
  id_usuario: 7,
  fecha: new Date('2025-01-01T00:00:00.000Z'),
  inventario: buildInventario(),
  producto: {
    id_producto: 55,
    codigo_producto: 'P-55',
    nombre: 'Pastillas de freno',
    tipo: 'producto',
  },
  usuario: {
    id_usuario: 7,
    nombre_usuario: 'operador',
    persona: {
      nombre: 'Operador',
      apellido_paterno: 'Inventario',
      apellido_materno: 'Central',
    },
  },
  ...overrides,
});

const buildTransferencia = (overrides: Partial<TransferenciaRecord> = {}): TransferenciaRecord => ({
  id_movimiento_transferencia: 501,
  estado: TransferenciaEstado.PENDIENTE_RECEPCION,
  movimiento_envio: buildMovimiento(),
  movimiento_recepcion: buildMovimiento({
    id_movimiento_inventario: 100,
    tipo: MovimientoTipo.TRANSFERENCIA_RECEPCION,
    inventario: buildInventario({ id_inventario_producto: 20, id_almacen: 2 }),
  }),
  ...overrides,
});

describe('Servicios de transferencias de inventario', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks();
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (client: TransactionClientMock) => unknown) => callback(tx));
  });

  describe('crearTransferencia', () => {
    it('crea movimientos y reserva stock en el almacén de origen', async () => {
      const { tx } = getMocks();
      const inventarioOrigen = buildInventario({ stock_disponible: new Prisma.Decimal(10), id_almacen: 1 });
      const inventarioDestino = buildInventario({ id_inventario_producto: 20, id_almacen: 2 });

      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      tx.inventarioProducto.findFirst
        .mockResolvedValueOnce(inventarioOrigen)
        .mockResolvedValueOnce(inventarioDestino);
      tx.inventarioProducto.update.mockResolvedValue(buildInventario({
        id_inventario_producto: inventarioOrigen.id_inventario_producto,
        stock_disponible: new Prisma.Decimal(7),
      }));

      const movimientoEnvio = buildMovimiento({
        inventario: buildInventario({ stock_disponible: new Prisma.Decimal(7) }),
      });
      const movimientoRecepcion = buildMovimiento({
        id_movimiento_inventario: 100,
        tipo: MovimientoTipo.TRANSFERENCIA_RECEPCION,
        inventario: inventarioDestino,
      });
      tx.movimientoInventario.create
        .mockResolvedValueOnce(movimientoEnvio)
        .mockResolvedValueOnce(movimientoRecepcion);

      const transferenciaCreada = buildTransferencia({
        movimiento_envio: movimientoEnvio,
        movimiento_recepcion: movimientoRecepcion,
      });
      tx.movimientoTransferencia.create.mockResolvedValue(transferenciaCreada);

      const resultado = await crearTransferencia({
        productoId: 55,
        origenAlmacenId: 1,
        destinoAlmacenId: 2,
        usuarioId: 7,
        cantidad: '3',
        referencia: 'TR-2025-01',
      });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id_inventario_producto: inventarioOrigen.id_inventario_producto },
      }));
      expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(2);
      expect(resultado.estado).toBe(TransferenciaEstado.PENDIENTE_RECEPCION);
      expect(resultado.movimiento_envio.cantidad.toString()).toBe('3');
    });

    it('lanza error cuando no hay stock suficiente en origen', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(buildInventario({ stock_disponible: new Prisma.Decimal(1) }));

      await expect(crearTransferencia({
        productoId: 55,
        origenAlmacenId: 1,
        destinoAlmacenId: 2,
        usuarioId: 7,
        cantidad: '5',
      })).rejects.toMatchObject({ code: 'STOCK_ORIGEN_INSUFICIENTE' } as Partial<InventarioError>);
    });
  });

  describe('confirmarTransferencia', () => {
    it('actualiza el estado y suma stock en el destino', async () => {
      const { tx } = getMocks();
      const transferenciaPendiente = buildTransferencia();
      tx.movimientoTransferencia.findUnique.mockResolvedValue(transferenciaPendiente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventario({
        id_inventario_producto: transferenciaPendiente.movimiento_recepcion.inventario.id_inventario_producto,
        stock_disponible: new Prisma.Decimal(13),
      }));
      tx.movimientoInventario.update.mockResolvedValue(transferenciaPendiente.movimiento_recepcion);

      const transferenciaCompletada = buildTransferencia({ estado: TransferenciaEstado.COMPLETADA });
      tx.movimientoTransferencia.update.mockResolvedValue(transferenciaCompletada);

      const resultado = await confirmarTransferencia({ transferenciaId: 501, usuarioId: 9 });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id_inventario_producto: transferenciaPendiente.movimiento_recepcion.inventario.id_inventario_producto },
      }));
      expect(resultado.estado).toBe(TransferenciaEstado.COMPLETADA);
    });

    it('evita confirmar una transferencia anulada', async () => {
      const { tx } = getMocks();
      tx.movimientoTransferencia.findUnique.mockResolvedValue(buildTransferencia({ estado: TransferenciaEstado.ANULADA }));

      await expect(confirmarTransferencia({ transferenciaId: 501, usuarioId: 9 })).rejects.toMatchObject({ code: 'TRANSFERENCIA_ANULADA' } as Partial<InventarioError>);
    });
  });

  describe('anularTransferencia', () => {
    it('restaura el stock al almacén de origen', async () => {
      const { tx } = getMocks();
      const transferenciaPendiente = buildTransferencia();
      tx.movimientoTransferencia.findUnique.mockResolvedValue(transferenciaPendiente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventario({
        id_inventario_producto: transferenciaPendiente.movimiento_envio.inventario.id_inventario_producto,
        stock_disponible: new Prisma.Decimal(13),
      }));
      tx.movimientoInventario.update.mockResolvedValue(transferenciaPendiente.movimiento_envio);
      const transferenciaAnulada = buildTransferencia({ estado: TransferenciaEstado.ANULADA });
      tx.movimientoTransferencia.update.mockResolvedValue(transferenciaAnulada);

      const resultado = await anularTransferencia({ transferenciaId: 501, usuarioId: 9, motivo: 'Error de picking' });

      expect(tx.inventarioProducto.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ stock_disponible: expect.any(Prisma.Decimal) }),
      }));
      expect(resultado.estado).toBe(TransferenciaEstado.ANULADA);
    });

    it('evita anular una transferencia completada', async () => {
      const { tx } = getMocks();
      tx.movimientoTransferencia.findUnique.mockResolvedValue(buildTransferencia({ estado: TransferenciaEstado.COMPLETADA }));

      await expect(anularTransferencia({ transferenciaId: 501, usuarioId: 9 })).rejects.toMatchObject({ code: 'TRANSFERENCIA_COMPLETADA' } as Partial<InventarioError>);
    });
  });
});
