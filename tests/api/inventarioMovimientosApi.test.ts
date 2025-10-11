/// <reference types="jest" />

import { NextRequest } from 'next/server';
import { Prisma, MovimientoTipo } from '@prisma/client';

import { GET, POST } from '../../src/app/api/inventario/movimientos/route';
import { InventarioError } from '@/types/inventario';
import { getServerSession } from 'next-auth/next';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/services', () => ({
  registrarIngreso: jest.fn(),
  registrarSalida: jest.fn(),
  registrarAjuste: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const movimientoInventario = {
    findMany: jest.fn<Promise<unknown[]>, [unknown?]>(),
    count: jest.fn<Promise<number>, [unknown?]>(),
  };

  const prismaMock = {
    movimientoInventario,
    $transaction: jest.fn<Promise<unknown[]>, [Promise<unknown>[]]>(async (operations) => Promise.all(operations)),
  };

  return { prisma: prismaMock };
});

type PrismaMock = {
  movimientoInventario: {
    findMany: jest.Mock<Promise<unknown[]>, [unknown?]>;
    count: jest.Mock<Promise<number>, [unknown?]>;
  };
  $transaction: jest.Mock<Promise<unknown[]>, [Promise<unknown>[]]>;
};

const getPrismaMock = (): PrismaMock => (jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }).prisma;
const getSessionMock = () => getServerSession as jest.Mock;
type InventarioServicesMock = {
  registrarIngreso: jest.Mock;
  registrarSalida: jest.Mock;
  registrarAjuste: jest.Mock;
};

const getServiceMocks = () => jest.requireMock('@/lib/inventario/services') as InventarioServicesMock;

const buildMovimiento = () => ({
  id_movimiento_inventario: 10,
  tipo: MovimientoTipo.INGRESO,
  id_producto: 1,
  id_inventario_producto: 2,
  id_usuario: 99,
  cantidad: new Prisma.Decimal('5'),
  costo_unitario: new Prisma.Decimal('10'),
  referencia_origen: 'OC-001',
  origen_tipo: 'COMPRA',
  observaciones: null,
  fecha: new Date('2025-01-01T00:00:00.000Z'),
  producto: {
    id_producto: 1,
    codigo_producto: 'P-001',
    nombre: 'Filtro de aceite',
    tipo: 'producto',
  },
  inventario: {
    id_inventario_producto: 2,
    id_producto: 1,
    id_almacen: 1,
    id_almacen_ubicacion: null,
    stock_disponible: new Prisma.Decimal('10'),
    stock_comprometido: new Prisma.Decimal('0'),
    stock_minimo: new Prisma.Decimal('2'),
    stock_maximo: null,
    costo_promedio: new Prisma.Decimal('8'),
    creado_en: new Date('2025-01-01T00:00:00.000Z'),
    actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
  },
  usuario: {
    id_usuario: 99,
    nombre_usuario: 'admin',
    persona: {
      nombre: 'Admin',
      apellido_paterno: 'Pérez',
      apellido_materno: 'Lopez',
    },
  },
});

describe('API /api/inventario/movimientos', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    const services = getServiceMocks();
    prisma.movimientoInventario.findMany.mockReset();
    prisma.movimientoInventario.count.mockReset();
    prisma.$transaction.mockClear();
    services.registrarIngreso.mockReset();
    services.registrarSalida.mockReset();
    services.registrarAjuste.mockReset();
    getSessionMock().mockReset();
  });

  it('GET responde 401 sin sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/inventario/movimientos');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('GET retorna movimientos serializados', async () => {
    const prisma = getPrismaMock();
    getSessionMock().mockResolvedValue({ user: { id: '42' } });
    prisma.movimientoInventario.findMany.mockResolvedValue([buildMovimiento()]);
    prisma.movimientoInventario.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/inventario/movimientos?page=1&limit=10');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.movimientos).toHaveLength(1);
    expect(json.movimientos[0].cantidad).toBe('5');
    expect(json.movimientos[0].inventario.stock_disponible).toBe('10');
    expect(json.pagination.total).toBe(1);
  });

  it('POST responde 401 sin sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/inventario/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('POST delega en registrarIngreso cuando tipo=INGRESO', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '99' } });
    services.registrarIngreso.mockResolvedValue(buildMovimiento());

    const payload = {
      tipo: 'INGRESO',
      productoId: 1,
      almacenId: 1,
      cantidad: '5',
      costoUnitario: '10',
      referencia: 'OC-001',
      origenTipo: 'COMPRA',
    };

    const request = new NextRequest('http://localhost/api/inventario/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(services.registrarIngreso).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 99, costoUnitario: '10' }),
    );
    expect(json.movimiento.tipo).toBe('INGRESO');
  });

  it('POST valida payload y retorna 422 ante errores', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '99' } });
    const request = new NextRequest('http://localhost/api/inventario/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'INGRESO', productoId: 1 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it('POST mapea InventarioError al status correspondiente', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '99' } });
    services.registrarSalida.mockRejectedValue(new InventarioError('Sin stock', 409, 'STOCK_INSUFICIENTE'));

    const payload = {
      tipo: 'SALIDA',
      productoId: 1,
      almacenId: 1,
      cantidad: '5',
    };

    const request = new NextRequest('http://localhost/api/inventario/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe('STOCK_INSUFICIENTE');
  });
});
