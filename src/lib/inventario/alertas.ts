import { obtenerResumenInventario } from '@/lib/inventario/reportes';
import type { InventarioResumenCritico } from '@/types/inventario';

type AlertasStockMinimo = {
  totalCriticos: number;
  productos: InventarioResumenCritico[];
};

export const generarAlertasStockMinimo = async (): Promise<AlertasStockMinimo> => {
  const resumen = await obtenerResumenInventario();
  return {
    totalCriticos: resumen.productosCriticos.length,
    productos: resumen.productosCriticos,
  };
};
