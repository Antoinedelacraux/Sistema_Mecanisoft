'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { TransferenciaEstado } from '@prisma/client';

type MovimientoResumen = {
  id_movimiento_inventario: number;
  tipo: string;
  cantidad: string | null;
  referencia_origen: string | null;
  origen_tipo: string | null;
  observaciones: string | null;
  fecha: string;
  producto: {
    id_producto: number;
    codigo_producto: string;
    nombre: string;
    tipo: string;
  };
  inventario: {
    id_inventario_producto: number;
    id_producto: number;
    id_almacen: number;
    id_almacen_ubicacion: number | null;
    stock_disponible: string | null;
    stock_comprometido: string | null;
    stock_minimo: string | null;
    stock_maximo: string | null;
    costo_promedio: string | null;
    almacen: {
      id_almacen: number;
      nombre: string;
    } | null;
    ubicacion: {
      id_almacen_ubicacion: number;
      codigo: string;
      descripcion: string | null;
    } | null;
  };
};

type TransferenciaResumen = {
  id_movimiento_transferencia: number;
  estado: TransferenciaEstado;
  creado_en: string;
  actualizado_en: string;
  movimiento_envio: MovimientoResumen;
  movimiento_recepcion: MovimientoResumen;
};

const estadoLabel: Record<TransferenciaEstado, string> = {
  PENDIENTE_RECEPCION: 'Pendiente de recepción',
  COMPLETADA: 'Completada',
  ANULADA: 'Anulada',
};

type Props = {
  transferencias: TransferenciaResumen[];
};

const formatCantidad = (value: string | null) => {
  if (!value) return '0';
  const number = Number.parseFloat(value);
  return Number.isNaN(number) ? value : number.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TransferenciasTable = ({ transferencias }: Props) => {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (id: number, accion: 'confirmar' | 'anular') => {
    setLoadingId(id);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(`/api/inventario/transferencias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, motivo: accion === 'anular' ? 'Anulación manual desde dashboard' : undefined }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo actualizar la transferencia');
      }

      setFeedback(accion === 'confirmar' ? 'Transferencia confirmada correctamente.' : 'Transferencia anulada.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Transferencias recientes</h2>
          <p className="text-sm text-muted-foreground">Incluye las últimas diez solicitudes para dar visibilidad rápida.</p>
        </div>
        {feedback && <span className="text-sm font-medium text-emerald-600">{feedback}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-4">Código</th>
              <th className="py-2 pr-4">Producto</th>
              <th className="py-2 pr-4">Origen</th>
              <th className="py-2 pr-4">Destino</th>
              <th className="py-2 pr-4 text-right">Cantidad</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transferencias.length === 0 ? (
              <tr>
                <td className="py-4 text-muted-foreground" colSpan={7}>Aún no hay transferencias registradas.</td>
              </tr>
            ) : (
              transferencias.map((transferencia) => {
                const pendiente = transferencia.estado === 'PENDIENTE_RECEPCION';
                const origen = transferencia.movimiento_envio.inventario.almacen;
                const destino = transferencia.movimiento_recepcion.inventario.almacen;

                return (
                  <tr key={transferencia.id_movimiento_transferencia}>
                    <td className="py-2 pr-4 font-medium">TR-{transferencia.id_movimiento_transferencia}</td>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{transferencia.movimiento_envio.producto.nombre}</div>
                      <div className="text-xs text-muted-foreground">#{transferencia.movimiento_envio.producto.codigo_producto}</div>
                    </td>
                    <td className="py-2 pr-4 text-sm text-muted-foreground">
                      {origen ? `${origen.nombre} (#${origen.id_almacen})` : `Almacén #${transferencia.movimiento_envio.inventario.id_almacen}`}
                    </td>
                    <td className="py-2 pr-4 text-sm text-muted-foreground">
                      {destino ? `${destino.nombre} (#${destino.id_almacen})` : `Almacén #${transferencia.movimiento_recepcion.inventario.id_almacen}`}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">
                      {formatCantidad(transferencia.movimiento_envio.cantidad)}
                    </td>
                    <td className="py-2 pr-4 text-sm font-medium">
                      <span className={
                        transferencia.estado === 'COMPLETADA'
                          ? 'text-emerald-600'
                          : transferencia.estado === 'ANULADA'
                            ? 'text-destructive'
                            : 'text-warning-foreground'
                      }
                      >
                        {estadoLabel[transferencia.estado]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1 text-xs"
                          onClick={() => handleAction(transferencia.id_movimiento_transferencia, 'confirmar')}
                          disabled={!pendiente || loadingId === transferencia.id_movimiento_transferencia}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1 text-xs text-destructive"
                          onClick={() => handleAction(transferencia.id_movimiento_transferencia, 'anular')}
                          disabled={!pendiente || loadingId === transferencia.id_movimiento_transferencia}
                        >
                          Anular
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export type { TransferenciaResumen };
export default TransferenciasTable;
