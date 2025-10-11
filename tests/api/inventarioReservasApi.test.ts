/// <reference types="jest" />

import { NextRequest } from 'next/server';
import { Prisma, ReservaEstado } from '@prisma/client';

import { GET, PATCH, POST } from '@/app/api/inventario/reservas/route';
import { InventarioError } from '@/types/inventario';
import { getServerSession } from 'next-auth/next';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/reservas', () => ({
  reservarStock: jest.fn(),
  confirmarReserva: jest.fn(),
  liberarReserva: jest.fn(),
  cancelarReserva: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const reservaInventario = {
    findMany: jest.fn<Promise<unknown[]>, [unknown?]>(),
    count: jest.fn<Promise<number>, [unknown?]>(),
  };

  const prismaMock = {
    reservaInventario,
    $transaction: jest.fn<Promise<unknown[]>, [Promise<unknown>[]]>(async (operations) => Promise.all(operations)),
  };

  return { prisma: prismaMock };
});

type PrismaMock = {
  reservaInventario: {
    findMany: jest.Mock<Promise<unknown[]>, [unknown?]>;
    count: jest.Mock<Promise<number>, [unknown?]>;
  };
  $transaction: jest.Mock<Promise<unknown[]>, [Promise<unknown>[]]>;
};

type ReservaServicesMock = {
  reservarStock: jest.Mock;
  confirmarReserva: jest.Mock;
  liberarReserva: jest.Mock;
  cancelarReserva: jest.Mock;
};

const getSessionMock = () => getServerSession as jest.Mock;
const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }).prisma;
const getServiceMocks = () => jest.requireMock('@/lib/inventario/reservas') as ReservaServicesMock;

const buildReserva = () => ({
  id_reserva_inventario: 123,
  id_inventario_producto: 5,
  id_transaccion: 77,
  id_detalle_transaccion: 88,
  cantidad: new Prisma.Decimal('3'),
  estado: ReservaEstado.PENDIENTE,
  motivo: 'Reserva inicial',
  metadata: { origen: 'orden' },
  creado_en: new Date('2025-01-02T00:00:00.000Z'),
  actualizado_en: new Date('2025-01-02T00:00:00.000Z'),
  inventario: {
    id_inventario_producto: 5,
    id_producto: 99,
    id_almacen: 4,
    id_almacen_ubicacion: null,
    stock_disponible: new Prisma.Decimal('7'),
    stock_comprometido: new Prisma.Decimal('3'),
    stock_minimo: new Prisma.Decimal('1'),
    stock_maximo: null,
    costo_promedio: new Prisma.Decimal('15.5'),
    creado_en: new Date('2025-01-01T00:00:00.000Z'),
    actualizado_en: new Date('2025-01-01T00:00:00.000Z'),
    producto: {
      id_producto: 99,
      codigo_producto: 'P-099',
      nombre: 'Pastillas de freno',
      tipo: 'producto',
    },
    almacen: {
      id_almacen: 4,
      nombre: 'Principal',
      descripcion: 'Almacén central',
      direccion: null,
      activo: true,
      creado_en: new Date('2024-12-01T00:00:00.000Z'),
      actualizado_en: new Date('2024-12-01T00:00:00.000Z'),
    },
    ubicacion: null,
  },
  transaccion: {
    id_transaccion: 77,
    codigo_transaccion: 'OT-0001',
    tipo_transaccion: 'orden',
    estado_orden: 'pendiente',
    fecha: new Date('2025-01-02T00:00:00.000Z'),
    id_persona: 1,
    id_usuario: 1,
    id_trabajador_principal: null,
    tipo_comprobante: 'orden',
    serie_comprobante: null,
    numero_comprobante: null,
    descuento: new Prisma.Decimal('0'),
    impuesto: new Prisma.Decimal('0'),
    porcentaje: new Prisma.Decimal('0'),
    total: new Prisma.Decimal('150'),
    cantidad_pago: new Prisma.Decimal('0'),
    observaciones: null,
    estatus: 'activo',
    prioridad: 'media',
    fecha_inicio: null,
    fecha_fin_estimada: null,
    fecha_fin_real: null,
    duracion_min: null,
    duracion_max: null,
    unidad_tiempo: null,
    estado_pago: 'pendiente',
    fecha_entrega: null,
    entregado_por: null,
    created_at: new Date('2025-01-02T00:00:00.000Z'),
    updated_at: new Date('2025-01-02T00:00:00.000Z'),
    persona: {} as unknown,
    usuario: {} as unknown,
    trabajador_principal: null,
    transaccion_trabajadores: [],
    usuario_entrega: null,
    detalles_transaccion: [],
    transaccion_proveedores: [],
    transaccion_vehiculos: [],
    pagos: [],
    comprobantes: [],
    reservas_inventario: [],
  },
  detalle_transaccion: {
    id_detalle_transaccion: 88,
    id_transaccion: 77,
    id_producto: 99,
    id_servicio: null,
    cantidad: 2,
    precio: new Prisma.Decimal('50'),
    descuento: new Prisma.Decimal('0'),
    total: new Prisma.Decimal('100'),
    estatus: true,
    id_detalle_servicio_asociado: null,
    transaccion: {} as unknown,
    producto: {} as unknown,
    servicio: null,
    servicio_asociado: null,
    productos_asociados: [],
    tareas: [],
    reservas: [],
  },
});

