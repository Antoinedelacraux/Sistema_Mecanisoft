/// <reference types="jest" />

import { generarAlertasStockMinimo } from '@/lib/inventario/alertas';
import { obtenerResumenInventario } from '@/lib/inventario/reportes';

jest.mock('@/lib/inventario/reportes', () => ({
  obtenerResumenInventario: jest.fn(),
}));

describe('generarAlertasStockMinimo', () => {
  beforeEach(() => {
    (obtenerResumenInventario as jest.Mock).mockReset();
  });

  it('devuelve total y productos críticos a partir del resumen', async () => {
    (obtenerResumenInventario as jest.Mock).mockResolvedValue({
      resumen: {
        totalProductosMonitoreados: 3,
        stockDisponibleTotal: '12',
        stockComprometidoTotal: '3',
        valorizacionTotal: '285',
        itemsCriticos: 1,
      },
      porAlmacen: [],
      productosCriticos: [
        {
          id_inventario_producto: 1,
          id_producto: 10,
          codigo_producto: 'F-001',
          nombre: 'Filtro de aceite',
          id_almacen: 1,
          almacen: 'Central',
          stock_disponible: '2',
          stock_minimo: '3',
        },
      ],
    });

    const resultado = await generarAlertasStockMinimo();

    expect(resultado.totalCriticos).toBe(1);
    expect(resultado.productos).toHaveLength(1);
    expect(resultado.productos[0].nombre).toBe('Filtro de aceite');
  });
});
