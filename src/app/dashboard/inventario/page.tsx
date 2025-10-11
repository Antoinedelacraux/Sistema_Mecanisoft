import { Prisma } from '@prisma/client';

import MovimientoQuickForm from '@/components/inventario/movimiento-quick-form';
import TransferenciaWizard from '@/components/inventario/transferencia-wizard';
import TransferenciasTable, { type TransferenciaResumen } from '@/components/inventario/transferencias-table';
import { obtenerResumenInventario } from '@/lib/inventario/reportes';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const decimalToNumber = (value: Prisma.Decimal | null) => (value ? Number(value.toString()) : 0);
const decimalToString = (value: Prisma.Decimal | null | undefined) => (value ? value.toString() : null);
const decimalFormatter = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat('es-PE');

const movimientoInclude = {
  inventario: {
    include: {
      almacen: {
        select: {
          id_almacen: true,
          nombre: true,
        },
      },
      ubicacion: {
        select: {
          id_almacen_ubicacion: true,
          codigo: true,
          descripcion: true,
        },
      },
    },
  },
  producto: {
    select: {
      id_producto: true,
      codigo_producto: true,
      nombre: true,
      tipo: true,
    },
  },
  usuario: {
    select: {
      id_usuario: true,
      nombre_usuario: true,
      persona: {
        select: {
          nombre: true,
          apellido_paterno: true,
          apellido_materno: true,
        },
      },
    },
  },
} satisfies Prisma.MovimientoInventarioInclude;

const transferenciaInclude = {
  movimiento_envio: { include: movimientoInclude },
  movimiento_recepcion: { include: movimientoInclude },
} satisfies Prisma.MovimientoTransferenciaInclude;

const getInventarioSnapshot = async () => {
  const [inventarios, movimientos, reservas, reservasPendientesTotal, transferencias] = await prisma.$transaction([
    prisma.inventarioProducto.findMany({
      take: 5,
      orderBy: { actualizado_en: 'desc' },
      include: {
        producto: {
          select: {
            id_producto: true,
            nombre: true,
            codigo_producto: true,
            tipo: true,
          },
        },
        almacen: {
          select: {
            id_almacen: true,
            nombre: true,
          },
        },
      },
    }),
    prisma.movimientoInventario.findMany({
      take: 5,
      orderBy: { fecha: 'desc' },
      include: {
        producto: {
          select: {
            id_producto: true,
            nombre: true,
          },
        },
        usuario: {
          select: {
            id_usuario: true,
            nombre_usuario: true,
          },
        },
      },
    }),
    prisma.reservaInventario.findMany({
      take: 5,
      where: { estado: 'PENDIENTE' },
      orderBy: { creado_en: 'desc' },
      include: {
        inventario: {
          include: {
            producto: {
              select: {
                id_producto: true,
                nombre: true,
                codigo_producto: true,
              },
            },
            almacen: {
              select: {
                id_almacen: true,
                nombre: true,
              },
            },
          },
        },
        transaccion: {
          select: {
            id_transaccion: true,
            codigo_transaccion: true,
            estado_orden: true,
          },
        },
      },
    }),
    prisma.reservaInventario.count({ where: { estado: 'PENDIENTE' } }),
    prisma.movimientoTransferencia.findMany({
      take: 10,
      orderBy: { creado_en: 'desc' },
      include: transferenciaInclude,
    }),
  ]);

  return {
    inventarios,
    movimientos,
    reservas,
    reservasPendientesTotal,
    transferencias,
  };
};

