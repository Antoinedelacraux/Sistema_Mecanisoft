import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventario/permissions';
import AlmacenesManager, { type AlmacenesManagerInitialData } from '@/components/inventario/almacenes/almacenes-manager';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 10;

const serializeAlmacen = (almacen: {
  id_almacen: number;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
  _count: { ubicaciones: number; inventarios: number };
}) => ({
  id_almacen: almacen.id_almacen,
  nombre: almacen.nombre,
  descripcion: almacen.descripcion,
  direccion: almacen.direccion,
  activo: almacen.activo,
  creado_en: almacen.creado_en.toISOString(),
  actualizado_en: almacen.actualizado_en.toISOString(),
  totales: {
    ubicaciones: almacen._count.ubicaciones,
    inventarios: almacen._count.inventarios,
  },
});

const serializeUbicacion = (ubicacion: {
  id_almacen_ubicacion: number;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  creado_en: Date;
  actualizado_en: Date;
}) => ({
  id_almacen_ubicacion: ubicacion.id_almacen_ubicacion,
  codigo: ubicacion.codigo,
  descripcion: ubicacion.descripcion,
  activo: ubicacion.activo,
  creado_en: ubicacion.creado_en.toISOString(),
  actualizado_en: ubicacion.actualizado_en.toISOString(),
});

const fetchInitialData = async (): Promise<AlmacenesManagerInitialData> => {
  const [almacenes, total] = await prisma.$transaction([
    prisma.almacen.findMany({
      orderBy: { creado_en: 'desc' },
      take: DEFAULT_LIMIT,
      include: {
        _count: {
          select: {
            ubicaciones: true,
            inventarios: true,
          },
        },
      },
    }),
    prisma.almacen.count(),
  ]);

  const serializados = almacenes.map(serializeAlmacen);

  const primerAlmacen = serializados[0];
  let ubicacionesIniciales: AlmacenesManagerInitialData['ubicacionesIniciales'] = null;

  if (primerAlmacen) {
    const [ubicaciones, totalUbicaciones] = await prisma.$transaction([
      prisma.almacenUbicacion.findMany({
        where: { id_almacen: primerAlmacen.id_almacen },
        orderBy: { creado_en: 'desc' },
        take: DEFAULT_LIMIT,
      }),
      prisma.almacenUbicacion.count({ where: { id_almacen: primerAlmacen.id_almacen } }),
    ]);

    ubicacionesIniciales = {
      almacenId: primerAlmacen.id_almacen,
      data: {
        ubicaciones: ubicaciones.map(serializeUbicacion),
        pagination: {
          total: totalUbicaciones,
          pages: Math.ceil(totalUbicaciones / DEFAULT_LIMIT) || 1,
          current: 1,
          limit: DEFAULT_LIMIT,
        },
        filters: {
          search: null,
          activo: null,
        },
      },
    };
  }

  return {
    almacenes: serializados,
    pagination: {
      total,
      pages: Math.ceil(total / DEFAULT_LIMIT) || 1,
      current: 1,
      limit: DEFAULT_LIMIT,
    },
    filters: {
      search: null,
      activo: null,
    },
    ubicacionesIniciales,
  };
};

const InventarioAlmacenesPage = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const canRead = hasInventoryPermission(session, 'read');
  const canManage = hasInventoryPermission(session, 'write');

  if (!canRead) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Inventario restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No cuentas con permisos para visualizar los almacenes. Solicita acceso al administrador del sistema.
        </p>
      </div>
    );
  }

  const initialData = await fetchInitialData();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Almacenes y ubicaciones</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona almacenes principales y sus ubicaciones internas mientras completamos el resto del módulo.
        </p>
      </header>

      <AlmacenesManager initialData={initialData} canManage={canManage} />
    </div>
  );
};

export default InventarioAlmacenesPage;
