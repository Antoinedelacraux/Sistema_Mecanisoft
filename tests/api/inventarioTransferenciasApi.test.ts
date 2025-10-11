/// <reference types="jest" />

import { NextRequest } from 'next/server';
import { Prisma, TransferenciaEstado } from '@prisma/client';

import { GET, POST, serializeTransferencia } from '@/app/api/inventario/transferencias/route';
import { PATCH } from '@/app/api/inventario/transferencias/[id]/route';
import { getServerSession } from 'next-auth/next';
import { crearTransferencia, confirmarTransferencia, anularTransferencia } from '@/lib/inventario/services';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/services', () => ({
  crearTransferencia: jest.fn(),
  confirmarTransferencia: jest.fn(),
  anularTransferencia: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const movimientoTransferencia = {
    findMany: jest.fn<Promise<unknown[]>, [unknown?]>(),
    count: jest.fn<Promise<number>, [unknown?]>(),
  };

  const prismaMock = {
    movimientoTransferencia,
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };

  return { prisma: prismaMock };
});

type PrismaMock = {
  movimientoTransferencia: {
    findMany: jest.Mock<Promise<unknown[]>, [unknown?]>;
    count: jest.Mock<Promise<number>, [unknown?]>;
  };
  $transaction: jest.Mock<Promise<unknown[]>, [Promise<unknown>[]]>;
};

type ServicesMock = {
  crearTransferencia: jest.Mock;
  confirmarTransferencia: jest.Mock;
  anularTransferencia: jest.Mock;
};

const getSessionMock = () => getServerSession as jest.Mock;
const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }).prisma;
const getServiceMocks = () => jest.requireMock('@/lib/inventario/services') as ServicesMock;

