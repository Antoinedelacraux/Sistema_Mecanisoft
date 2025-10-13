/// <reference types="jest" />

import { GET } from '@/app/api/inventario/reportes/route';
import { getServerSession } from 'next-auth/next';
import { obtenerResumenInventario } from '@/lib/inventario/reportes';
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/inventario/reportes', () => ({
  obtenerResumenInventario: jest.fn(),
}));

jest.mock('@/lib/permisos/guards', () => {
  const actual = jest.requireActual('@/lib/permisos/guards');
  return {
    ...actual,
    asegurarPermiso: jest.fn(),
  };
});

const getSessionMock = () => getServerSession as jest.Mock;
const getReportMock = () => obtenerResumenInventario as jest.Mock;
const getPermisoMock = () => asegurarPermiso as jest.Mock;

describe('API /api/inventario/reportes', () => {
  beforeEach(() => {
    getSessionMock().mockReset();
    getReportMock().mockReset();
    getPermisoMock().mockReset();
  });

  it('responde 401 cuando no hay sesión', async () => {
    getSessionMock().mockResolvedValue(null);
    getPermisoMock().mockRejectedValue(new SesionInvalidaError());

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(401);
  });

  it('responde 403 cuando falta el permiso requerido', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('reportes.ver'));

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(403);
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
    getPermisoMock().mockResolvedValue(undefined);
    getReportMock().mockResolvedValue(resumen);

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual(resumen);
  });

  it('maneja errores inesperados', async () => {
    getSessionMock().mockResolvedValue({ user: { id: '7' } });
    getPermisoMock().mockResolvedValue(undefined);
    getReportMock().mockRejectedValue(new Error('falló'));

    const response = await GET();

    if (!response) throw new Error('La respuesta no debe ser indefinida');
    expect(response.status).toBe(500);
  });
});
