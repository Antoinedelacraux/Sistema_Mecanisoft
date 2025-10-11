/** @jest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AlmacenesManager, {
  type AlmacenesManagerInitialData,
  type AlmacenListItem,
  type UbicacionListItem,
} from '@/components/inventario/almacenes/almacenes-manager';

const mockFetch = global.fetch as jest.Mock;

type BuildOptions = Partial<AlmacenesManagerInitialData>;

type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const createJsonResponse = (data: unknown, status = 200): JsonResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

const buildUbicacion = (overrides: Partial<UbicacionListItem> = {}): UbicacionListItem => ({
  id_almacen_ubicacion: 1,
  codigo: 'A-1',
  descripcion: 'Estante A',
  activo: true,
  creado_en: '2024-01-01T00:00:00.000Z',
  actualizado_en: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const buildAlmacen = (overrides: Partial<AlmacenListItem> = {}): AlmacenListItem => ({
  id_almacen: 1,
  nombre: 'Almacén Central',
  descripcion: 'Principal',
  direccion: 'Av. Siempre Viva 123',
  activo: true,
  creado_en: '2024-01-01T00:00:00.000Z',
  actualizado_en: '2024-01-02T00:00:00.000Z',
  totales: {
    ubicaciones: 1,
    inventarios: 5,
  },
  ...overrides,
});

const buildInitialData = (options: BuildOptions = {}): AlmacenesManagerInitialData => ({
  almacenes: [buildAlmacen()],
  pagination: {
    total: 1,
    pages: 1,
    current: 1,
    limit: 10,
  },
  filters: {
    search: null,
    activo: null,
  },
  ubicacionesIniciales: {
    almacenId: 1,
    data: {
      ubicaciones: [buildUbicacion()],
      pagination: {
        total: 1,
        pages: 1,
        current: 1,
        limit: 10,
      },
      filters: {
        search: null,
        activo: null,
      },
    },
  },
  ...options,
});

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AlmacenesManager UI', () => {
  it('muestra modo solo lectura cuando no se puede gestionar', () => {
    render(<AlmacenesManager initialData={buildInitialData()} canManage={false} />);

    expect(screen.getByText(/modo solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar almacén/i })).toBeDisabled();
  });

  it('permite editar un almacén y refresca los listados', async () => {
    const updatedAlmacen = buildAlmacen({ nombre: 'Almacén Actualizado' });
    const updatedUbicacion = buildUbicacion({ id_almacen_ubicacion: 2, codigo: 'B-1', descripcion: 'Estante B' });

    mockFetch
      .mockResolvedValueOnce(createJsonResponse({ almacen: updatedAlmacen }))
      .mockResolvedValueOnce(createJsonResponse({
        almacenes: [updatedAlmacen],
        pagination: {
          total: 1,
          pages: 1,
          current: 1,
          limit: 10,
        },
        filters: {
          search: null,
          activo: null,
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        ubicaciones: [updatedUbicacion],
        pagination: {
          total: 1,
          pages: 1,
          current: 1,
          limit: 10,
        },
        filters: {
          search: null,
          activo: null,
        },
      }));

    const user = userEvent.setup();
    render(<AlmacenesManager initialData={buildInitialData()} canManage />);

    await user.click(screen.getByRole('button', { name: /editar almacén/i }));

    const editForm = await screen.findByText(/editar almacén/i);
    const formContainer = editForm.closest('form');
    expect(formContainer).toBeTruthy();
  const nombreInput = within(formContainer as HTMLElement).getByLabelText('Nombre', { selector: '#editar-nombre' }) as HTMLInputElement;

    await user.clear(nombreInput);
    await user.type(nombreInput, 'Almacén Actualizado');
    await user.click(within(formContainer as HTMLElement).getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));

    expect(mockFetch.mock.calls[0]?.[0]).toContain('/api/inventario/almacenes/1');
    expect(mockFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' });

    expect(await screen.findByText('Almacén actualizado correctamente.')).toBeInTheDocument();
    expect(await screen.findByText('Estante B')).toBeInTheDocument();
  });

  it('cambia el almacén seleccionado al hacer click y carga sus ubicaciones', async () => {
    const secondAlmacen = buildAlmacen({ id_almacen: 2, nombre: 'Almacén Secundario', totales: { ubicaciones: 0, inventarios: 0 } });

    mockFetch.mockResolvedValueOnce(createJsonResponse({
      ubicaciones: [buildUbicacion({ id_almacen_ubicacion: 3, codigo: 'C-1', descripcion: 'Rack C' })],
      pagination: {
        total: 1,
        pages: 1,
        current: 1,
        limit: 10,
      },
      filters: {
        search: null,
        activo: null,
      },
    }));

    const user = userEvent.setup();

    const initial = buildInitialData();

    render(
      <AlmacenesManager
        initialData={buildInitialData({
          almacenes: [buildAlmacen(), secondAlmacen],
          pagination: {
            total: 2,
            pages: 1,
            current: 1,
            limit: 10,
          },
          ubicacionesIniciales: {
            almacenId: 1,
            data: initial.ubicacionesIniciales!.data,
          },
        })}
        canManage
      />,
    );

    await user.click(screen.getByText('Almacén Secundario'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/api/inventario/almacenes/2/ubicaciones');
    expect(await screen.findByText('Rack C')).toBeInTheDocument();
  });
});
