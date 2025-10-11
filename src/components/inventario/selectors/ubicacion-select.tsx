'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type InventarioUbicacionOption = {
  id: number;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
};

const EMPTY_VALUE = '__sin_ubicacion__';

type UbicacionSelectProps = {
  almacenId: string | null;
  value: string;
  onChange: (value: string) => void;
  includeInactivos?: boolean;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
  className?: string;
  emptyLabel?: string;
  allowSinUbicacion?: boolean;
};

const buildQueryString = (includeInactivos: boolean, page: number, search: string | null) => {
  const params = new URLSearchParams({ limit: '20', page: String(page) });
  if (!includeInactivos) {
    params.set('activo', 'true');
  }
  if (search) {
    params.set('search', search);
  }
  return params.toString();
};

export const UbicacionSelect = ({
  almacenId,
  value,
  onChange,
  includeInactivos = false,
  disabled = false,
  placeholder = 'Selecciona una ubicación',
  name,
  id,
  className,
  emptyLabel = 'No hay ubicaciones registradas.',
  allowSinUbicacion = false,
}: UbicacionSelectProps) => {
  const [options, setOptions] = useState<InventarioUbicacionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (!almacenId) {
      setOptions([]);
      setError(null);
      setLoading(false);
      setHasMore(false);
      setPage(1);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setHasMore(false);
      try {
        const response = await fetch(`/api/inventario/almacenes/${almacenId}/ubicaciones?${buildQueryString(includeInactivos, 1, debouncedSearch || null)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo cargar las ubicaciones');
        }

        const data = await response.json() as {
          ubicaciones: Array<{
            id_almacen_ubicacion: number;
            codigo: string;
            descripcion: string | null;
            activo: boolean;
          }>;
          pagination: { current: number; pages: number };
        };

        setOptions(
          data.ubicaciones.map((item) => ({
            id: item.id_almacen_ubicacion,
            codigo: item.codigo,
            descripcion: item.descripcion,
            activo: item.activo,
          })),
        );
        setPage(data.pagination.current);
        setHasMore(data.pagination.current < data.pagination.pages);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar ubicaciones');
        setOptions([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [almacenId, debouncedSearch, includeInactivos]);

  useEffect(() => {
    setSearchTerm('');
  }, [almacenId]);

  const loadMore = useCallback(async () => {
    if (!almacenId || loadingMore || !hasMore) return;
    const controller = new AbortController();
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/inventario/almacenes/${almacenId}/ubicaciones?${buildQueryString(includeInactivos, page + 1, debouncedSearch || null)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo cargar más ubicaciones');
      }

      const data = await response.json() as {
        ubicaciones: Array<{
          id_almacen_ubicacion: number;
          codigo: string;
          descripcion: string | null;
          activo: boolean;
        }>;
        pagination: { current: number; pages: number };
      };

      setOptions((prev) => [
        ...prev,
        ...data.ubicaciones.map((item) => ({
          id: item.id_almacen_ubicacion,
          codigo: item.codigo,
          descripcion: item.descripcion,
          activo: item.activo,
        })),
      ]);
      setPage(data.pagination.current);
      setHasMore(data.pagination.current < data.pagination.pages);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar ubicaciones');
    } finally {
      setLoadingMore(false);
    }
  }, [almacenId, debouncedSearch, hasMore, includeInactivos, loadingMore, page]);

  const handleValueChange = (selected: string) => {
    if (allowSinUbicacion && selected === EMPTY_VALUE) {
      onChange('');
      return;
    }
    onChange(selected);
  };

  const currentValue = useMemo(() => {
    if (allowSinUbicacion && !value) {
      return EMPTY_VALUE;
    }
    return value;
  }, [allowSinUbicacion, value]);

  const triggerLabel = useMemo(() => {
    if (!almacenId) return 'Selecciona un almacén primero';
    if (loading) return 'Cargando ubicaciones...';
    if (error) return 'Error al cargar';
    if (!currentValue || currentValue === EMPTY_VALUE) {
      return allowSinUbicacion ? 'Sin ubicación específica' : placeholder;
    }
    const selected = options.find((option) => String(option.id) === currentValue);
    return selected ? `${selected.codigo}${selected.activo ? '' : ' (inactiva)'}` : placeholder;
  }, [almacenId, allowSinUbicacion, currentValue, error, loading, options, placeholder]);

  const isDisabled = disabled || !almacenId || loading || !!error;
  const showEmpty = !loading && almacenId && options.length === 0;

  return (
    <div className={className}>
      <Select
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={isDisabled}
        name={name}
      >
        <SelectTrigger id={id} className="w-full justify-between">
          <div className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4 text-muted-foreground" />}
            <SelectValue placeholder={triggerLabel}>{triggerLabel}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width,18rem)]">
          {!almacenId && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Selecciona primero un almacén.</div>
          )}
          {almacenId && (
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar ubicación..."
                  className="pl-9"
                  onKeyDown={(event) => event.stopPropagation()}
                />
              </div>
            </div>
          )}
          {error && (
            <div className="px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {allowSinUbicacion && !error && almacenId && (
            <SelectItem value={EMPTY_VALUE}>Sin ubicación específica</SelectItem>
          )}
          {showEmpty && !error && (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
          )}
          {!error && options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              <span className="flex flex-col text-left">
                <span className="font-medium">{option.codigo}</span>
                {option.descripcion && (
                  <span className="text-xs text-muted-foreground">{option.descripcion}</span>
                )}
              </span>
              {!option.activo && (
                <Badge className="ml-auto text-[10px] uppercase" variant="outline">Inactiva</Badge>
              )}
            </SelectItem>
          ))}
          {!error && hasMore && almacenId && (
            <div className="px-3 pb-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={loadingMore}
                onClick={(event) => {
                  event.stopPropagation();
                  loadMore();
                }}
              >
                {loadingMore ? 'Cargando...' : 'Cargar más resultados'}
              </Button>
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default UbicacionSelect;
