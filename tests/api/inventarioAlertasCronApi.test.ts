/// <reference types="jest" />

import { GET } from '@/app/api/inventario/alertas/cron/route';
import { getServerSession } from 'next-auth/next';
import { generarAlertasStockMinimo } from '@/lib/inventario/alertas';
import { asegurarPermiso, PermisoDenegadoError } from '@/lib/permisos/guards';
import { enqueueInventoryAlertNotification } from '@/lib/inventario/alertas-notifier';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/alertas', () => ({
  generarAlertasStockMinimo: jest.fn(),
}));

jest.mock('@/lib/permisos/guards', () => {
  const actual = jest.requireActual('@/lib/permisos/guards');
  return {
    ...actual,
    asegurarPermiso: jest.fn(),
  };
});

jest.mock('@/lib/inventario/alertas-notifier', () => ({
  enqueueInventoryAlertNotification: jest.fn(),
}));

const getSessionMock = () => getServerSession as jest.Mock;
const getAlertasMock = () => generarAlertasStockMinimo as jest.Mock;
const getPermisoMock = () => asegurarPermiso as jest.Mock;
const getNotifierMock = () => enqueueInventoryAlertNotification as jest.Mock;

describe('API /api/inventario/alertas/cron', () => {
  beforeEach(() => {
    getSessionMock().mockReset();
    getAlertasMock().mockReset();
    getPermisoMock().mockReset();
    getNotifierMock().mockReset();
  });

  it('requiere autenticación', async () => {
    getSessionMock().mockResolvedValue(null);

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(401);
    expect(getPermisoMock()).not.toHaveBeenCalled();
  });

  it('requiere permiso inventario.alertas', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '4' } });
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('inventario.alertas'));

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(403);
    expect(getAlertasMock()).not.toHaveBeenCalled();
  });

  it('retorna alertas de stock mínimo y encola notificación', async () => {
    const payload = {
      totalCriticos: 2,
      productos: [
        {
          id_inventario_producto: 1,
          id_producto: 10,
          codigo_producto: 'P-10',
          nombre: 'Producto 10',
          id_almacen: 1,
          almacen: 'Central',
          stock_disponible: '2',
          stock_minimo: '3',
        },
      ],
    };

    getSessionMock().mockResolvedValue({ user: { id: '4' } });
    getPermisoMock().mockResolvedValue(undefined);
    getAlertasMock().mockResolvedValue(payload);
    getNotifierMock().mockResolvedValue({ queued: true, recipients: ['ops@example.com'] });

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.totalCriticos).toBe(payload.totalCriticos);
    expect(json.productos).toHaveLength(payload.productos.length);
    expect(json.generatedAt).toBeDefined();
    expect(json.notification).toEqual({ queued: true, recipients: ['ops@example.com'] });
    expect(getNotifierMock()).toHaveBeenCalledWith(expect.objectContaining({ totalCriticos: payload.totalCriticos }));
  });

  it('omite notificación cuando no hay productos críticos', async () => {
    const payload = { totalCriticos: 0, productos: [] };
    getSessionMock().mockResolvedValue({ user: { id: '8' } });
    getPermisoMock().mockResolvedValue(undefined);
    getAlertasMock().mockResolvedValue(payload);
    getNotifierMock().mockResolvedValue({ queued: false, recipients: ['ops@example.com'], reason: 'NO_ALERTS' });

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.notification).toEqual({ queued: false, recipients: ['ops@example.com'], reason: 'NO_ALERTS' });
  });

  it('captura errores inesperados', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '4' } });
    getPermisoMock().mockResolvedValue(undefined);
    getAlertasMock().mockRejectedValue(new Error('falló'));

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(500);
    expect(getNotifierMock()).not.toHaveBeenCalled();
  });
});
