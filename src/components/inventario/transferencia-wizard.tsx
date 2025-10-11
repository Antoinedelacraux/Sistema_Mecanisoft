'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import { AlmacenSelect, UbicacionSelect } from '@/components/inventario/selectors';

const STEPS = [
  { id: 1, title: 'Origen y producto' },
  { id: 2, title: 'Destino y confirmación' },
] as const;

type Step = (typeof STEPS)[number]['id'];

type TransferenciaFormState = {
  productoId: string;
  cantidad: string;
  origenAlmacenId: string;
  origenUbicacionId: string;
  destinoAlmacenId: string;
  destinoUbicacionId: string;
  referencia: string;
  observaciones: string;
};

const INITIAL_STATE: TransferenciaFormState = {
  productoId: '',
  cantidad: '',
  origenAlmacenId: '',
  origenUbicacionId: '',
  destinoAlmacenId: '',
  destinoUbicacionId: '',
  referencia: '',
  observaciones: '',
};

const parseOptionalNumber = (value: string) => (value.trim().length ? Number.parseInt(value, 10) : null);

const TransferenciaWizard = ({ onSuccess }: { onSuccess?: () => void }) => {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<TransferenciaFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAdvance = useMemo(() => {
    if (step === 1) {
      return Boolean(form.productoId && form.cantidad && form.origenAlmacenId);
    }

    if (step === 2) {
      return Boolean(form.destinoAlmacenId && form.productoId && form.cantidad);
    }

    return false;
  }, [form, step]);

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleChange = (field: keyof TransferenciaFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSelectAlmacen = <K extends 'origenAlmacenId' | 'destinoAlmacenId', R extends 'origenUbicacionId' | 'destinoUbicacionId'>(
    field: K,
    resetField: R,
  ) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value, [resetField]: '' }));
  };

  const handleSelectUbicacion = (field: 'origenUbicacionId' | 'destinoUbicacionId') => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    resetFeedback();
    if (!canAdvance) {
      setError('Completa los campos requeridos del paso actual');
      return;
    }

    if (step === 1) {
      if (form.origenAlmacenId && form.destinoAlmacenId && form.origenAlmacenId === form.destinoAlmacenId) {
        setError('Selecciona almacenes distintos para origen y destino');
        return;
      }
      setStep(2);
    }
  };

  const handlePrev = () => {
    resetFeedback();
    if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!canAdvance) {
      setError('Completa la información requerida antes de continuar');
      return;
    }

    if (form.origenAlmacenId === form.destinoAlmacenId && (!form.origenUbicacionId || form.origenUbicacionId === form.destinoUbicacionId)) {
      setError('El destino debe ser diferente al origen. Ajusta el almacén o la ubicación.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/inventario/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: Number.parseInt(form.productoId, 10),
          cantidad: form.cantidad.trim(),
          origenAlmacenId: Number.parseInt(form.origenAlmacenId, 10),
          origenUbicacionId: parseOptionalNumber(form.origenUbicacionId),
          destinoAlmacenId: Number.parseInt(form.destinoAlmacenId, 10),
          destinoUbicacionId: parseOptionalNumber(form.destinoUbicacionId),
          referencia: form.referencia.trim() || undefined,
          observaciones: form.observaciones.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo crear la transferencia');
      }

      setMessage('Transferencia registrada correctamente. Puedes confirmarla desde la tabla inferior.');
      setForm(INITIAL_STATE);
      setStep(1);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al registrar la transferencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Transferencia guiada</h2>
      <p className="text-sm text-muted-foreground">Registra envíos entre almacenes y confirma la recepción en el destino.</p>

      <div className="mt-4 flex items-center gap-3 text-sm font-medium">
        {STEPS.map((item) => (
          <div key={item.id} className={`flex items-center gap-2 ${step === item.id ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${step === item.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
              {item.id}
            </span>
            {item.title}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="productoId">ID de producto</label>
              <input
                id="productoId"
                type="number"
                className="rounded-md border border-input bg-background p-2"
                value={form.productoId}
                onChange={handleChange('productoId')}
                required
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
                required
                min="0.01"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="origenAlmacenId">Almacén origen</label>
              <AlmacenSelect
                id="origenAlmacenId"
                value={form.origenAlmacenId}
                onChange={handleSelectAlmacen('origenAlmacenId', 'origenUbicacionId')}
                disabled={isSubmitting}
                placeholder="Selecciona un almacén"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="origenUbicacionId">Ubicación origen (opcional)</label>
              <UbicacionSelect
                id="origenUbicacionId"
                almacenId={form.origenAlmacenId ? form.origenAlmacenId : null}
                value={form.origenUbicacionId}
                onChange={handleSelectUbicacion('origenUbicacionId')}
                disabled={isSubmitting}
                allowSinUbicacion
                placeholder="Sin ubicación específica"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="destinoAlmacenId">Almacén destino</label>
              <AlmacenSelect
                id="destinoAlmacenId"
                value={form.destinoAlmacenId}
                onChange={handleSelectAlmacen('destinoAlmacenId', 'destinoUbicacionId')}
                disabled={isSubmitting}
                placeholder="Selecciona un almacén"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="destinoUbicacionId">Ubicación destino (opcional)</label>
              <UbicacionSelect
                id="destinoUbicacionId"
                almacenId={form.destinoAlmacenId ? form.destinoAlmacenId : null}
                value={form.destinoUbicacionId}
                onChange={handleSelectUbicacion('destinoUbicacionId')}
                disabled={isSubmitting}
                allowSinUbicacion
                placeholder="Sin ubicación específica"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="referencia">Referencia (opcional)</label>
              <input
                id="referencia"
                className="rounded-md border border-input bg-background p-2"
                value={form.referencia}
                onChange={handleChange('referencia')}
                placeholder="Código interno, orden, etc."
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="observaciones">Observaciones (opcional)</label>
              <input
                id="observaciones"
                className="rounded-md border border-input bg-background p-2"
                value={form.observaciones}
                onChange={handleChange('observaciones')}
                placeholder="Notas para el destino"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={handlePrev}
              disabled={isSubmitting}
            >
              Regresar
            </button>
          )}

          {step < STEPS.length && (
            <button
              type="button"
              className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleNext}
              disabled={!canAdvance || isSubmitting}
            >
              Siguiente
            </button>
          )}

          {step === STEPS.length && (
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registrando...' : 'Registrar transferencia'}
            </button>
          )}
        </div>

        {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </form>
    </div>
  );
};

export default TransferenciaWizard;
