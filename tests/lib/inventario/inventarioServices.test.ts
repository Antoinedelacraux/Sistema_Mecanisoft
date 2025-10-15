/// <reference types="jest" />

import { Prisma, MovimientoTipo } from '@prisma/client';

import { registrarAjuste, registrarIngreso, registrarSalida } from '@/lib/inventario/services';
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
  movimientoInventario: { create: jest.Mock<Promise<MovimientoRecord>, [unknown]> };
  bitacoraInventario: { create: jest.Mock<Promise<unknown>, [unknown]> };
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
    movimientoInventario: { create: jest.fn<Promise<MovimientoRecord>, [unknown]>() },
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

const buildInventarioBase = (overrides: Partial<InventarioRecord> = {}): InventarioRecord => ({
  id_inventario_producto: 1,
  id_producto: 1,
  id_almacen: 1,
  id_almacen_ubicacion: null,
  stock_disponible: new Prisma.Decimal(0),
  stock_comprometido: new Prisma.Decimal(0),
  stock_minimo: new Prisma.Decimal(0),
  stock_maximo: new Prisma.Decimal(0),
  costo_promedio: new Prisma.Decimal(0),
  creado_en: new Date('2025-01-01T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
  almacen: {
    id_almacen: 1,
    nombre: 'Almacén Central',
  },
  ubicacion: null,
  ...overrides,
});

const buildMovimientoBase = (overrides: Partial<MovimientoRecord> = {}): MovimientoRecord => ({
  id_movimiento_inventario: 99,
  tipo: MovimientoTipo.INGRESO,
  id_producto: 1,
  id_inventario_producto: 1,
  cantidad: new Prisma.Decimal(5),
  costo_unitario: new Prisma.Decimal(10),
  referencia_origen: 'OC-123',
  origen_tipo: 'COMPRA',
  observaciones: null,
  id_usuario: 42,
  fecha: new Date('2025-01-01T00:00:00.000Z'),
  inventario: buildInventarioBase(),
  producto: {
    id_producto: 1,
    codigo_producto: 'P-001',
    nombre: 'Filtro de aceite',
    tipo: 'producto',
  },
  usuario: {
    id_usuario: 42,
    nombre_usuario: 'admin',
    persona: {
      nombre: 'Admin',
      apellido_paterno: 'Principal',
      apellido_materno: 'DelTaller',
    },
  },
  ...overrides,
});

describe('Servicios de inventario', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks();
    jest.clearAllMocks();
  prisma.$transaction.mockImplementation(async (callback: (client: TransactionClientMock) => unknown) => callback(tx));
    tx.inventario.findUnique.mockResolvedValue({ stock_disponible: new Prisma.Decimal(0) });
    tx.inventarioProducto.aggregate.mockResolvedValue({ _sum: { stock_disponible: new Prisma.Decimal(0) } });
    tx.producto.update.mockResolvedValue(undefined);
  });

  describe('registrarIngreso', () => {
    it('crea inventario y registra movimiento de ingreso', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(null);

      const inventarioCreado = buildInventarioBase();
      tx.inventarioProducto.create.mockResolvedValue(inventarioCreado);

      const inventarioActualizado = buildInventarioBase({ stock_disponible: new Prisma.Decimal(5), costo_promedio: new Prisma.Decimal(10) });
      tx.inventarioProducto.update.mockResolvedValue(inventarioActualizado);

      const movimientoRegistrado = buildMovimientoBase();
      tx.movimientoInventario.create.mockResolvedValue(movimientoRegistrado);
      tx.bitacoraInventario.create.mockResolvedValue({});

      const resultado = await registrarIngreso({
        productoId: 1,
        almacenId: 1,
        usuarioId: 42,
        cantidad: '5',
        costoUnitario: '10',
        referencia: 'OC-123',
        origenTipo: 'COMPRA',
      });

      expect(tx.inventarioProducto.create).toHaveBeenCalledTimes(1);
      const updateCall = tx.inventarioProducto.update.mock.calls[0]?.[0] as {
        where: { id_inventario_producto: number };
        data: { stock_disponible: Prisma.Decimal; costo_promedio: Prisma.Decimal };
      };
      expect(updateCall.where).toEqual({ id_inventario_producto: inventarioCreado.id_inventario_producto });
      expect(updateCall.data.stock_disponible.toString()).toBe('5');
      expect(updateCall.data.costo_promedio.toString()).toBe('10');
      expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ tipo: MovimientoTipo.INGRESO }),
      }));
      expect(resultado.tipo).toBe(MovimientoTipo.INGRESO);
    });
  });

  describe('registrarSalida', () => {
    it('descuenta stock disponible', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      const inventarioExistente = buildInventarioBase({
        stock_disponible: new Prisma.Decimal(8),
        costo_promedio: new Prisma.Decimal(12),
      });
      tx.inventarioProducto.findFirst.mockResolvedValue(inventarioExistente);
      tx.inventarioProducto.update.mockResolvedValue(buildInventarioBase({ stock_disponible: new Prisma.Decimal(3) }));
      const movimiento = buildMovimientoBase({
  tipo: MovimientoTipo.SALIDA,
        cantidad: new Prisma.Decimal(5),
        costo_unitario: new Prisma.Decimal(12),
      });
      tx.movimientoInventario.create.mockResolvedValue(movimiento);
      tx.bitacoraInventario.create.mockResolvedValue({});

      const resultado = await registrarSalida({
        productoId: 1,
        almacenId: 1,
        usuarioId: 42,
        cantidad: '5',
      });

      const updateCall = tx.inventarioProducto.update.mock.calls[0]?.[0] as {
        data: { stock_disponible: Prisma.Decimal };
      };
      expect(updateCall.data.stock_disponible.toString()).toBe('3');
      expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ tipo: MovimientoTipo.SALIDA }),
      }));
      expect(resultado.tipo).toBe(MovimientoTipo.SALIDA);
    });

    it('lanza error cuando no hay stock suficiente', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(buildInventarioBase({ stock_disponible: new Prisma.Decimal(2) }));

      await expect(
        registrarSalida({ productoId: 1, almacenId: 1, usuarioId: 42, cantidad: '5' }),
      ).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' } as Partial<InventarioError>);
    });
  });

  describe('registrarAjuste', () => {
    it('aplica ajuste negativo controlando el stock', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(buildInventarioBase({ stock_disponible: new Prisma.Decimal(7) }));
      tx.inventarioProducto.update.mockResolvedValue(buildInventarioBase({ stock_disponible: new Prisma.Decimal(5) }));
      tx.movimientoInventario.create.mockResolvedValue(
        buildMovimientoBase({
          tipo: MovimientoTipo.AJUSTE_NEGATIVO,
          cantidad: new Prisma.Decimal(2),
        }),
      );
      tx.bitacoraInventario.create.mockResolvedValue({});

      const resultado = await registrarAjuste({
        productoId: 1,
        almacenId: 1,
        usuarioId: 42,
        cantidad: '2',
        motivo: 'Recuento físico',
        esPositivo: false,
      });

      const updateCall = tx.inventarioProducto.update.mock.calls[0]?.[0] as {
        data: { stock_disponible: Prisma.Decimal };
      };
      expect(updateCall.data.stock_disponible.toString()).toBe('5');
  expect(resultado.tipo).toBe(MovimientoTipo.AJUSTE_NEGATIVO);
    });

    it('impide ajuste negativo cuando supera stock', async () => {
      const { tx } = getMocks();
      tx.producto.findUnique.mockResolvedValue({ estatus: true });
      tx.almacenUbicacion.findUnique.mockResolvedValue({ id_almacen: 1, activo: true });
      tx.inventarioProducto.findFirst.mockResolvedValue(buildInventarioBase({ stock_disponible: new Prisma.Decimal(1) }));

      await expect(
        registrarAjuste({
          productoId: 1,
          almacenId: 1,
          usuarioId: 42,
          cantidad: '5',
          motivo: 'Error de conteo',
          esPositivo: false,
        }),
      ).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' } as Partial<InventarioError>);
    });
  });
});
