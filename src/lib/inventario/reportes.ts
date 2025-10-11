import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { DECIMAL_ZERO } from '@/lib/inventario/services';
import type {
  InventarioResumenGlobal,
  InventarioResumenPorAlmacen,
  InventarioResumenResponse,
} from '@/types/inventario';

const toDecimal = (value: Prisma.Decimal | null) => value ?? DECIMAL_ZERO;

const serializeDecimal = (value: Prisma.Decimal) => value.toString();

const calcularResumenPorAlmacen = (items: Array<InventarioResumenPorAlmacen & { almacen: { id_almacen: number; nombre: string } }>) => {
  const map = new Map<number, InventarioResumenPorAlmacen>();

  for (const item of items) {
    const key = item.almacen.id_almacen;
    const actual = map.get(key) ?? {
      id_almacen: item.almacen.id_almacen,
      nombre: item.almacen.nombre,
      stock_disponible: DECIMAL_ZERO,
      stock_comprometido: DECIMAL_ZERO,
      valorizacion: DECIMAL_ZERO,
    };

    map.set(key, {
      ...actual,
      stock_disponible: actual.stock_disponible.add(item.stock_disponible),
      stock_comprometido: actual.stock_comprometido.add(item.stock_comprometido),
      valorizacion: actual.valorizacion.add(item.valorizacion),
    });
  }

  return Array.from(map.values()).sort((a, b) => b.valorizacion.comparedTo(a.valorizacion));
};

export const obtenerResumenInventario = async (): Promise<InventarioResumenResponse> => {
  const inventarios = await prisma.inventarioProducto.findMany({
    where: { producto: { estatus: true } },
    include: {
      almacen: {
        select: {
          id_almacen: true,
          nombre: true,
        },
      },
      producto: {
        select: {
          id_producto: true,
          nombre: true,
          codigo_producto: true,
          tipo: true,
        },
      },
    },
  });

  let stockDisponibleTotal = DECIMAL_ZERO;
  let stockComprometidoTotal = DECIMAL_ZERO;
  let valorizacionTotal = DECIMAL_ZERO;
  let criticos = 0;

  const porAlmacenBase: Array<InventarioResumenPorAlmacen & { almacen: { id_almacen: number; nombre: string } }> = [];

  const productosCriticos = [] as InventarioResumenResponse['productosCriticos'];

  for (const item of inventarios) {
    const stockDisponible = toDecimal(item.stock_disponible);
    const stockComprometido = toDecimal(item.stock_comprometido);
    const costoPromedio = toDecimal(item.costo_promedio);
    const stockMinimo = toDecimal(item.stock_minimo);

    stockDisponibleTotal = stockDisponibleTotal.add(stockDisponible);
    stockComprometidoTotal = stockComprometidoTotal.add(stockComprometido);

    const valorizacionItem = stockDisponible.mul(costoPromedio);
    valorizacionTotal = valorizacionTotal.add(valorizacionItem);

    porAlmacenBase.push({
      id_almacen: item.id_almacen,
      nombre: item.almacen?.nombre ?? `Almacén #${item.id_almacen}`,
      stock_disponible: stockDisponible,
      stock_comprometido: stockComprometido,
      valorizacion: valorizacionItem,
      almacen: {
        id_almacen: item.almacen?.id_almacen ?? item.id_almacen,
        nombre: item.almacen?.nombre ?? `Almacén #${item.id_almacen}`,
      },
    });

    if (stockMinimo.gt(DECIMAL_ZERO) && stockDisponible.lte(stockMinimo)) {
      criticos += 1;
      productosCriticos.push({
        id_inventario_producto: item.id_inventario_producto,
        id_producto: item.id_producto,
        codigo_producto: item.producto?.codigo_producto ?? '',
        nombre: item.producto?.nombre ?? 'Producto sin nombre',
        id_almacen: item.id_almacen,
        almacen: item.almacen?.nombre ?? `Almacén #${item.id_almacen}`,
        stock_disponible: serializeDecimal(stockDisponible),
        stock_minimo: serializeDecimal(stockMinimo),
      });
    }
  }

  const resumenPorAlmacen = calcularResumenPorAlmacen(porAlmacenBase).map((item) => ({
    id_almacen: item.id_almacen,
    nombre: item.nombre,
    stock_disponible: serializeDecimal(item.stock_disponible),
    stock_comprometido: serializeDecimal(item.stock_comprometido),
    valorizacion: serializeDecimal(item.valorizacion),
  }));

  const resumenGlobal: InventarioResumenGlobal = {
    totalProductosMonitoreados: inventarios.length,
    stockDisponibleTotal: serializeDecimal(stockDisponibleTotal),
    stockComprometidoTotal: serializeDecimal(stockComprometidoTotal),
    valorizacionTotal: serializeDecimal(valorizacionTotal),
    itemsCriticos: criticos,
  };

  return {
    resumen: resumenGlobal,
    porAlmacen: resumenPorAlmacen,
    productosCriticos: productosCriticos
      .sort((a, b) => Number.parseFloat(a.stock_disponible) - Number.parseFloat(b.stock_disponible))
      .slice(0, 10),
  };
};