type MovimientoRecord = {
  id_movimiento_inventario: number;
  tipo: string;
  id_producto: number;
  id_inventario_producto: number;
  cantidad: Prisma.Decimal;
  costo_unitario: Prisma.Decimal;
  referencia_origen: string | null;
  origen_tipo: string | null;
  observaciones: string | null;
  id_usuario: number;
  fecha: Date;
  inventario: {
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
  id_movimiento_envio: number;
  id_movimiento_recepcion: number;
  estado: TransferenciaEstado;
  creado_en: Date;
  actualizado_en: Date;
  movimiento_envio: MovimientoRecord;
  movimiento_recepcion: MovimientoRecord;
};

const buildMovimiento = (overrides: Partial<MovimientoRecord> = {}): MovimientoRecord => ({
  id_movimiento_inventario: 1,
  tipo: 'TRANSFERENCIA_ENVIO',
  id_producto: 55,
  id_inventario_producto: 10,
  cantidad: new Prisma.Decimal('3'),
  costo_unitario: new Prisma.Decimal('8'),
  referencia_origen: 'TR-001',
  origen_tipo: 'TRANSFERENCIA',
  observaciones: 'Pendiente de recepción',
  id_usuario: 7,
  fecha: new Date('2025-01-01T00:00:00.000Z'),
  inventario: {
    id_inventario_producto: 10,
    id_producto: 55,
    id_almacen: 1,
    id_almacen_ubicacion: null,
    stock_disponible: new Prisma.Decimal('5'),
    stock_comprometido: new Prisma.Decimal('0'),
    stock_minimo: new Prisma.Decimal('0'),
    stock_maximo: new Prisma.Decimal('0'),
    costo_promedio: new Prisma.Decimal('8'),
    creado_en: new Date('2025-01-01T00:00:00.000Z'),
    actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
    almacen: {
      id_almacen: 1,
      nombre: 'Central',
    },
    ubicacion: null,
  },
  producto: {
    id_producto: 55,
    codigo_producto: 'P-055',
    nombre: 'Kit frenos',
    tipo: 'producto',
  },
  usuario: {
    id_usuario: 7,
    nombre_usuario: 'operador',
    persona: {
      nombre: 'Operador',
      apellido_paterno: 'Inventario',
      apellido_materno: 'Principal',
    },
  },
  ...overrides,
});

const buildTransferencia = (overrides: Partial<TransferenciaRecord> = {}): TransferenciaRecord => {
  const envio = buildMovimiento();
  const recepcion = buildMovimiento({
    id_movimiento_inventario: 2,
    inventario: {
      ...envio.inventario,
      id_inventario_producto: 20,
      id_almacen: 2,
      almacen: {
        id_almacen: 2,
        nombre: 'Secundario',
      },
    },
  });

  return {
    id_movimiento_transferencia: 501,
    id_movimiento_envio: envio.id_movimiento_inventario,
    id_movimiento_recepcion: recepcion.id_movimiento_inventario,
    estado: TransferenciaEstado.PENDIENTE_RECEPCION,
    creado_en: new Date('2025-01-01T00:00:00.000Z'),
    actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
    movimiento_envio: envio,
    movimiento_recepcion: recepcion,
    ...overrides,
  };
};

describe('API /api/inventario/transferencias', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.movimientoTransferencia.findMany.mockReset();
    prisma.movimientoTransferencia.count.mockReset();
    prisma.$transaction.mockClear();
    const services = getServiceMocks();
    services.crearTransferencia.mockReset();
    services.confirmarTransferencia.mockReset();
    services.anularTransferencia.mockReset();
    getSessionMock().mockReset();
  });

  it('GET responde 401 sin sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/inventario/transferencias');
  const response = (await GET(request))!;
  expect(response.status).toBe(401);
  });

  it('GET devuelve transferencias serializadas', async () => {
    const prisma = getPrismaMock();
    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    const transferencia = buildTransferencia();
    prisma.movimientoTransferencia.findMany.mockResolvedValue([transferencia]);
    prisma.movimientoTransferencia.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/inventario/transferencias?page=1&limit=5');
  const response = (await GET(request))!;
  const json = (await response.json()) as { transferencias: Array<ReturnType<typeof serializeTransferencia>> };

    expect(response.status).toBe(200);
    expect(json.transferencias).toHaveLength(1);
    expect(json.transferencias[0].movimiento_envio.producto.nombre).toBe('Kit frenos');
    expect(json.transferencias[0].estado).toBe(TransferenciaEstado.PENDIENTE_RECEPCION);
  });

  it('POST responde 401 sin sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/inventario/transferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  const response = (await POST(request))!;
  expect(response.status).toBe(401);
  });

  it('POST crea transferencia y devuelve payload serializado', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    services.crearTransferencia.mockResolvedValue(buildTransferencia());

    const request = new NextRequest('http://localhost/api/inventario/transferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productoId: 55,
        cantidad: '3',
        origenAlmacenId: 1,
        destinoAlmacenId: 2,
      }),
    });

  const response = (await POST(request))!;
  const json = (await response.json()) as { transferencia: ReturnType<typeof serializeTransferencia> };

    expect(response.status).toBe(201);
    expect(json.transferencia.movimiento_envio.cantidad).toBe('3');
    expect(services.crearTransferencia).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 7 }));
  });

  it('PATCH confirma transferencia', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '9' } });
    services.confirmarTransferencia.mockResolvedValue(buildTransferencia({ estado: TransferenciaEstado.COMPLETADA }));

    const request = new NextRequest('http://localhost/api/inventario/transferencias/501', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'confirmar', observaciones: 'Recibido' }),
    });

  const response = (await PATCH(request, { params: Promise.resolve({ id: '501' }) }))!;
  const json = (await response.json()) as { transferencia: ReturnType<typeof serializeTransferencia> };

    expect(response.status).toBe(200);
    expect(json.transferencia.estado).toBe(TransferenciaEstado.COMPLETADA);
    expect(services.confirmarTransferencia).toHaveBeenCalledWith(expect.objectContaining({ transferenciaId: 501 }));
  });

  it('PATCH anula transferencia', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '9' } });
    services.anularTransferencia.mockResolvedValue(buildTransferencia({ estado: TransferenciaEstado.ANULADA }));

    const request = new NextRequest('http://localhost/api/inventario/transferencias/501', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'anular', motivo: 'Error de picking' }),
    });

  const response = (await PATCH(request, { params: Promise.resolve({ id: '501' }) }))!;
  const json = (await response.json()) as { transferencia: ReturnType<typeof serializeTransferencia> };

    expect(response.status).toBe(200);
    expect(json.transferencia.estado).toBe(TransferenciaEstado.ANULADA);
    expect(services.anularTransferencia).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'Error de picking' }));
  });
});
