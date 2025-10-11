/// <reference types="jest" />

import { Prisma } from '@prisma/client';

import { obtenerResumenInventario } from '@/lib/inventario/reportes';

jest.mock('@/lib/prisma', () => {
  const inventarioProducto = {
    findMany: jest.fn<Promise<unknown[]>, [unknown?]>(),
  };

  return {
    prisma: {
      inventarioProducto,
    },
  };
});

const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as { prisma: {
  inventarioProducto: {
    findMany: jest.Mock<Promise<unknown[]>, [unknown?]>;
  };
} }).prisma;

describe('obtenerResumenInventario', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.inventarioProducto.findMany.mockReset();
  });

  it('calcula totales globales y por almacén', async () => {
    const prisma = getPrismaMock();
    prisma.inventarioProducto.findMany.mockResolvedValue([
      {
        id_inventario_producto: 1,
        id_producto: 10,
        id_almacen: 1,
  stock_disponible: new Prisma.Decimal('2'),
        stock_comprometido: new Prisma.Decimal('1'),
        stock_minimo: new Prisma.Decimal('3'),
        stock_maximo: null,
        costo_promedio: new Prisma.Decimal('12.5'),
        producto: {
          id_producto: 10,
          nombre: 'Filtro de aceite',
          codigo_producto: 'F-001',
          tipo: 'producto',
        },
        almacen: {
          id_almacen: 1,
          nombre: 'Central',
        },
      },
      {
        id_inventario_producto: 2,
        id_producto: 11,
        id_almacen: 1,
        stock_disponible: new Prisma.Decimal('8'),
        stock_comprometido: new Prisma.Decimal('2'),
        stock_minimo: new Prisma.Decimal('4'),
        stock_maximo: null,
        costo_promedio: new Prisma.Decimal('20'),
        producto: {
          id_producto: 11,
          nombre: 'Pastillas de freno',
          codigo_producto: 'PF-010',
          tipo: 'producto',
        },
        almacen: {
          id_almacen: 1,
          nombre: 'Central',
        },
      },
      {
        id_inventario_producto: 3,
        id_producto: 12,
        id_almacen: 2,
        stock_disponible: new Prisma.Decimal('2'),
        stock_comprometido: new Prisma.Decimal('0'),
        stock_minimo: new Prisma.Decimal('1'),
        stock_maximo: null,
        costo_promedio: new Prisma.Decimal('50'),
        producto: {
          id_producto: 12,
          nombre: 'Batería 12V',
          codigo_producto: 'BAT-12',
          tipo: 'producto',
        },
        almacen: {
          id_almacen: 2,
          nombre: 'Sucursal Norte',
        },
      },
    ]);

    const resultado = await obtenerResumenInventario();

    expect(resultado.resumen.totalProductosMonitoreados).toBe(3);
    expect(resultado.resumen.stockDisponibleTotal).toBe('12');
    expect(resultado.resumen.stockComprometidoTotal).toBe('3');
    expect(resultado.resumen.valorizacionTotal).toBe('285');
    expect(resultado.resumen.itemsCriticos).toBe(1);

    expect(resultado.porAlmacen).toHaveLength(2);
    expect(resultado.porAlmacen[0]).toMatchObject({
      id_almacen: 1,
      nombre: 'Central',
      valorizacion: '185',
    });

    expect(resultado.productosCriticos).toHaveLength(1);
    expect(resultado.productosCriticos[0]).toMatchObject({
      id_inventario_producto: 1,
      codigo_producto: 'F-001',
    });
  });

  it('limita la lista de productos críticos y ordena por stock disponible', async () => {
    const prisma = getPrismaMock();
    prisma.inventarioProducto.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id_inventario_producto: index + 1,
        id_producto: index + 1,
        id_almacen: 1,
        stock_disponible: new Prisma.Decimal(`${index}`),
        stock_comprometido: new Prisma.Decimal('0'),
        stock_minimo: new Prisma.Decimal(`${index + 1}`),
        stock_maximo: null,
        costo_promedio: new Prisma.Decimal('10'),
        producto: {
          id_producto: index + 1,
          nombre: `Producto ${index + 1}`,
          codigo_producto: `P-${index + 1}`,
          tipo: 'producto',
        },
        almacen: {
          id_almacen: 1,
          nombre: 'Central',
        },
      })),
    );

    const resultado = await obtenerResumenInventario();

    expect(resultado.productosCriticos).toHaveLength(10);
    const stocks = resultado.productosCriticos.map((item) => Number.parseFloat(item.stock_disponible));
    expect(stocks).toEqual([...stocks].sort((a, b) => a - b));
  });
});
