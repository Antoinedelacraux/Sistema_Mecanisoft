'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AlmacenSelect, UbicacionSelect } from '@/components/inventario/selectors';

const TIPO_MOVIMIENTO_OPTIONS = [
  { value: 'INGRESO', label: 'Ingreso' },
  { value: 'SALIDA', label: 'Salida' },
  { value: 'AJUSTE_POSITIVO', label: 'Ajuste (+)' },
  { value: 'AJUSTE_NEGATIVO', label: 'Ajuste (-)' },
];

type MovimientoFormState = {
  tipo: 'INGRESO' | 'SALIDA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';
  productoId: string;
  almacenId: string;
  ubicacionId: string;
  cantidad: string;
  costoUnitario: string;
  motivo: string;
  referencia: string;
};

const INITIAL_STATE: MovimientoFormState = {
  tipo: 'INGRESO',
  productoId: '',
  almacenId: '',
  ubicacionId: '',
  cantidad: '',
  costoUnitario: '',
  motivo: '',
  referencia: '',
};

const parseNumber = (value: string) => (value.trim().length ? value.trim() : '');

const MovimientoQuickForm = ({ onSuccess }: { onSuccess?: () => void }) => {
  const router = useRouter();
  const [form, setForm] = useState<MovimientoFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof MovimientoFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSelectAlmacen = (value: string) => {
    setForm((prev) => ({ ...prev, almacenId: value, ubicacionId: '' }));
  };

  const handleSelectUbicacion = (value: string) => {
    setForm((prev) => ({ ...prev, ubicacionId: value }));
  };

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!form.productoId || !form.almacenId || !form.cantidad) {
      setError('Completa producto, almacén y cantidad');
      return;
    }

    if (form.tipo === 'INGRESO' && !form.costoUnitario) {
      setError('El ingreso requiere costo unitario');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        tipo: form.tipo,
        productoId: Number.parseInt(form.productoId, 10),
        almacenId: Number.parseInt(form.almacenId, 10),
        cantidad: parseNumber(form.cantidad),
        referencia: form.referencia.trim() || undefined,
      };

      if (form.ubicacionId) {
        payload.ubicacionId = Number.parseInt(form.ubicacionId, 10);
      }

      if (form.tipo === 'INGRESO') {
        payload.costoUnitario = parseNumber(form.costoUnitario);
      }

      if (form.tipo.startsWith('AJUSTE')) {
        payload.motivo = form.motivo.trim() || 'Ajuste manual';
      }

      const response = await fetch('/api/inventario/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info.error || 'No se pudo registrar el movimiento');
      }

      setMessage('Movimiento registrado correctamente');
  setForm(INITIAL_STATE);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Registrar movimiento rápido</h2>
      <p className="text-sm text-muted-foreground">Ingresa IDs directos mientras completamos la vista avanzada.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="tipo">Tipo de movimiento</label>
          <select
            id="tipo"
            className="rounded-md border border-input bg-background p-2"
            value={form.tipo}
            onChange={handleChange('tipo')}
            disabled={isSubmitting}
          >
            {TIPO_MOVIMIENTO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="productoId">ID de producto</label>
          <input
            id="productoId"
            type="number"
            className="rounded-md border border-input bg-background p-2"
            value={form.productoId}
            onChange={handleChange('productoId')}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="almacenId">Almacén</label>
          <AlmacenSelect
            id="almacenId"
            value={form.almacenId}
            onChange={handleSelectAlmacen}
            disabled={isSubmitting}
            placeholder="Selecciona un almacén"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="ubicacionId">Ubicación (opcional)</label>
          <UbicacionSelect
            id="ubicacionId"
            almacenId={form.almacenId ? form.almacenId : null}
            value={form.ubicacionId}
            onChange={handleSelectUbicacion}
            disabled={isSubmitting}
            allowSinUbicacion
            placeholder="Selecciona una ubicación"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="cantidad">Cantidad</label>
          <input
            id="cantidad"
            type="number"
            step="0.01"
            className="rounded-md border border-input bg-background p-2"
            value={form.cantidad}
            onChange={handleChange('cantidad')}
            disabled={isSubmitting}
            required
          />
        </div>

        {form.tipo === 'INGRESO' && (
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="costoUnitario">Costo unitario</label>
            <input
              id="costoUnitario"
              type="number"
              step="0.01"
              className="rounded-md border border-input bg-background p-2"
              value={form.costoUnitario}
              onChange={handleChange('costoUnitario')}
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {form.tipo.startsWith('AJUSTE') && (
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="motivo">Motivo (opcional)</label>
            <input
              id="motivo"
              className="rounded-md border border-input bg-background p-2"
              value={form.motivo}
              onChange={handleChange('motivo')}
              disabled={isSubmitting}
              placeholder="Conteo físico, merma, etc."
            />
          </div>
        )}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="referencia">Referencia</label>
          <input
            id="referencia"
            className="rounded-md border border-input bg-background p-2"
            value={form.referencia}
            onChange={handleChange('referencia')}
            disabled={isSubmitting}
            placeholder="Orden, compra, nota interna..."
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Registrar movimiento'}
        </button>

        {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </form>
    </div>
  );
};

export default MovimientoQuickForm;
