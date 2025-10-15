/// <reference types="jest" />

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { GET as listAlmacenes, POST as createAlmacen } from '@/app/api/inventario/almacenes/route';
import { GET as getAlmacen, PUT as updateAlmacen, DELETE as deleteAlmacen } from '@/app/api/inventario/almacenes/[id]/route';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const almacen = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const prismaMock = {
    almacen,
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };

  return { prisma: prismaMock };
});

type PrismaMock = {
  almacen: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const getSessionMock = () => getServerSession as jest.Mock;
const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }).prisma;

const buildSession = (
  role: string = 'Administrador',
  permisos: string[] = ['inventario.ver', 'inventario.movimientos']
) => ({ user: { id: '1', role, permisos } });

const buildAlmacen = () => ({
  id_almacen: 1,
  nombre: 'Central',
  descripcion: 'Principal',
  direccion: 'Av. Siempre Viva 123',
  activo: true,
  creado_en: new Date('2025-01-01T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
  _count: {
    ubicaciones: 2,
    inventarios: 5,
  },
});

const buildAlmacenWithUbicaciones = () => ({
  id_almacen: 1,
  nombre: 'Central',
  descripcion: 'Principal',
  direccion: 'Av. Siempre Viva 123',
  activo: true,
  creado_en: new Date('2025-01-01T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
  ubicaciones: [
    {
      id_almacen_ubicacion: 10,
      codigo: 'A1',
      descripcion: 'Pasillo A1',
      activo: true,
      creado_en: new Date('2025-01-01T00:00:00.000Z'),
      actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
    },
  ],
});

describe('API /api/inventario/almacenes', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.almacen.findMany.mockReset();
    prisma.almacen.count.mockReset();
    prisma.almacen.create.mockReset();
    prisma.almacen.findUnique.mockReset();
    prisma.almacen.update.mockReset();
    prisma.$transaction.mockClear();
    getSessionMock().mockReset();
  });

  it('GET responde 401 sin sesión', async () => {
    const request = new NextRequest('http://localhost/api/inventario/almacenes');
  getSessionMock().mockResolvedValue(null);

    const response = await listAlmacenes(request);
    expect(response.status).toBe(401);
  });

  it('GET responde 403 sin rol autorizado', async () => {
    const request = new NextRequest('http://localhost/api/inventario/almacenes');
  getSessionMock().mockResolvedValue(buildSession('Recepcionista', []));

    const response = await listAlmacenes(request);
    expect(response.status).toBe(403);
  });

  it('GET retorna listado paginado', async () => {
    const prisma = getPrismaMock();
    const almacen = buildAlmacen();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findMany.mockResolvedValue([almacen]);
    prisma.almacen.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/inventario/almacenes?page=1&limit=10');
    const response = await listAlmacenes(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.almacenes).toHaveLength(1);
    expect(json.almacenes[0].nombre).toBe('Central');
    expect(json.pagination.total).toBe(1);
  });

  it('POST crea un almacén', async () => {
    const prisma = getPrismaMock();
    const almacen = buildAlmacen();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.create.mockResolvedValue(almacen);

    const request = new NextRequest('http://localhost/api/inventario/almacenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Central', descripcion: 'Principal' }),
    });

    const response = await createAlmacen(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(prisma.almacen.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nombre: 'Central' }),
    }));
    expect(json.almacen.nombre).toBe('Central');
  });

  it('GET /:id retorna el detalle', async () => {
    const prisma = getPrismaMock();
    const almacen = buildAlmacenWithUbicaciones();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.findUnique.mockResolvedValue(almacen);

    const response = await getAlmacen(new NextRequest('http://localhost/api/inventario/almacenes/1'), {
      params: Promise.resolve({ id: '1' }),
    });
    if (!response) {
      throw new Error('Response no definido');
    }
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.almacen.ubicaciones).toHaveLength(1);
    expect(prisma.almacen.findUnique).toHaveBeenCalled();
  });

  it('PUT /:id actualiza un almacén', async () => {
    const prisma = getPrismaMock();
    const almacen = buildAlmacenWithUbicaciones();

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.update.mockResolvedValue({ ...almacen, nombre: 'Central Actualizado' });

    const request = new NextRequest('http://localhost/api/inventario/almacenes/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Central Actualizado' }),
    });

    const response = await updateAlmacen(request, { params: Promise.resolve({ id: '1' }) });
    if (!response) {
      throw new Error('Response no definido');
    }
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.almacen.nombre).toBe('Central Actualizado');
  });

  it('DELETE /:id desactiva un almacén', async () => {
    const prisma = getPrismaMock();
    const almacen = { ...buildAlmacenWithUbicaciones(), activo: false };

  getSessionMock().mockResolvedValue(buildSession());
    prisma.almacen.update.mockResolvedValue(almacen);

    const response = await deleteAlmacen(new NextRequest('http://localhost/api/inventario/almacenes/1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '1' }),
    });
    if (!response) {
      throw new Error('Response no definido');
    }
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.almacen.activo).toBe(false);
    expect(prisma.almacen.update).toHaveBeenCalledWith(expect.objectContaining({ data: { activo: false } }));
  });
});