describe('API /api/inventario/reservas', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.reservaInventario.findMany.mockReset();
    prisma.reservaInventario.count.mockReset();
    prisma.$transaction.mockClear();
    const services = getServiceMocks();
    services.reservarStock.mockReset();
    services.confirmarReserva.mockReset();
    services.liberarReserva.mockReset();
    services.cancelarReserva.mockReset();
    getSessionMock().mockReset();
  });

  it('GET responde 401 sin sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/inventario/reservas');
  const response = await GET(request);
  if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(401);
  });

  it('GET devuelve reservas serializadas con paginación', async () => {
    const prisma = getPrismaMock();
    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    prisma.reservaInventario.findMany.mockResolvedValue([buildReserva()]);
    prisma.reservaInventario.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/inventario/reservas?page=1&limit=5');
  const response = await GET(request);
  if (!response) throw new Error('La respuesta no debe ser indefinida');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reservas).toHaveLength(1);
    expect(json.reservas[0].cantidad).toBe('3');
    expect(json.reservas[0].inventario.stock_comprometido).toBe('3');
    expect(json.pagination.total).toBe(1);
  });

  it('POST responde 401 sin sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

  const response = await POST(request);
  if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(401);
  });

  it('POST crea una reserva con el servicio dedicado', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '9' } });
    services.reservarStock.mockResolvedValue(buildReserva());

    const payload = {
      productoId: 99,
      almacenId: 4,
      cantidad: '3',
      motivo: 'Reserva para orden',
    };

    const request = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  const response = await POST(request);
  if (!response) throw new Error('La respuesta no debe ser indefinida');
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(services.reservarStock).toHaveBeenCalledWith(expect.objectContaining({
      productoId: 99,
      usuarioId: 9,
    }));
    expect(json.reserva.estado).toBe('PENDIENTE');
  });

  it('PATCH permite confirmar una reserva', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '5' } });
    services.confirmarReserva.mockResolvedValue({
      ...buildReserva(),
      estado: ReservaEstado.CONFIRMADA,
    });

    const request = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId: 123, accion: 'confirmar' }),
    });

  const response = await PATCH(request);
  if (!response) throw new Error('La respuesta no debe ser indefinida');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(services.confirmarReserva).toHaveBeenCalledWith(expect.objectContaining({ reservaId: 123, usuarioId: 5 }));
    expect(json.reserva.estado).toBe('CONFIRMADA');
  });

  it('PATCH deriva a liberar y cancelar según la acción', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '8' } });
    services.liberarReserva.mockResolvedValue({ ...buildReserva(), estado: ReservaEstado.LIBERADA });

    const liberarRequest = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId: 123, accion: 'liberar', motivo: 'Orden cancelada' }),
    });

  const liberarResponse = await PATCH(liberarRequest);
  if (!liberarResponse) throw new Error('La respuesta no debe ser indefinida');
    expect(liberarResponse.status).toBe(200);
    expect(services.liberarReserva).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'Orden cancelada' }));

    services.cancelarReserva.mockResolvedValue({ ...buildReserva(), estado: ReservaEstado.CANCELADA });
    const cancelarRequest = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId: 123, accion: 'cancelar' }),
    });

  const cancelarResponse = await PATCH(cancelarRequest);
  if (!cancelarResponse) throw new Error('La respuesta no debe ser indefinida');
    expect(cancelarResponse.status).toBe(200);
    expect(services.cancelarReserva).toHaveBeenCalledWith(expect.objectContaining({ reservaId: 123 }));
  });

  it('maneja errores de validación y de dominio correctamente', async () => {
    const services = getServiceMocks();
    getSessionMock().mockResolvedValue({ user: { id: '9' } });

    const badRequest = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId: 1 }),
    });

  const badResponse = await POST(badRequest);
  if (!badResponse) throw new Error('La respuesta no debe ser indefinida');
    expect(badResponse.status).toBe(422);

    services.confirmarReserva.mockRejectedValue(new InventarioError('No pendiente', 409, 'RESERVA_NO_PENDIENTE'));
    const request = new NextRequest('http://localhost/api/inventario/reservas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId: 123, accion: 'confirmar' }),
    });

  const response = await PATCH(request);
  if (!response) throw new Error('La respuesta no debe ser indefinida');
    const json = await response.json();
    expect(response.status).toBe(409);
    expect(json.code).toBe('RESERVA_NO_PENDIENTE');
  });
});
