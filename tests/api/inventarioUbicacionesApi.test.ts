/// <reference types="jest" />

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { GET as listUbicaciones, POST as createUbicacion } from '@/app/api/inventario/almacenes/[id]/ubicaciones/route';
import { GET as getUbicacion, PUT as updateUbicacion, DELETE as deleteUbicacion } from '@/app/api/inventario/almacenes/[id]/ubicaciones/[ubicacionId]/route';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const almacen = {
    findUnique: jest.fn(),
  };

  const almacenUbicacion = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  };

  const prismaMock = {
    almacen,
    almacenUbicacion,
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };

  return { prisma: prismaMock };
});

type PrismaMock = {
  almacen: {
    findUnique: jest.Mock;
  };
  almacenUbicacion: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

const getSessionMock = () => getServerSession as jest.Mock;
const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }).prisma;

const buildSession = (
  role: string = 'Administrador',
  permisos: string[] = ['inventario.ver', 'inventario.movimientos']
) => ({ user: { id: '1', role, permisos } });

const buildUbicacion = () => ({
  id_almacen_ubicacion: 10,
  codigo: 'A1',
  descripcion: 'Pasillo A1',
  activo: true,
  creado_en: new Date('2025-01-01T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
});

describe('API /api/inventario/almacenes/:id/ubicaciones', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.almacen.findUnique.mockReset();
    prisma.almacenUbicacion.findMany.mockReset();
    prisma.almacenUbicacion.count.mockReset();
    prisma.almacenUbicacion.create.mockReset();
    prisma.almacenUbicacion.findFirst.mockReset();
    prisma.almacenUbicacion.updateMany.mockReset();
    prisma.$transaction.mockClear();
    getSessionMock().mockReset();
  });

  it('GET responde 401 sin sesión', async () => {
    const request = new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones');
  getSessionMock().mockResolvedValue(null);

    const response = await listUbicaciones(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(401);
  });

  it('GET responde 403 sin rol autorizado', async () => {
    const request = new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones');
  getSessionMock().mockResolvedValue(buildSession('Recepcionista', []));

    const response = await listUbicaciones(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(403);
  });

  it('GET responde 404 si no existe el almacén', async () => {
    const prisma = getPrismaMock();
  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue(null);

    const response = await listUbicaciones(new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones'), {
      params: Promise.resolve({ id: '1' }),
    });

    expect(response.status).toBe(404);
  });

  it('GET retorna ubicaciones paginadas', async () => {
    const prisma = getPrismaMock();
    const ubicacion = buildUbicacion();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue({ id_almacen: 1 });
    prisma.almacenUbicacion.findMany.mockResolvedValue([ubicacion]);
    prisma.almacenUbicacion.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones?page=1');
    const response = await listUbicaciones(request, { params: Promise.resolve({ id: '1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ubicaciones).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it('POST crea una ubicación', async () => {
    const prisma = getPrismaMock();
    const ubicacion = buildUbicacion();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue({ id_almacen: 1 });
    prisma.almacenUbicacion.create.mockResolvedValue(ubicacion);

    const request = new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: 'A1', descripcion: 'Pasillo A1' }),
    });

    const response = await createUbicacion(request, { params: Promise.resolve({ id: '1' }) });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(prisma.almacenUbicacion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ codigo: 'A1' }),
    }));
    expect(json.ubicacion.codigo).toBe('A1');
  });

  it('GET /:ubicacionId retorna el detalle', async () => {
    const prisma = getPrismaMock();
    const ubicacion = buildUbicacion();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue({ id_almacen: 1 });
    prisma.almacenUbicacion.findFirst.mockResolvedValue(ubicacion);

    const response = await getUbicacion(new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones/10'), {
      params: Promise.resolve({ id: '1', ubicacionId: '10' }),
    });
    if (!response) {
      throw new Error('Response no definido');
    }
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ubicacion.codigo).toBe('A1');
  });

  it('PUT /:ubicacionId actualiza una ubicación existente', async () => {
    const prisma = getPrismaMock();
    const ubicacion = { ...buildUbicacion(), descripcion: 'Actualizado' };

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue({ id_almacen: 1 });
    prisma.almacenUbicacion.updateMany.mockResolvedValue({ count: 1 });
    prisma.almacenUbicacion.findFirst.mockResolvedValue(ubicacion);

    const request = new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones/10', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: 'Actualizado' }),
    });

    const response = await updateUbicacion(request, { params: Promise.resolve({ id: '1', ubicacionId: '10' }) });
    if (!response) {
      throw new Error('Response no definido');
    }
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ubicacion.descripcion).toBe('Actualizado');
  });

  it('DELETE /:ubicacionId desactiva una ubicación', async () => {
    const prisma = getPrismaMock();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue({ id_almacen: 1 });
    prisma.almacenUbicacion.updateMany.mockResolvedValue({ count: 1 });
    prisma.almacenUbicacion.findFirst.mockResolvedValue({ ...buildUbicacion(), activo: false });

    const response = await deleteUbicacion(new NextRequest('http://localhost/api/inventario/almacenes/1/ubicaciones/10', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1', ubicacionId: '10' }),
    });
    if (!response) {
      throw new Error('Response no definido');
    }

    expect(response.status).toBe(200);
    expect(prisma.almacenUbicacion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { activo: false },
    }));
  });
});
