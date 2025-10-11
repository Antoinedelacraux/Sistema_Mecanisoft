'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2, PlusCircle, Search, Factory, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PaginationInfo = {
  total: number;
  pages: number;
  current: number;
  limit: number;
};

type FilterState = {
  search: string | null;
  activo: boolean | null;
};

export type AlmacenListItem = {
  id_almacen: number;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  totales: {
    ubicaciones: number;
    inventarios: number;
  };
};

export type UbicacionListItem = {
  id_almacen_ubicacion: number;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

type AlmacenesResponse = {
  almacenes: AlmacenListItem[];
  pagination: PaginationInfo;
  filters: FilterState;
};

type UbicacionesResponse = {
  ubicaciones: UbicacionListItem[];
  pagination: PaginationInfo;
  filters: FilterState;
};

export type AlmacenesManagerInitialData = {
  almacenes: AlmacenListItem[];
  pagination: PaginationInfo;
  filters: FilterState;
  ubicacionesIniciales: {
    almacenId: number;
    data: UbicacionesResponse;
  } | null;
};

type ActivoFilter = 'all' | 'true' | 'false';

type EstadoMessage = {
  tipo: 'success' | 'error';
  texto: string;
};

type Props = {
  initialData: AlmacenesManagerInitialData;
  canManage: boolean;
};

const estadoActivoLabel = (activo: boolean) => (activo ? 'Activo' : 'Inactivo');

const formatDate = (isoDate: string) => {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch (error) {
    return isoDate;
  }
};

const buildActivoFilter = (value: ActivoFilter): FilterState['activo'] => {
  if (value === 'all') return null;
  return value === 'true';
};

const ensureFilters = (filters: FilterState): FilterState => ({
  search: filters.search ?? null,
  activo: typeof filters.activo === 'boolean' ? filters.activo : null,
});

const emptyUbicacionesResponse = (limit: number): UbicacionesResponse => ({
  ubicaciones: [],
  pagination: {
    total: 0,
    pages: 1,
    current: 1,
    limit,
  },
  filters: {
    search: null,
    activo: null,
  },
});

const statusBadgeClass = (activo: boolean) => (activo ? 'bg-emerald-100 text-emerald-700' : 'bg-destructive/10 text-destructive');

const statusBadgeLabel = (activo: boolean) => (activo ? 'Activo' : 'Inactivo');

const formatRangeLabel = (pagination: PaginationInfo) => {
  const start = pagination.total === 0 ? 0 : (pagination.current - 1) * pagination.limit + 1;
  const end = Math.min(pagination.current * pagination.limit, pagination.total);
  return `${start} - ${end} de ${pagination.total}`;
};

const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'undefined') return;
    if (value === '') return;
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
};

