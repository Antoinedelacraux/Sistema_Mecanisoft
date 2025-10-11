import type { Prisma, ReservaEstado } from '@prisma/client';

export class InventarioError extends Error {
  constructor(message: string, public readonly statusCode: number = 400, public readonly code: string = 'INVENTARIO_ERROR') {
    super(message);
    this.name = 'InventarioError';
  }
}

export type MovimientoOrigen =
  | 'COMPRA'
  | 'ORDEN_TRABAJO'
  | 'FACTURACION'
  | 'AJUSTE_MANUAL'
  | 'TRANSFERENCIA'
  | 'OTRO';

export type RegistrarMovimientoBase = {
  productoId: number;
  almacenId: number;
  usuarioId: number;
  cantidad: number | string;
  ubicacionId?: number | null;
  referencia?: string;
  observaciones?: string;
  origenTipo?: MovimientoOrigen | null;
};

export type RegistrarIngresoDTO = RegistrarMovimientoBase & {
  costoUnitario: number | string;
};

export type RegistrarSalidaDTO = RegistrarMovimientoBase;

export type RegistrarAjusteDTO = RegistrarMovimientoBase & {
  motivo: string;
  esPositivo: boolean;
  evidenciaUrl?: string | null;
};

type MovimientoInventarioInclude = {
  inventario: {
    include: {
      almacen: {
        select: {
          id_almacen: true;
          nombre: true;
        };
      };
      ubicacion: {
        select: {
          id_almacen_ubicacion: true;
          codigo: true;
          descripcion: true;
        };
      };
    };
  };
  producto: {
    select: {
      id_producto: true;
      codigo_producto: true;
      nombre: true;
      tipo: true;
    };
  };
  usuario: {
    select: {
      id_usuario: true;
      nombre_usuario: true;
      persona: {
        select: {
          nombre: true;
          apellido_paterno: true;
          apellido_materno: true;
        };
      };
    };
  };
};

export type MovimientoInventarioConDetalles = Prisma.MovimientoInventarioGetPayload<{
  include: MovimientoInventarioInclude;
}>;

export type ReservarStockDTO = {
  productoId: number;
  almacenId: number;
  usuarioId: number;
  cantidad: number | string | Prisma.Decimal;
  ubicacionId?: number | null;
  transaccionId?: number | null;
  detalleTransaccionId?: number | null;
  motivo?: string | null;
  metadata?: Prisma.JsonValue;
};

export type CrearTransferenciaDTO = {
  productoId: number;
  origenAlmacenId: number;
  destinoAlmacenId: number;
  usuarioId: number;
  cantidad: number | string | Prisma.Decimal;
  origenUbicacionId?: number | null;
  destinoUbicacionId?: number | null;
  referencia?: string | null;
  observaciones?: string | null;
  metadata?: Prisma.JsonValue;
};

export type ConfirmarTransferenciaDTO = {
  transferenciaId: number;
  usuarioId: number;
  observaciones?: string | null;
  metadata?: Prisma.JsonValue;
};

export type AnularTransferenciaDTO = {
  transferenciaId: number;
  usuarioId: number;
  motivo?: string | null;
  metadata?: Prisma.JsonValue;
};

export type ActualizarReservaDTO = {
  reservaId: number;
  usuarioId: number;
  motivo?: string | null;
  metadata?: Prisma.JsonValue;
};

export type ReservaInventarioDetallada = Prisma.ReservaInventarioGetPayload<{
  include: {
    inventario: {
      include: {
        producto: true;
        almacen: true;
        ubicacion: true;
      };
    };
    transaccion: true;
    detalle_transaccion: true;
  };
}>;

export type CambiarEstadoReservaParams = {
  reservaId: number;
  estadoDestino: ReservaEstado;
  motivo?: string | null;
  metadata?: Prisma.JsonValue;
};

export type TransferenciaConMovimientos = Prisma.MovimientoTransferenciaGetPayload<{
  include: {
    movimiento_envio: {
      include: MovimientoInventarioInclude;
    };
    movimiento_recepcion: {
      include: MovimientoInventarioInclude;
    };
  };
}>;

export type InventarioResumenGlobal = {
  totalProductosMonitoreados: number;
  stockDisponibleTotal: string;
  stockComprometidoTotal: string;
  valorizacionTotal: string;
  itemsCriticos: number;
};

export type InventarioResumenPorAlmacen = {
  id_almacen: number;
  nombre: string;
  stock_disponible: Prisma.Decimal;
  stock_comprometido: Prisma.Decimal;
  valorizacion: Prisma.Decimal;
};

export type InventarioReportePorAlmacenSerializado = {
  id_almacen: number;
  nombre: string;
  stock_disponible: string;
  stock_comprometido: string;
  valorizacion: string;
};

export type InventarioResumenCritico = {
  id_inventario_producto: number;
  id_producto: number;
  codigo_producto: string;
  nombre: string;
  id_almacen: number;
  almacen: string;
  stock_disponible: string;
  stock_minimo: string;
};

export type InventarioResumenResponse = {
  resumen: InventarioResumenGlobal;
  porAlmacen: InventarioReportePorAlmacenSerializado[];
  productosCriticos: InventarioResumenCritico[];
};
