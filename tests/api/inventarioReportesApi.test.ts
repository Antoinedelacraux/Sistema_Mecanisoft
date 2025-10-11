/// <reference types="jest" />

import { GET } from '@/app/api/inventario/reportes/route';
import { getServerSession } from 'next-auth/next';
import { obtenerResumenInventario } from '@/lib/inventario/reportes';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/reportes', () => ({
  obtenerResumenInventario: jest.fn(),
}));

const getSessionMock = () => getServerSession as jest.Mock;
const getReportMock = () => obtenerResumenInventario as jest.Mock;

describe('API /api/inventario/reportes', () => {
  beforeEach(() => {
    getSessionMock().mockReset();
    getReportMock().mockReset();
  });

  it('responde 401 cuando no hay sesión', async () => {
    getSessionMock().mockResolvedValue(null);

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(401);
  });

  it('retorna el resumen de inventario', async () => {
    const resumen = {
      resumen: {
        totalProductosMonitoreados: 5,
        stockDisponibleTotal: '120',
        stockComprometidoTotal: '30',
        valorizacionTotal: '5000',
        itemsCriticos: 2,
      },
      porAlmacen: [],
      productosCriticos: [],
    };

    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    getReportMock().mockResolvedValue(resumen);

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual(resumen);
  });

  it('maneja errores inesperados', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    getReportMock().mockRejectedValue(new Error('falló'));

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(500);
  });
});