const AlmacenesManager = ({ initialData, canManage }: Props) => {
  const [almacenes, setAlmacenes] = useState<AlmacenListItem[]>(initialData.almacenes);
  const [almacenesPagination, setAlmacenesPagination] = useState<PaginationInfo>(initialData.pagination);
  const [almacenSearch, setAlmacenSearch] = useState(initialData.filters.search ?? '');
  const [almacenActivoFilter, setAlmacenActivoFilter] = useState<ActivoFilter>(
    initialData.filters.activo === null ? 'all' : initialData.filters.activo ? 'true' : 'false',
  );
  const [almacenesLoading, setAlmacenesLoading] = useState(false);
  const [almacenesMessage, setAlmacenesMessage] = useState<EstadoMessage | null>(null);
  const [almacenesError, setAlmacenesError] = useState<string | null>(null);
  const [detalleAlmacenMessage, setDetalleAlmacenMessage] = useState<EstadoMessage | null>(null);

  const ubicacionesLimit = initialData.ubicacionesIniciales?.data.pagination.limit ?? initialData.pagination.limit;
  const [selectedAlmacenId, setSelectedAlmacenId] = useState<number | null>(
    initialData.ubicacionesIniciales?.almacenId ?? initialData.almacenes[0]?.id_almacen ?? null,
  );

  const [ubicacionesState, setUbicacionesState] = useState<UbicacionesResponse>(
    initialData.ubicacionesIniciales?.data ?? emptyUbicacionesResponse(ubicacionesLimit),
  );
  const [ubicacionSearch, setUbicacionSearch] = useState(initialData.ubicacionesIniciales?.data.filters.search ?? '');
  const [ubicacionActivoFilter, setUbicacionActivoFilter] = useState<ActivoFilter>(
    initialData.ubicacionesIniciales?.data.filters.activo === null
      ? 'all'
      : initialData.ubicacionesIniciales?.data.filters.activo
        ? 'true'
        : 'false',
  );
  const [ubicacionesLoading, setUbicacionesLoading] = useState(false);
  const [ubicacionesMessage, setUbicacionesMessage] = useState<EstadoMessage | null>(null);
  const [ubicacionesError, setUbicacionesError] = useState<string | null>(null);

  const [nuevoAlmacen, setNuevoAlmacen] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    activo: true,
  });
  const [creandoAlmacen, setCreandoAlmacen] = useState(false);

  const [nuevaUbicacion, setNuevaUbicacion] = useState({
    codigo: '',
    descripcion: '',
    activo: true,
  });
  const [creandoUbicacion, setCreandoUbicacion] = useState(false);
  const [pending, startTransition] = useTransition();

  const readOnly = !canManage;

  const [isEditingAlmacen, setIsEditingAlmacen] = useState(false);
  const [editAlmacenForm, setEditAlmacenForm] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    activo: true,
  });
  const [actualizandoAlmacen, setActualizandoAlmacen] = useState(false);
  const [updatingAlmacenId, setUpdatingAlmacenId] = useState<number | null>(null);

  const [editingUbicacion, setEditingUbicacion] = useState<UbicacionListItem | null>(null);
  const [actualizandoUbicacion, setActualizandoUbicacion] = useState(false);
  const [actualizandoUbicacionId, setActualizandoUbicacionId] = useState<number | null>(null);
  const [editUbicacionForm, setEditUbicacionForm] = useState({
    codigo: '',
    descripcion: '',
    activo: true,
  });

  const selectedAlmacen = useMemo(
    () => (selectedAlmacenId ? almacenes.find((item) => item.id_almacen === selectedAlmacenId) ?? null : null),
    [selectedAlmacenId, almacenes],
  );

  useEffect(() => {
    if (selectedAlmacen) {
      setEditAlmacenForm({
        nombre: selectedAlmacen.nombre ?? '',
        descripcion: selectedAlmacen.descripcion ?? '',
        direccion: selectedAlmacen.direccion ?? '',
        activo: selectedAlmacen.activo,
      });
    } else {
      setEditAlmacenForm({
        nombre: '',
        descripcion: '',
        direccion: '',
        activo: true,
      });
    }
  }, [selectedAlmacen]);

  useEffect(() => {
    setIsEditingAlmacen(false);
    setDetalleAlmacenMessage(null);
  }, [selectedAlmacenId]);

  useEffect(() => {
    if (editingUbicacion) {
      setEditUbicacionForm({
        codigo: editingUbicacion.codigo,
        descripcion: editingUbicacion.descripcion ?? '',
        activo: editingUbicacion.activo,
      });
    } else {
      setEditUbicacionForm({ codigo: '', descripcion: '', activo: true });
    }
  }, [editingUbicacion]);

  useEffect(() => {
    setEditingUbicacion(null);
  }, [selectedAlmacenId]);

  const showLoadingOverlay = pending || almacenesLoading;

  const loadAlmacenes = useCallback(async (
    { page = 1, search = almacenSearch, activo = almacenActivoFilter }: {
      page?: number;
      search?: string;
      activo?: ActivoFilter;
    } = {},
  ): Promise<AlmacenListItem[]> => {
    setAlmacenesLoading(true);
    setAlmacenesError(null);
    setAlmacenesMessage(null);

    try {
      const query = buildQueryString({
        page,
        limit: almacenesPagination.limit,
        search: search.trim(),
        activo: activo !== 'all' ? activo : undefined,
      });

      const response = await fetch(`/api/inventario/almacenes?${query}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo cargar el listado de almacenes');
      }

      const data = await response.json() as AlmacenesResponse;

      setAlmacenes(data.almacenes);
      setAlmacenesPagination(data.pagination);
      setAlmacenSearch(data.filters.search ?? '');
      setAlmacenActivoFilter(data.filters.activo === null ? 'all' : data.filters.activo ? 'true' : 'false');

      return data.almacenes;
    } catch (error) {
      setAlmacenesError(error instanceof Error ? error.message : 'Error desconocido al cargar almacenes');
      return [];
    } finally {
      setAlmacenesLoading(false);
    }
  }, [almacenSearch, almacenActivoFilter, almacenesPagination.limit]);

  const loadUbicaciones = useCallback(async (
    almacenId: number,
    { page = 1, search = ubicacionSearch, activo = ubicacionActivoFilter }: {
      page?: number;
      search?: string;
      activo?: ActivoFilter;
    } = {},
  ): Promise<UbicacionListItem[]> => {
    setUbicacionesLoading(true);
    setUbicacionesError(null);
    setUbicacionesMessage(null);

    try {
      const query = buildQueryString({
        page,
        limit: ubicacionesLimit,
        search: search.trim(),
        activo: activo !== 'all' ? activo : undefined,
      });

      const response = await fetch(`/api/inventario/almacenes/${almacenId}/ubicaciones?${query}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo cargar las ubicaciones del almacén seleccionado');
      }

      const data = await response.json() as UbicacionesResponse;

      setUbicacionesState(data);
      setUbicacionSearch(data.filters.search ?? '');
      setUbicacionActivoFilter(data.filters.activo === null ? 'all' : data.filters.activo ? 'true' : 'false');

      return data.ubicaciones;
    } catch (error) {
      setUbicacionesError(error instanceof Error ? error.message : 'Error desconocido al cargar ubicaciones');
      const fallback = emptyUbicacionesResponse(ubicacionesLimit);
      setUbicacionesState(fallback);
      return [];
    } finally {
      setUbicacionesLoading(false);
    }
  }, [ubicacionSearch, ubicacionActivoFilter, ubicacionesLimit]);

  const syncSelection = useCallback(async (
    nuevosAlmacenes: AlmacenListItem[],
    preferido?: number | null,
  ) => {
    if (nuevosAlmacenes.length === 0) {
      setSelectedAlmacenId(null);
      setUbicacionesState(emptyUbicacionesResponse(ubicacionesLimit));
      return;
    }

    const targetId = preferido
      ?? (selectedAlmacenId && nuevosAlmacenes.some((item) => item.id_almacen === selectedAlmacenId)
        ? selectedAlmacenId
        : nuevosAlmacenes[0].id_almacen);

    setSelectedAlmacenId(targetId);
    await loadUbicaciones(targetId, { page: 1, search: '', activo: 'all' });
    setUbicacionSearch('');
    setUbicacionActivoFilter('all');
  }, [loadUbicaciones, selectedAlmacenId, ubicacionesLimit]);

  const handleSearchAlmacenes = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lista = await loadAlmacenes({ page: 1, search: almacenSearch });
    await syncSelection(lista);
  };

  const handleClearAlmacenes = async () => {
    setAlmacenSearch('');
    setAlmacenActivoFilter('all');
    const lista = await loadAlmacenes({ page: 1, search: '', activo: 'all' });
    await syncSelection(lista);
  };

  const handleChangeAlmacenesPage = async (page: number) => {
    const lista = await loadAlmacenes({ page });
    await syncSelection(lista, selectedAlmacenId);
  };

  const handleFilterActivo = async (filter: ActivoFilter) => {
    setAlmacenActivoFilter(filter);
    const lista = await loadAlmacenes({ page: 1, activo: filter });
    await syncSelection(lista);
  };

  const handleSelectAlmacen = async (almacenId: number) => {
    if (almacenId === selectedAlmacenId) return;
    setSelectedAlmacenId(almacenId);
    setUbicacionSearch('');
    setUbicacionActivoFilter('all');
    await loadUbicaciones(almacenId, { page: 1, search: '', activo: 'all' });
  };

  const handleCreateAlmacen = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readOnly) {
      setAlmacenesMessage({ tipo: 'error', texto: 'No cuentas con permisos para crear almacenes.' });
      return;
    }

    if (!nuevoAlmacen.nombre.trim()) {
      setAlmacenesMessage({ tipo: 'error', texto: 'El nombre del almacén es obligatorio.' });
      return;
    }

    setCreandoAlmacen(true);
    setAlmacenesMessage(null);

    try {
      const response = await fetch('/api/inventario/almacenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          nombre: nuevoAlmacen.nombre.trim(),
          descripcion: nuevoAlmacen.descripcion.trim() || undefined,
          direccion: nuevoAlmacen.direccion.trim() || undefined,
          activo: nuevoAlmacen.activo,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo crear el almacén');
      }

      const payload = await response.json() as { almacen: AlmacenListItem };

      setNuevoAlmacen({ nombre: '', descripcion: '', direccion: '', activo: true });
      setAlmacenesMessage({ tipo: 'success', texto: 'Almacén registrado correctamente.' });

      const lista = await loadAlmacenes({ page: 1, search: '', activo: 'all' });
      await syncSelection(lista, payload.almacen.id_almacen);
    } catch (error) {
      setAlmacenesMessage({ tipo: 'error', texto: error instanceof Error ? error.message : 'Error desconocido al crear el almacén.' });
    } finally {
      setCreandoAlmacen(false);
    }
  };

  const handleStartEditAlmacen = () => {
    if (!selectedAlmacen) return;
    if (readOnly) {
      setDetalleAlmacenMessage({ tipo: 'error', texto: 'No cuentas con permisos para editar almacenes.' });
      return;
    }
    setDetalleAlmacenMessage(null);
    setIsEditingAlmacen(true);
  };

  const handleCancelEditAlmacen = () => {
    if (selectedAlmacen) {
      setEditAlmacenForm({
        nombre: selectedAlmacen.nombre ?? '',
        descripcion: selectedAlmacen.descripcion ?? '',
        direccion: selectedAlmacen.direccion ?? '',
        activo: selectedAlmacen.activo,
      });
    } else {
      setEditAlmacenForm({ nombre: '', descripcion: '', direccion: '', activo: true });
    }
    setIsEditingAlmacen(false);
    setDetalleAlmacenMessage(null);
  };

  const handleUpdateAlmacen = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedAlmacen) return;
    if (readOnly) {
      setDetalleAlmacenMessage({ tipo: 'error', texto: 'No cuentas con permisos para editar almacenes.' });
      return;
    }

    if (!editAlmacenForm.nombre.trim()) {
      setDetalleAlmacenMessage({ tipo: 'error', texto: 'El nombre del almacén es obligatorio.' });
      return;
    }

    const targetId = selectedAlmacen.id_almacen;
    setActualizandoAlmacen(true);
    setUpdatingAlmacenId(targetId);
    setDetalleAlmacenMessage(null);

    try {
      const response = await fetch(`/api/inventario/almacenes/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          nombre: editAlmacenForm.nombre.trim(),
          descripcion: editAlmacenForm.descripcion.trim() || null,
          direccion: editAlmacenForm.direccion.trim() || null,
          activo: editAlmacenForm.activo,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo actualizar el almacén');
      }

      const lista = await loadAlmacenes({ page: almacenesPagination.current });
      await syncSelection(lista, targetId);
      setDetalleAlmacenMessage({ tipo: 'success', texto: 'Almacén actualizado correctamente.' });
      setIsEditingAlmacen(false);
    } catch (error) {
      setDetalleAlmacenMessage({ tipo: 'error', texto: error instanceof Error ? error.message : 'Error desconocido al actualizar el almacén.' });
    } finally {
      setActualizandoAlmacen(false);
      setUpdatingAlmacenId(null);
    }
  };

  const handleToggleAlmacenActivo = async () => {
    if (!selectedAlmacen) return;
    if (readOnly) {
      setDetalleAlmacenMessage({ tipo: 'error', texto: 'No cuentas con permisos para modificar el estado del almacén.' });
      return;
    }

    const targetId = selectedAlmacen.id_almacen;
    const activar = !selectedAlmacen.activo;
    setActualizandoAlmacen(true);
    setUpdatingAlmacenId(targetId);
    setDetalleAlmacenMessage(null);

    try {
      const response = await fetch(`/api/inventario/almacenes/${targetId}`, activar
        ? {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ activo: true }),
        }
        : {
          method: 'DELETE',
          credentials: 'same-origin',
        });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo actualizar el estado del almacén');
      }

      const lista = await loadAlmacenes({ page: almacenesPagination.current });
      await syncSelection(lista, targetId);
      setDetalleAlmacenMessage({
        tipo: 'success',
        texto: activar ? 'Almacén activado correctamente.' : 'Almacén desactivado correctamente.',
      });
      setIsEditingAlmacen(false);
    } catch (error) {
      setDetalleAlmacenMessage({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'Error desconocido al actualizar el estado del almacén.',
      });
    } finally {
      setActualizandoAlmacen(false);
      setUpdatingAlmacenId(null);
    }
  };

  const handleSearchUbicaciones = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAlmacenId) return;
    await loadUbicaciones(selectedAlmacenId, { page: 1, search: ubicacionSearch, activo: ubicacionActivoFilter });
  };

  const handleClearUbicaciones = async () => {
    if (!selectedAlmacenId) return;
    setUbicacionSearch('');
    setUbicacionActivoFilter('all');
    await loadUbicaciones(selectedAlmacenId, { page: 1, search: '', activo: 'all' });
  };

  const handleChangeUbicacionesPage = async (page: number) => {
    if (!selectedAlmacenId) return;
    await loadUbicaciones(selectedAlmacenId, { page, search: ubicacionSearch, activo: ubicacionActivoFilter });
  };

  const handleFilterUbicaciones = async (filter: ActivoFilter) => {
    if (!selectedAlmacenId) return;
    setUbicacionActivoFilter(filter);
    await loadUbicaciones(selectedAlmacenId, { page: 1, activo: filter, search: ubicacionSearch });
  };

  const handleCreateUbicacion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAlmacenId) return;

    if (readOnly) {
      setUbicacionesMessage({ tipo: 'error', texto: 'No cuentas con permisos para crear ubicaciones.' });
      return;
    }

    if (!nuevaUbicacion.codigo.trim()) {
      setUbicacionesMessage({ tipo: 'error', texto: 'El código de la ubicación es obligatorio.' });
      return;
    }

    setCreandoUbicacion(true);
    setUbicacionesMessage(null);

    try {
      const response = await fetch(`/api/inventario/almacenes/${selectedAlmacenId}/ubicaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          codigo: nuevaUbicacion.codigo.trim(),
          descripcion: nuevaUbicacion.descripcion.trim() || undefined,
          activo: nuevaUbicacion.activo,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo crear la ubicación');
      }

      setNuevaUbicacion({ codigo: '', descripcion: '', activo: true });
      setUbicacionesMessage({ tipo: 'success', texto: 'Ubicación registrada correctamente.' });

      await loadUbicaciones(selectedAlmacenId, { page: 1, search: '', activo: 'all' });
      setUbicacionSearch('');
      setUbicacionActivoFilter('all');
    } catch (error) {
      setUbicacionesMessage({ tipo: 'error', texto: error instanceof Error ? error.message : 'Error desconocido al crear la ubicación.' });
    } finally {
      setCreandoUbicacion(false);
    }
  };

  const handleStartEditUbicacion = (ubicacion: UbicacionListItem) => {
    if (readOnly) {
      setUbicacionesMessage({ tipo: 'error', texto: 'No cuentas con permisos para editar ubicaciones.' });
      return;
    }
    setUbicacionesMessage(null);
    setEditingUbicacion(ubicacion);
  };

  const handleCancelEditUbicacion = () => {
    setEditingUbicacion(null);
  };

  const handleUpdateUbicacion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAlmacenId || !editingUbicacion) return;

    if (readOnly) {
      setUbicacionesMessage({ tipo: 'error', texto: 'No cuentas con permisos para editar ubicaciones.' });
      return;
    }

    if (!editUbicacionForm.codigo.trim()) {
      setUbicacionesMessage({ tipo: 'error', texto: 'El código de la ubicación es obligatorio.' });
      return;
    }

    const targetId = editingUbicacion.id_almacen_ubicacion;
    setActualizandoUbicacion(true);
    setActualizandoUbicacionId(targetId);
    setUbicacionesMessage(null);

    try {
      const response = await fetch(`/api/inventario/almacenes/${selectedAlmacenId}/ubicaciones/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          codigo: editUbicacionForm.codigo.trim(),
          descripcion: editUbicacionForm.descripcion.trim() || null,
          activo: editUbicacionForm.activo,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo actualizar la ubicación');
      }

      await loadUbicaciones(selectedAlmacenId, {
        page: ubicacionesState.pagination.current,
        search: ubicacionSearch,
        activo: ubicacionActivoFilter,
      });
      setUbicacionesMessage({ tipo: 'success', texto: 'Ubicación actualizada correctamente.' });
      setEditingUbicacion(null);
    } catch (error) {
      setUbicacionesMessage({ tipo: 'error', texto: error instanceof Error ? error.message : 'Error desconocido al actualizar la ubicación.' });
    } finally {
      setActualizandoUbicacion(false);
      setActualizandoUbicacionId(null);
    }
  };

  const handleToggleUbicacionActivo = async (ubicacion: UbicacionListItem) => {
    if (!selectedAlmacenId) return;
    if (readOnly) {
      setUbicacionesMessage({ tipo: 'error', texto: 'No cuentas con permisos para modificar el estado de las ubicaciones.' });
      return;
    }

    const targetId = ubicacion.id_almacen_ubicacion;
    const activar = !ubicacion.activo;
    setActualizandoUbicacion(true);
    setActualizandoUbicacionId(targetId);
    setUbicacionesMessage(null);

    try {
      const response = await fetch(`/api/inventario/almacenes/${selectedAlmacenId}/ubicaciones/${targetId}`, activar
        ? {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ activo: true }),
        }
        : {
          method: 'DELETE',
          credentials: 'same-origin',
        });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo actualizar el estado de la ubicación');
      }

      await loadUbicaciones(selectedAlmacenId, {
        page: ubicacionesState.pagination.current,
        search: ubicacionSearch,
        activo: ubicacionActivoFilter,
      });

      setUbicacionesMessage({
        tipo: 'success',
        texto: activar ? 'Ubicación activada correctamente.' : 'Ubicación desactivada correctamente.',
      });
    } catch (error) {
      setUbicacionesMessage({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'Error desconocido al actualizar el estado de la ubicación.',
      });
    } finally {
      setActualizandoUbicacion(false);
      setActualizandoUbicacionId(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[2.1fr_1.2fr]">
      {readOnly && (
        <div className="xl:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Estás en modo solo lectura. Solicita permisos de inventario para crear o modificar almacenes y ubicaciones.
        </div>
      )}
      <section className="relative rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Almacenes registrados</h2>
            <p className="text-sm text-muted-foreground">Listado principal con búsqueda y filtros por estado.</p>
          </div>
          {showLoadingOverlay && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>

        <form onSubmit={handleSearchAlmacenes} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm"
                placeholder="Buscar por nombre, descripción o dirección"
                value={almacenSearch}
                onChange={(event) => setAlmacenSearch(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="hidden rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 md:block"
              disabled={almacenesLoading}
            >
              Buscar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="md:hidden flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              disabled={almacenesLoading}
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={handleClearAlmacenes}
              className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
              disabled={almacenesLoading}
            >
              Limpiar filtros
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleFilterActivo('all')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              almacenActivoFilter === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50',
            )}
            disabled={almacenesLoading}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => handleFilterActivo('true')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              almacenActivoFilter === 'true'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50',
            )}
            disabled={almacenesLoading}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => handleFilterActivo('false')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              almacenActivoFilter === 'false'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/50',
            )}
            disabled={almacenesLoading}
          >
            Inactivos
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Dirección</th>
                <th className="py-2 pr-4 text-right">Ubicaciones</th>
                <th className="py-2 pr-4 text-right">Inventarios</th>
                <th className="py-2 pr-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {almacenes.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                    No hay almacenes registrados. Crea el primero usando el formulario de la parte inferior.
                  </td>
                </tr>
              ) : (
                almacenes.map((almacen) => (
                  <tr
                    key={almacen.id_almacen}
                    onClick={() => startTransition(() => handleSelectAlmacen(almacen.id_almacen))}
                    className={cn(
                      'cursor-pointer transition hover:bg-muted/40',
                      selectedAlmacenId === almacen.id_almacen && 'bg-primary/10',
                    )}
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium">{almacen.nombre}</div>
                      {almacen.descripcion && (
                        <p className="text-xs text-muted-foreground">{almacen.descripcion}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">Actualizado {formatDate(almacen.actualizado_en)}</p>
                    </td>
                    <td className="py-3 pr-4 text-sm text-muted-foreground">
                      {almacen.direccion ? almacen.direccion : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{almacen.totales.ubicaciones}</td>
                    <td className="py-3 pr-4 text-right text-sm">{almacen.totales.inventarios}</td>
                    <td className="py-3 pr-4">
                      <Badge className={statusBadgeClass(almacen.activo)} variant="secondary">
                        {statusBadgeLabel(almacen.activo)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{formatRangeLabel(almacenesPagination)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1 text-xs"
              onClick={() => handleChangeAlmacenesPage(Math.max(1, almacenesPagination.current - 1))}
              disabled={almacenesPagination.current <= 1 || almacenesLoading}
            >
              Anterior
            </button>
            <span className="text-xs text-muted-foreground">Página {almacenesPagination.current} de {almacenesPagination.pages}</span>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1 text-xs"
              onClick={() => handleChangeAlmacenesPage(Math.min(almacenesPagination.pages, almacenesPagination.current + 1))}
              disabled={almacenesPagination.current >= almacenesPagination.pages || almacenesLoading}
            >
              Siguiente
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateAlmacen} className="mt-6 space-y-4 rounded-md border border-dashed border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PlusCircle className="h-4 w-4" /> Nuevo almacén
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs font-medium" htmlFor="nuevo-nombre">Nombre</label>
              <input
                id="nuevo-nombre"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={nuevoAlmacen.nombre}
                onChange={(event) => setNuevoAlmacen((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Almacén Central"
                required
                disabled={creandoAlmacen || readOnly}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium" htmlFor="nuevo-direccion">Dirección</label>
              <input
                id="nuevo-direccion"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={nuevoAlmacen.direccion}
                onChange={(event) => setNuevoAlmacen((prev) => ({ ...prev, direccion: event.target.value }))}
                placeholder="Av. Siempre Viva 123"
                disabled={creandoAlmacen || readOnly}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium" htmlFor="nuevo-descripcion">Descripción</label>
            <textarea
              id="nuevo-descripcion"
              className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={nuevoAlmacen.descripcion}
              onChange={(event) => setNuevoAlmacen((prev) => ({ ...prev, descripcion: event.target.value }))}
              placeholder="Notas adicionales, horarios, referencias..."
              disabled={creandoAlmacen || readOnly}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={nuevoAlmacen.activo}
              onChange={(event) => setNuevoAlmacen((prev) => ({ ...prev, activo: event.target.checked }))}
              disabled={creandoAlmacen || readOnly}
            />
            Marcar como activo
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {almacenesMessage && (
              <span className={cn(
                'text-xs font-medium',
                almacenesMessage.tipo === 'success' ? 'text-emerald-600' : 'text-destructive',
              )}
              >
                {almacenesMessage.texto}
              </span>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creandoAlmacen || readOnly}
            >
              {creandoAlmacen ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Guardar almacén
            </button>
          </div>
        </form>

        {almacenesError && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs font-medium text-destructive">
            {almacenesError}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Ubicaciones por almacén</h2>
            <p className="text-sm text-muted-foreground">Crea ubicaciones internas para organizar tus inventarios.</p>
          </div>
          {ubicacionesLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>

        {!selectedAlmacen ? (
          <div className="mt-8 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Factory className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70" />
            Registra un almacén para comenzar a crear ubicaciones internas.
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-md border border-border bg-background/70 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedAlmacen.nombre}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedAlmacen.direccion ? selectedAlmacen.direccion : 'Sin dirección definida'}
                  </p>
                </div>
                <Badge className={statusBadgeClass(selectedAlmacen.activo)} variant="secondary">
                  {statusBadgeLabel(selectedAlmacen.activo)}
                </Badge>
              </div>
              {selectedAlmacen.descripcion && (
                <p className="mt-3 text-xs text-muted-foreground">{selectedAlmacen.descripcion}</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">{selectedAlmacen.totales.ubicaciones}</p>
                  <p>Ubicaciones registradas</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedAlmacen.totales.inventarios}</p>
                  <p>Inventarios asociados</p>
                </div>
              </div>
              {detalleAlmacenMessage && (
                <p
                  className={cn(
                    'mt-4 text-xs font-medium',
                    detalleAlmacenMessage.tipo === 'success' ? 'text-emerald-600' : 'text-destructive',
                  )}
                >
                  {detalleAlmacenMessage.texto}
                </p>
              )}
              {!isEditingAlmacen && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleStartEditAlmacen}
                    className="inline-flex items-center rounded-md border border-border px-3 py-2 text-xs font-medium transition hover:border-primary/40 hover:text-primary"
                    disabled={readOnly || actualizandoAlmacen}
                  >
                    Editar almacén
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleAlmacenActivo}
                    className="inline-flex items-center rounded-md border border-border px-3 py-2 text-xs font-medium transition hover:border-destructive/40 hover:text-destructive"
                    disabled={readOnly || actualizandoAlmacen}
                  >
                    {actualizandoAlmacen && updatingAlmacenId === selectedAlmacen.id_almacen ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {selectedAlmacen.activo ? 'Desactivar' : 'Activar'} almacén
                  </button>
                </div>
              )}
            </div>

            {isEditingAlmacen && (
              <form onSubmit={handleUpdateAlmacen} className="mt-4 space-y-4 rounded-md border border-border bg-background/80 p-4">
                <h4 className="text-sm font-semibold">Editar almacén</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1">
                    <label className="text-xs font-medium" htmlFor="editar-nombre">Nombre</label>
                    <input
                      id="editar-nombre"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editAlmacenForm.nombre}
                      onChange={(event) => setEditAlmacenForm((prev) => ({ ...prev, nombre: event.target.value }))}
                      required
                      disabled={actualizandoAlmacen}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium" htmlFor="editar-direccion">Dirección</label>
                    <input
                      id="editar-direccion"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editAlmacenForm.direccion}
                      onChange={(event) => setEditAlmacenForm((prev) => ({ ...prev, direccion: event.target.value }))}
                      disabled={actualizandoAlmacen}
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor="editar-descripcion">Descripción</label>
                  <textarea
                    id="editar-descripcion"
                    className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editAlmacenForm.descripcion}
                    onChange={(event) => setEditAlmacenForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                    disabled={actualizandoAlmacen}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={editAlmacenForm.activo}
                    onChange={(event) => setEditAlmacenForm((prev) => ({ ...prev, activo: event.target.checked }))}
                    disabled={actualizandoAlmacen}
                  />
                  Marcar como activo
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={actualizandoAlmacen}
                  >
                    {actualizandoAlmacen && updatingAlmacenId === selectedAlmacen.id_almacen ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditAlmacen}
                    className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:border-border/60"
                    disabled={actualizandoAlmacen}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <form onSubmit={handleSearchUbicaciones} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm"
                    placeholder="Buscar por código o descripción"
                    value={ubicacionSearch}
                    onChange={(event) => setUbicacionSearch(event.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="hidden rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 md:block"
                  disabled={ubicacionesLoading}
                >
                  Buscar
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="md:hidden flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  disabled={ubicacionesLoading}
                >
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={handleClearUbicaciones}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
                  disabled={ubicacionesLoading}
                >
                  Limpiar filtros
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleFilterUbicaciones('all')}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  ubicacionActivoFilter === 'all'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
                disabled={ubicacionesLoading}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => handleFilterUbicaciones('true')}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  ubicacionActivoFilter === 'true'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
                disabled={ubicacionesLoading}
              >
                Activas
              </button>
              <button
                type="button"
                onClick={() => handleFilterUbicaciones('false')}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  ubicacionActivoFilter === 'false'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
                disabled={ubicacionesLoading}
              >
                Inactivas
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2 pr-4">Descripción</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Creada</th>
                    <th className="py-2 pr-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ubicacionesState.ubicaciones.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                        Aún no hay ubicaciones registradas para este almacén.
                      </td>
                    </tr>
                  ) : (
                    ubicacionesState.ubicaciones.map((ubicacion) => (
                      <tr key={ubicacion.id_almacen_ubicacion}>
                        <td className="py-3 pr-4 font-medium">{ubicacion.codigo}</td>
                        <td className="py-3 pr-4 text-sm text-muted-foreground">
                          {ubicacion.descripcion ? ubicacion.descripcion : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={statusBadgeClass(ubicacion.activo)} variant="secondary">
                            {statusBadgeLabel(ubicacion.activo)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">{formatDate(ubicacion.creado_en)}</td>
                        <td className="py-3 pr-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditUbicacion(ubicacion)}
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium transition hover:border-primary/40 hover:text-primary"
                              disabled={readOnly || actualizandoUbicacion}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUbicacionActivo(ubicacion)}
                              className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium transition hover:border-destructive/40 hover:text-destructive"
                              disabled={readOnly || actualizandoUbicacion}
                            >
                              {actualizandoUbicacion && actualizandoUbicacionId === ubicacion.id_almacen_ubicacion ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {ubicacion.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {editingUbicacion && (
              <form onSubmit={handleUpdateUbicacion} className="mt-4 space-y-4 rounded-md border border-border bg-background/80 p-4">
                <h4 className="text-sm font-semibold">Editar ubicación</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1">
                    <label className="text-xs font-medium" htmlFor="editar-ubicacion-codigo">Código</label>
                    <input
                      id="editar-ubicacion-codigo"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editUbicacionForm.codigo}
                      onChange={(event) => setEditUbicacionForm((prev) => ({ ...prev, codigo: event.target.value }))}
                      required
                      disabled={actualizandoUbicacion}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium" htmlFor="editar-ubicacion-descripcion">Descripción</label>
                    <input
                      id="editar-ubicacion-descripcion"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editUbicacionForm.descripcion}
                      onChange={(event) => setEditUbicacionForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                      disabled={actualizandoUbicacion}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={editUbicacionForm.activo}
                    onChange={(event) => setEditUbicacionForm((prev) => ({ ...prev, activo: event.target.checked }))}
                    disabled={actualizandoUbicacion}
                  />
                  Marcar como activa
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={actualizandoUbicacion}
                  >
                    {actualizandoUbicacion && actualizandoUbicacionId === editingUbicacion.id_almacen_ubicacion ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditUbicacion}
                    className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:border-border/60"
                    disabled={actualizandoUbicacion}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">{formatRangeLabel(ubicacionesState.pagination)}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1 text-xs"
                  onClick={() => handleChangeUbicacionesPage(Math.max(1, ubicacionesState.pagination.current - 1))}
                  disabled={ubicacionesState.pagination.current <= 1 || ubicacionesLoading}
                >
                  Anterior
                </button>
                <span className="text-xs text-muted-foreground">Página {ubicacionesState.pagination.current} de {ubicacionesState.pagination.pages}</span>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1 text-xs"
                  onClick={() => handleChangeUbicacionesPage(Math.min(ubicacionesState.pagination.pages, ubicacionesState.pagination.current + 1))}
                  disabled={ubicacionesState.pagination.current >= ubicacionesState.pagination.pages || ubicacionesLoading}
                >
                  Siguiente
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateUbicacion} className="mt-6 space-y-4 rounded-md border border-dashed border-border p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <PlusCircle className="h-4 w-4" /> Nueva ubicación interna
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor="ubicacion-codigo">Código</label>
                  <input
                    id="ubicacion-codigo"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={nuevaUbicacion.codigo}
                    onChange={(event) => setNuevaUbicacion((prev) => ({ ...prev, codigo: event.target.value }))}
                    placeholder="A-101, EST-A, PISO-1"
                    required
                    disabled={creandoUbicacion || readOnly}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor="ubicacion-descripcion">Descripción</label>
                  <input
                    id="ubicacion-descripcion"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={nuevaUbicacion.descripcion}
                    onChange={(event) => setNuevaUbicacion((prev) => ({ ...prev, descripcion: event.target.value }))}
                    placeholder="Pasillo A, Estante 01"
                    disabled={creandoUbicacion || readOnly}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={nuevaUbicacion.activo}
                  onChange={(event) => setNuevaUbicacion((prev) => ({ ...prev, activo: event.target.checked }))}
                  disabled={creandoUbicacion || readOnly}
                />
                Marcar como activa
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {ubicacionesMessage && (
                  <span className={cn(
                    'text-xs font-medium',
                    ubicacionesMessage.tipo === 'success' ? 'text-emerald-600' : 'text-destructive',
                  )}
                  >
                    {ubicacionesMessage.texto}
                  </span>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creandoUbicacion || readOnly}
                >
                  {creandoUbicacion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Guardar ubicación
                </button>
              </div>
            </form>

            {ubicacionesError && (
              <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs font-medium text-destructive">
                {ubicacionesError}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AlmacenesManager;