const InventarioDashboardPage = async () => {
  const [snapshot, resumenInventario] = await Promise.all([
    getInventarioSnapshot(),
    obtenerResumenInventario(),
  ]);
  const { inventarios, movimientos, reservas, reservasPendientesTotal, transferencias } = snapshot;
  const transferenciasSerializadas = mapTransferencias(transferencias);
  const resumenGlobal = resumenInventario.resumen;
  const resumenPorAlmacen = resumenInventario.porAlmacen;
  const productosCriticos = resumenInventario.productosCriticos;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">Primer acercamiento al módulo — vista resumida mientras completamos el resto del roadmap.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Inventarios monitoreados</p>
          <p className="mt-2 text-2xl font-semibold">{integerFormatter.format(resumenGlobal.totalProductosMonitoreados)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Stock disponible (suma rápida)</p>
          <p className="mt-2 text-2xl font-semibold">{formatDecimalString(resumenGlobal.stockDisponibleTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Stock comprometido</p>
          <p className="mt-2 text-2xl font-semibold">{formatDecimalString(resumenGlobal.stockComprometidoTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">En nivel crítico</p>
          <p className="mt-2 text-2xl font-semibold">{integerFormatter.format(resumenGlobal.itemsCriticos)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Valorización total</p>
          <p className="mt-2 text-2xl font-semibold">S/ {formatDecimalString(resumenGlobal.valorizacionTotal)}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Valorización por almacén</h2>
          <p className="text-sm text-muted-foreground">Identifica los almacenes que concentran el mayor capital para priorizar reposiciones.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Almacén</th>
                  <th className="py-2 pr-4 text-right">Disponible</th>
                  <th className="py-2 pr-4 text-right">Comprometido</th>
                  <th className="py-2 pr-4 text-right">Valorización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resumenPorAlmacen.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={4}>Aún no hay inventarios asociados a almacenes.</td>
                  </tr>
                ) : (
                  resumenPorAlmacen.slice(0, 5).map((almacen) => (
                    <tr key={almacen.id_almacen}>
                      <td className="py-2 pr-4 font-medium">{almacen.nombre}</td>
                      <td className="py-2 pr-4 text-right">{formatDecimalString(almacen.stock_disponible)}</td>
                      <td className="py-2 pr-4 text-right">{formatDecimalString(almacen.stock_comprometido)}</td>
                      <td className="py-2 pr-4 text-right font-semibold">S/ {formatDecimalString(almacen.valorizacion)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Alertas actuales</h2>
          <p className="text-sm text-muted-foreground">Sincroniza este resumen ejecutando el cron de alertas o registrando nuevos movimientos.</p>
          <div className="mt-6 space-y-3">
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <p className="text-sm text-muted-foreground">Productos en mínimo</p>
              <p className="text-2xl font-semibold">{integerFormatter.format(productosCriticos.length)}</p>
            </div>
            <div className="rounded-md border border-border bg-background px-4 py-3">
              <p className="text-sm text-muted-foreground">Reservas pendientes</p>
              <p className="text-2xl font-semibold">{integerFormatter.format(reservasPendientesTotal)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <TransferenciaWizard />
        <TransferenciasTable transferencias={transferenciasSerializadas} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <MovimientoQuickForm />
        <div className="rounded-md border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Movimientos recientes</h2>
          <p className="text-sm text-muted-foreground">Se muestran los últimos cinco registros para validar el flujo.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Producto</th>
                  <th className="py-2 pr-4 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movimientos.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={4}>Aún no hay movimientos registrados.</td>
                  </tr>
                ) : (
                  movimientos.map((movimiento) => (
                    <tr key={movimiento.id_movimiento_inventario}>
                      <td className="py-2 pr-4 text-muted-foreground">{movementDate(movimiento.fecha)}</td>
                      <td className="py-2 pr-4 font-medium">{movimiento.tipo.replace('_', ' ')}</td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{movimiento.producto?.nombre ?? '—'}</span>
                        <span className="ml-1 text-xs text-muted-foreground">#{movimiento.id_producto}</span>
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">{decimalFormatter.format(decimalToNumber(movimiento.cantidad))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Reservas pendientes</h2>
        <p className="text-sm text-muted-foreground">Reservas activas registradas en los últimos movimientos de órdenes.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Creada</th>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Almacén</th>
                <th className="py-2 pr-4">Orden</th>
                <th className="py-2 pr-4 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reservas.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={5}>No hay reservas pendientes registradas.</td>
                </tr>
              ) : (
                reservas.map((reserva) => {
                  const producto = reserva.inventario.producto;
                  const almacen = reserva.inventario.almacen;
                  const transaccion = reserva.transaccion;

                  return (
                    <tr key={reserva.id_reserva_inventario}>
                      <td className="py-2 pr-4 text-muted-foreground">{movementDate(reserva.creado_en)}</td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{producto?.nombre ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">#{producto?.codigo_producto ?? reserva.inventario.id_inventario_producto}</div>
                      </td>
                      <td className="py-2 pr-4 text-sm text-muted-foreground">{almacen?.nombre ?? `Almacén #${reserva.inventario.id_almacen}`}</td>
                      <td className="py-2 pr-4 text-sm">
                        {transaccion ? (
                          <span className="font-medium">{transaccion.codigo_transaccion ?? `Orden #${transaccion.id_transaccion}`}</span>
                        ) : (
                          <span className="text-muted-foreground">Sin orden</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold">{decimalFormatter.format(decimalToNumber(reserva.cantidad))}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Inventario observado</h2>
        <p className="text-sm text-muted-foreground">Lista preliminar (5 registros) para corroborar stock vs. mínimos.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Almacén</th>
                <th className="py-2 pr-4 text-right">Disponible</th>
                <th className="py-2 pr-4 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventarios.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={4}>Registra un movimiento para comenzar a poblar el inventario.</td>
                </tr>
              ) : (
                inventarios.map((item) => {
                  const disponible = decimalToNumber(item.stock_disponible);
                  const minimo = decimalToNumber(item.stock_minimo);
                  const esCritico = disponible <= minimo && minimo > 0;

                  return (
                    <tr key={item.id_inventario_producto} className={esCritico ? 'bg-destructive/10' : undefined}>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{item.producto?.nombre ?? 'Producto sin nombre'}</div>
                        <div className="text-xs text-muted-foreground">#{item.producto?.codigo_producto ?? item.id_producto}</div>
                      </td>
                      <td className="py-2 pr-4 text-sm text-muted-foreground">{item.almacen?.nombre ?? `Almacén #${item.id_almacen}`}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{decimalFormatter.format(disponible)}</td>
                      <td className="py-2 pr-4 text-right">{decimalFormatter.format(minimo)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Productos en nivel crítico</h2>
        <p className="text-sm text-muted-foreground">Máximo 10 resultados priorizados por menor stock disponible para una acción rápida.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Almacén</th>
                <th className="py-2 pr-4 text-right">Disponible</th>
                <th className="py-2 pr-4 text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productosCriticos.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={4}>Sin alertas activas. Ejecuta el cron o registra nuevos movimientos para recalcular.</td>
                </tr>
              ) : (
                productosCriticos.map((producto) => (
                  <tr key={producto.id_inventario_producto} className="bg-destructive/10">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{producto.nombre}</div>
                      <div className="text-xs text-muted-foreground">#{producto.codigo_producto}</div>
                    </td>
                    <td className="py-2 pr-4 text-sm text-muted-foreground">{producto.almacen}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{formatDecimalString(producto.stock_disponible)}</td>
                    <td className="py-2 pr-4 text-right">{formatDecimalString(producto.stock_minimo)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const movementDate = (fecha: Date) => fecha.toLocaleDateString('es-PE', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const mapMovimiento = (movimiento: Prisma.MovimientoInventarioGetPayload<{ include: typeof movimientoInclude }>) => ({
  id_movimiento_inventario: movimiento.id_movimiento_inventario,
  tipo: movimiento.tipo,
  cantidad: decimalToString(movimiento.cantidad),
  referencia_origen: movimiento.referencia_origen,
  origen_tipo: movimiento.origen_tipo,
  observaciones: movimiento.observaciones,
  fecha: movimiento.fecha.toISOString(),
  producto: movimiento.producto,
  inventario: {
    id_inventario_producto: movimiento.inventario.id_inventario_producto,
    id_producto: movimiento.inventario.id_producto,
    id_almacen: movimiento.inventario.id_almacen,
    id_almacen_ubicacion: movimiento.inventario.id_almacen_ubicacion,
    stock_disponible: decimalToString(movimiento.inventario.stock_disponible),
    stock_comprometido: decimalToString(movimiento.inventario.stock_comprometido),
    stock_minimo: decimalToString(movimiento.inventario.stock_minimo),
    stock_maximo: decimalToString(movimiento.inventario.stock_maximo),
    costo_promedio: decimalToString(movimiento.inventario.costo_promedio),
    almacen: movimiento.inventario.almacen,
    ubicacion: movimiento.inventario.ubicacion,
  },
});

const mapTransferencias = (
  transferencias: Prisma.MovimientoTransferenciaGetPayload<{ include: typeof transferenciaInclude }>[],
): TransferenciaResumen[] => transferencias.map((transferencia) => ({
    id_movimiento_transferencia: transferencia.id_movimiento_transferencia,
    estado: transferencia.estado,
    creado_en: transferencia.creado_en.toISOString(),
    actualizado_en: transferencia.actualizado_en.toISOString(),
    movimiento_envio: mapMovimiento(transferencia.movimiento_envio),
    movimiento_recepcion: mapMovimiento(transferencia.movimiento_recepcion),
  }));

const formatDecimalString = (value: string | null) => {
  if (!value) return '0.00';
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return value;
  return decimalFormatter.format(parsed);
};

export default InventarioDashboardPage;
