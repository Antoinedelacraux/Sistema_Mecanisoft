/// <reference types="jest" />

import { GET } from '@/app/api/inventario/alertas/cron/route';
import { getServerSession } from 'next-auth/next';
import { generarAlertasStockMinimo } from '@/lib/inventario/alertas';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/alertas', () => ({
  generarAlertasStockMinimo: jest.fn(),
}));

const getSessionMock = () => getServerSession as jest.Mock;
const getAlertasMock = () => generarAlertasStockMinimo as jest.Mock;

describe('API /api/inventario/alertas/cron', () => {
  beforeEach(() => {
    getSessionMock().mockReset();
    getAlertasMock().mockReset();
  });

  it('requiere autenticación', async () => {
    getSessionMock().mockResolvedValue(null);

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(401);
  });

  it('retorna alertas de stock mínimo', async () => {
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
    getAlertasMock().mockResolvedValue(payload);

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.totalCriticos).toBe(payload.totalCriticos);
    expect(json.productos).toHaveLength(payload.productos.length);
    expect(json.generatedAt).toBeDefined();
  });

  it('captura errores inesperados', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '4' } });
    getAlertasMock().mockRejectedValue(new Error('falló'));

    const response = await GET();
    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(500);
  });
});
