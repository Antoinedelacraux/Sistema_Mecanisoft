'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Factory, Loader2, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type InventarioAlmacenOption = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  direccion: string | null;
};

type AlmacenSelectProps = {
  value: string;
  onChange: (value: string) => void;
  includeInactivos?: boolean;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
  className?: string;
  emptyLabel?: string;
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

export const AlmacenSelect = ({
  value,
  onChange,
  includeInactivos = false,
  disabled = false,
  placeholder = 'Selecciona un almacén',
  name,
  id,
  className,
  emptyLabel = 'No hay almacenes registrados.',
}: AlmacenSelectProps) => {
  const [options, setOptions] = useState<InventarioAlmacenOption[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchPage = useCallback(async (
    controller: AbortController,
    nextPage: number,
    append: boolean,
    search: string | null,
  ) => {
    const response = await fetch(
      `/api/inventario/almacenes?${buildQueryString(includeInactivos, nextPage, search)}`,
      {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'No se pudo cargar los almacenes');
    }

    const data = await response.json() as {
      almacenes: Array<{
        id_almacen: number;
        nombre: string;
        descripcion: string | null;
        direccion: string | null;
        activo: boolean;
      }>;
      pagination: { current: number; pages: number };
    };

    setOptions((prev) => {
      const mapped = data.almacenes.map((item) => ({
        id: item.id_almacen,
        nombre: item.nombre,
        descripcion: item.descripcion,
        direccion: item.direccion,
        activo: item.activo,
      }));
      return append ? [...prev, ...mapped] : mapped;
    });
    setPage(data.pagination.current);
    setHasMore(data.pagination.current < data.pagination.pages);
  }, [includeInactivos]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setHasMore(false);
      try {
        await fetchPage(controller, 1, false, debouncedSearch || null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar almacenes');
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
  }, [debouncedSearch, fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const controller = new AbortController();
    setLoadingMore(true);
    try {
      await fetchPage(controller, page + 1, true, debouncedSearch || null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar almacenes');
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedSearch, fetchPage, hasMore, loadingMore, page]);

  const currentValue = value;
  const showEmpty = !loading && options.length === 0;

  const triggerLabel = useMemo(() => {
    if (loading) return 'Cargando almacenes...';
    if (error) return 'Error al cargar';
    if (!currentValue) return placeholder;
    const selected = options.find((option) => String(option.id) === currentValue);
    return selected ? `${selected.nombre}${selected.activo ? '' : ' (inactivo)'}` : placeholder;
  }, [currentValue, error, loading, options, placeholder]);

  return (
    <div className={className}>
      <Select
        value={currentValue}
        onValueChange={onChange}
        disabled={disabled || loading || !!error}
        name={name}
      >
        <SelectTrigger id={id} className="w-full justify-between">
          <div className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4 text-muted-foreground" />}
            <SelectValue placeholder={triggerLabel}>{triggerLabel}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width,18rem)]">
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar almacén..."
                className="pl-9"
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
          </div>
          {error && (
            <div className="px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {showEmpty && !error && (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
          )}
          {!error && options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              <span className="flex flex-col text-left">
                <span className="font-medium">{option.nombre}</span>
                {(option.descripcion || option.direccion) && (
                  <span className="text-xs text-muted-foreground">
                    {[option.descripcion, option.direccion].filter(Boolean).join(' • ')}
                  </span>
                )}
              </span>
              {!option.activo && (
                <Badge className="ml-auto text-[10px] uppercase" variant="outline">Inactivo</Badge>
              )}
            </SelectItem>
          ))}
          {!error && hasMore && (
            <div className="px-3 pb-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="sm"
                disabled={loadingMore}
                onClick={(event) => {
                  event.stopPropagation();
                  handleLoadMore();
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

export default AlmacenSelect;
