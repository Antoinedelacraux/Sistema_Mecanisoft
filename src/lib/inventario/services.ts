import { Prisma, MovimientoTipo, TransferenciaEstado } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { syncProductoStock } from './sync-producto-stock';
import {
  AnularTransferenciaDTO,
  ConfirmarTransferenciaDTO,
  CrearTransferenciaDTO,
  InventarioError,
  MovimientoInventarioConDetalles,
  RegistrarAjusteDTO,
  RegistrarIngresoDTO,
  RegistrarSalidaDTO,
  TransferenciaConMovimientos,
} from '@/types/inventario';
import { invalidateIndicators } from '@/lib/indicadores/cache';

export const DECIMAL_ZERO = new Prisma.Decimal(0);

type TxClient = Prisma.TransactionClient;

type MovimientoMetadata = Prisma.JsonObject | undefined;

export const toDecimal = (value: Prisma.Decimal | number | string): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
};

export const assertPositiveCantidad = (cantidad: Prisma.Decimal, mensaje: string) => {
  if (cantidad.lte(DECIMAL_ZERO)) {
    throw new InventarioError(mensaje, 422, 'CANTIDAD_INVALIDA');
  }
};

const assertCostoNoNegativo = (costo: Prisma.Decimal) => {
  if (costo.lt(DECIMAL_ZERO)) {
    throw new InventarioError('El costo unitario no puede ser negativo', 422, 'COSTO_INVALIDO');
  }
};

const registrarBitacora = async (
  tx: TxClient,
  movimientoId: number,
  usuarioId: number,
  accion: string,
  descripcion: string | null,
  metadata?: MovimientoMetadata,
) => {
  await tx.bitacoraInventario.create({
    data: {
      id_movimiento: movimientoId,
      id_usuario: usuarioId,
      accion,
      descripcion,
      metadata,
    },
  });
};

const triggerStockIndicatorInvalidation = () => {
  void invalidateIndicators({ indicadores: 'mantenimientos.stock-critical' }).catch((err) => {
    console.error('[indicadores] fallo invalidando cache tras movimiento de inventario', err);
  });
};

export const obtenerInventario = async (
  tx: TxClient,
  productoId: number,
  almacenId: number,
  ubicacionId?: number | null,
) => {
  const inventario = await tx.inventarioProducto.findFirst({
    where: {
      id_producto: productoId,
      id_almacen: almacenId,
      id_almacen_ubicacion: ubicacionId ?? null,
    },
  });

  if (inventario) {
    return inventario;
  }

  return tx.inventarioProducto.create({
    data: {
      id_producto: productoId,
      id_almacen: almacenId,
      id_almacen_ubicacion: ubicacionId ?? null,
    },
  });
};

export const validarUbicacion = async (tx: TxClient, almacenId: number, ubicacionId?: number | null) => {
  if (!ubicacionId) return;

  const ubicacion = await tx.almacenUbicacion.findUnique({
    where: { id_almacen_ubicacion: ubicacionId },
    select: { id_almacen: true, activo: true },
  });

  if (!ubicacion || ubicacion.id_almacen !== almacenId) {
    throw new InventarioError('La ubicación indicada no pertenece al almacén seleccionado', 400, 'UBICACION_INVALIDA');
  }

  if (!ubicacion.activo) {
    throw new InventarioError('La ubicación indicada está inactiva', 409, 'UBICACION_INACTIVA');
  }
};

export const validarProducto = async (tx: TxClient, productoId: number) => {
  const producto = await tx.producto.findUnique({
    where: { id_producto: productoId },
    select: { estatus: true },
  });

  if (!producto) {
    throw new InventarioError('El producto indicado no existe', 404, 'PRODUCTO_NO_ENCONTRADO');
  }

  if (!producto.estatus) {
    throw new InventarioError('El producto indicado está inactivo', 409, 'PRODUCTO_INACTIVO');
  }
};

const buildInclude = () => ({
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
});

const buildTransferInclude = () => ({
  movimiento_envio: {
    include: buildInclude(),
  },
  movimiento_recepcion: {
    include: buildInclude(),
  },
});

export const registrarIngreso = async (
  input: RegistrarIngresoDTO,
): Promise<MovimientoInventarioConDetalles> => {
  const cantidadDecimal = toDecimal(input.cantidad);
  const costoUnitarioDecimal = toDecimal(input.costoUnitario);

  assertPositiveCantidad(cantidadDecimal, 'La cantidad del ingreso debe ser mayor a cero');
  assertCostoNoNegativo(costoUnitarioDecimal);

  const movimiento = await prisma.$transaction(async (tx: TxClient) => {
    await validarProducto(tx, input.productoId);
    await validarUbicacion(tx, input.almacenId, input.ubicacionId ?? null);

    const inventario = await obtenerInventario(tx, input.productoId, input.almacenId, input.ubicacionId ?? null);

    const stockAnterior = inventario.stock_disponible;
    const costoAnterior = inventario.costo_promedio ?? DECIMAL_ZERO;

    const nuevoStock = stockAnterior.add(cantidadDecimal);
    const nuevoCostoPromedio = nuevoStock.equals(DECIMAL_ZERO)
      ? DECIMAL_ZERO
      : stockAnterior.mul(costoAnterior).add(cantidadDecimal.mul(costoUnitarioDecimal)).div(nuevoStock);

    const inventarioActualizado = await tx.inventarioProducto.update({
      where: { id_inventario_producto: inventario.id_inventario_producto },
      data: {
        stock_disponible: nuevoStock,
        costo_promedio: nuevoCostoPromedio,
      },
    });

    await syncProductoStock(tx, input.productoId);

    const movimiento = await tx.movimientoInventario.create({
      data: {
  tipo: MovimientoTipo.INGRESO,
        id_producto: input.productoId,
        id_inventario_producto: inventarioActualizado.id_inventario_producto,
        cantidad: cantidadDecimal,
        costo_unitario: costoUnitarioDecimal,
        referencia_origen: input.referencia,
        origen_tipo: input.origenTipo ?? null,
        observaciones: input.observaciones,
        id_usuario: input.usuarioId,
      },
      include: buildInclude(),
    });

    await registrarBitacora(tx, movimiento.id_movimiento_inventario, input.usuarioId, 'INGRESO', 'Ingreso manual de inventario', {
      referencia: input.referencia ?? null,
      origenTipo: input.origenTipo ?? null,
      cantidad: cantidadDecimal.toString(),
      costoUnitario: costoUnitarioDecimal.toString(),
    });

    return movimiento;
  });

  triggerStockIndicatorInvalidation();

  return movimiento;
};

export const registrarSalida = async (
  input: RegistrarSalidaDTO,
): Promise<MovimientoInventarioConDetalles> => {
  const cantidadDecimal = toDecimal(input.cantidad);
  assertPositiveCantidad(cantidadDecimal, 'La cantidad de la salida debe ser mayor a cero');

  const movimiento = await prisma.$transaction(async (tx: TxClient) => {
    await validarProducto(tx, input.productoId);
    await validarUbicacion(tx, input.almacenId, input.ubicacionId ?? null);

    const inventario = await obtenerInventario(tx, input.productoId, input.almacenId, input.ubicacionId ?? null);

    if (inventario.stock_disponible.lt(cantidadDecimal)) {
      throw new InventarioError('Stock insuficiente para registrar la salida solicitada', 409, 'STOCK_INSUFICIENTE');
    }

    const nuevoStock = inventario.stock_disponible.sub(cantidadDecimal);

    const inventarioActualizado = await tx.inventarioProducto.update({
      where: { id_inventario_producto: inventario.id_inventario_producto },
      data: {
        stock_disponible: nuevoStock,
      },
    });

    await syncProductoStock(tx, input.productoId);

    const movimiento = await tx.movimientoInventario.create({
      data: {
  tipo: MovimientoTipo.SALIDA,
        id_producto: input.productoId,
        id_inventario_producto: inventarioActualizado.id_inventario_producto,
        cantidad: cantidadDecimal,
        costo_unitario: inventario.costo_promedio ?? DECIMAL_ZERO,
        referencia_origen: input.referencia,
        origen_tipo: input.origenTipo ?? null,
        observaciones: input.observaciones,
        id_usuario: input.usuarioId,
      },
      include: buildInclude(),
    });

    await registrarBitacora(tx, movimiento.id_movimiento_inventario, input.usuarioId, 'SALIDA', 'Salida manual de inventario', {
      referencia: input.referencia ?? null,
      origenTipo: input.origenTipo ?? null,
      cantidad: cantidadDecimal.toString(),
    });

    return movimiento;
  });

  triggerStockIndicatorInvalidation();

  return movimiento;
};

export const registrarAjuste = async (
  input: RegistrarAjusteDTO,
): Promise<MovimientoInventarioConDetalles> => {
  const cantidadDecimal = toDecimal(input.cantidad);
  assertPositiveCantidad(cantidadDecimal, 'La cantidad del ajuste debe ser mayor a cero');

  const movimiento = await prisma.$transaction(async (tx: TxClient) => {
    await validarProducto(tx, input.productoId);
    await validarUbicacion(tx, input.almacenId, input.ubicacionId ?? null);

    const inventario = await obtenerInventario(tx, input.productoId, input.almacenId, input.ubicacionId ?? null);

    const esPositivo = input.esPositivo;
    const descripcion = esPositivo ? 'Ajuste positivo de inventario' : 'Ajuste negativo de inventario';
    const accion = esPositivo ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';

    let nuevoStock = inventario.stock_disponible;

    if (esPositivo) {
      nuevoStock = nuevoStock.add(cantidadDecimal);
    } else {
      if (inventario.stock_disponible.lt(cantidadDecimal)) {
        throw new InventarioError('Stock insuficiente para aplicar el ajuste negativo solicitado', 409, 'STOCK_INSUFICIENTE');
      }
      nuevoStock = nuevoStock.sub(cantidadDecimal);
    }

    const inventarioActualizado = await tx.inventarioProducto.update({
      where: { id_inventario_producto: inventario.id_inventario_producto },
      data: {
        stock_disponible: nuevoStock,
      },
    });

    await syncProductoStock(tx, input.productoId);

    const movimiento = await tx.movimientoInventario.create({
      data: {
  tipo: esPositivo ? MovimientoTipo.AJUSTE_POSITIVO : MovimientoTipo.AJUSTE_NEGATIVO,
        id_producto: input.productoId,
        id_inventario_producto: inventarioActualizado.id_inventario_producto,
        cantidad: cantidadDecimal,
        costo_unitario: inventario.costo_promedio ?? DECIMAL_ZERO,
        referencia_origen: input.referencia,
        origen_tipo: input.origenTipo ?? null,
        observaciones: [input.observaciones, input.motivo, input.evidenciaUrl ? `Evidencia: ${input.evidenciaUrl}` : null].filter(Boolean).join(' - ') || null,
        id_usuario: input.usuarioId,
      },
      include: buildInclude(),
    });

    await registrarBitacora(tx, movimiento.id_movimiento_inventario, input.usuarioId, accion, descripcion, {
      referencia: input.referencia ?? null,
      origenTipo: input.origenTipo ?? null,
      cantidad: cantidadDecimal.toString(),
      motivo: input.motivo,
      evidenciaUrl: input.evidenciaUrl ?? null,
    });

    return movimiento;
  });

  triggerStockIndicatorInvalidation();

  return movimiento;
};

const assertTransferenciaDestinoDistinto = (input: CrearTransferenciaDTO) => {
  const mismaCombinacion = input.origenAlmacenId === input.destinoAlmacenId
    && (input.origenUbicacionId ?? null) === (input.destinoUbicacionId ?? null);

  if (mismaCombinacion) {
    throw new InventarioError('La transferencia debe dirigirse a un destino distinto al origen', 422, 'TRANSFERENCIA_DESTINO_INVALIDO');
  }
};

const cargarTransferencia = async (tx: TxClient, transferenciaId: number) => tx.movimientoTransferencia.findUnique({
  where: { id_movimiento_transferencia: transferenciaId },
  include: buildTransferInclude(),
});

export const crearTransferencia = async (
  input: CrearTransferenciaDTO,
): Promise<TransferenciaConMovimientos> => {
  const cantidadDecimal = toDecimal(input.cantidad);
  assertPositiveCantidad(cantidadDecimal, 'La cantidad de la transferencia debe ser mayor a cero');
  assertTransferenciaDestinoDistinto(input);

  const transferencia = await prisma.$transaction(async (tx: TxClient) => {
    await validarProducto(tx, input.productoId);
    await validarUbicacion(tx, input.origenAlmacenId, input.origenUbicacionId ?? null);
    await validarUbicacion(tx, input.destinoAlmacenId, input.destinoUbicacionId ?? null);

    const inventarioOrigen = await obtenerInventario(tx, input.productoId, input.origenAlmacenId, input.origenUbicacionId ?? null);

    if (inventarioOrigen.stock_disponible.lt(cantidadDecimal)) {
      throw new InventarioError('Stock insuficiente en el almacén de origen para completar la transferencia', 409, 'STOCK_ORIGEN_INSUFICIENTE');
    }

    const inventarioDestino = await obtenerInventario(tx, input.productoId, input.destinoAlmacenId, input.destinoUbicacionId ?? null);

    const inventarioOrigenActualizado = await tx.inventarioProducto.update({
      where: { id_inventario_producto: inventarioOrigen.id_inventario_producto },
      data: {
        stock_disponible: inventarioOrigen.stock_disponible.sub(cantidadDecimal),
      },
    });

    await syncProductoStock(tx, input.productoId);

    const movimientoEnvio = await tx.movimientoInventario.create({
      data: {
        tipo: MovimientoTipo.TRANSFERENCIA_ENVIO,
        id_producto: input.productoId,
        id_inventario_producto: inventarioOrigenActualizado.id_inventario_producto,
        cantidad: cantidadDecimal,
        costo_unitario: inventarioOrigen.costo_promedio ?? DECIMAL_ZERO,
        referencia_origen: input.referencia ?? null,
        origen_tipo: 'TRANSFERENCIA',
        observaciones: input.observaciones ?? null,
        id_usuario: input.usuarioId,
      },
      include: buildInclude(),
    });

    const movimientoRecepcion = await tx.movimientoInventario.create({
      data: {
        tipo: MovimientoTipo.TRANSFERENCIA_RECEPCION,
        id_producto: input.productoId,
        id_inventario_producto: inventarioDestino.id_inventario_producto,
        cantidad: cantidadDecimal,
        costo_unitario: inventarioOrigen.costo_promedio ?? DECIMAL_ZERO,
        referencia_origen: input.referencia ?? null,
        origen_tipo: 'TRANSFERENCIA',
        observaciones: 'Pendiente de recepción',
        id_usuario: input.usuarioId,
      },
      include: buildInclude(),
    });

    const transferencia = await tx.movimientoTransferencia.create({
      data: {
        id_movimiento_envio: movimientoEnvio.id_movimiento_inventario,
        id_movimiento_recepcion: movimientoRecepcion.id_movimiento_inventario,
        estado: TransferenciaEstado.PENDIENTE_RECEPCION,
      },
      include: buildTransferInclude(),
    });

    await registrarBitacora(tx, movimientoEnvio.id_movimiento_inventario, input.usuarioId, 'TRANSFERENCIA_ENVIO', 'Transferencia registrada desde almacén origen', {
      cantidad: cantidadDecimal.toString(),
      destino: {
        almacenId: input.destinoAlmacenId,
        ubicacionId: input.destinoUbicacionId ?? null,
      },
      referencia: input.referencia ?? null,
      metadata: input.metadata ?? null,
    });

    await registrarBitacora(tx, movimientoRecepcion.id_movimiento_inventario, input.usuarioId, 'TRANSFERENCIA_PENDIENTE', 'Transferencia pendiente de recepción en almacén destino', {
      cantidad: cantidadDecimal.toString(),
      origen: {
        almacenId: input.origenAlmacenId,
        ubicacionId: input.origenUbicacionId ?? null,
      },
      referencia: input.referencia ?? null,
      metadata: input.metadata ?? null,
    });

    return transferencia;
  });

  triggerStockIndicatorInvalidation();

  return transferencia;
};

export const confirmarTransferencia = async (
  input: ConfirmarTransferenciaDTO,
): Promise<TransferenciaConMovimientos> => {
  const transferencia = await prisma.$transaction(async (tx: TxClient) => {
    const transferencia = await cargarTransferencia(tx, input.transferenciaId);

    if (!transferencia) {
      throw new InventarioError('La transferencia solicitada no existe', 404, 'TRANSFERENCIA_NO_ENCONTRADA');
    }

    if (transferencia.estado === TransferenciaEstado.ANULADA) {
      throw new InventarioError('No es posible confirmar una transferencia anulada', 409, 'TRANSFERENCIA_ANULADA');
    }

    if (transferencia.estado === TransferenciaEstado.COMPLETADA) {
      return transferencia;
    }

    const cantidadDecimal = new Prisma.Decimal(transferencia.movimiento_envio.cantidad);

    const inventarioDestino = transferencia.movimiento_recepcion.inventario;

    await tx.inventarioProducto.update({
      where: { id_inventario_producto: inventarioDestino.id_inventario_producto },
      data: {
        stock_disponible: inventarioDestino.stock_disponible.add(cantidadDecimal),
      },
    });

    await syncProductoStock(tx, transferencia.movimiento_envio.id_producto);

    await tx.movimientoInventario.update({
      where: { id_movimiento_inventario: transferencia.movimiento_recepcion.id_movimiento_inventario },
      data: {
        observaciones: input.observaciones ?? 'Recepción confirmada',
        id_usuario: input.usuarioId,
      },
    });

    const transferenciaActualizada = await tx.movimientoTransferencia.update({
      where: { id_movimiento_transferencia: transferencia.id_movimiento_transferencia },
      data: {
        estado: TransferenciaEstado.COMPLETADA,
      },
      include: buildTransferInclude(),
    });

    await registrarBitacora(tx, transferencia.movimiento_envio.id_movimiento_inventario, input.usuarioId, 'TRANSFERENCIA_COMPLETADA', 'Transferencia confirmada por almacén destino', {
      cantidad: cantidadDecimal.toString(),
      transferenciaId: transferencia.id_movimiento_transferencia,
      metadata: input.metadata ?? null,
    });

    await registrarBitacora(tx, transferencia.movimiento_recepcion.id_movimiento_inventario, input.usuarioId, 'TRANSFERENCIA_RECEPCION', 'Recepción de transferencia completada', {
      cantidad: cantidadDecimal.toString(),
      transferenciaId: transferencia.id_movimiento_transferencia,
      metadata: input.metadata ?? null,
    });
    return transferenciaActualizada;
  });

  triggerStockIndicatorInvalidation();

  return transferencia;
};

export const anularTransferencia = async (
  input: AnularTransferenciaDTO,
): Promise<TransferenciaConMovimientos> => {
  const transferencia = await prisma.$transaction(async (tx: TxClient) => {
    const transferencia = await cargarTransferencia(tx, input.transferenciaId);

    if (!transferencia) {
      throw new InventarioError('La transferencia solicitada no existe', 404, 'TRANSFERENCIA_NO_ENCONTRADA');
    }

    if (transferencia.estado === TransferenciaEstado.COMPLETADA) {
      throw new InventarioError('No es posible anular una transferencia ya completada', 409, 'TRANSFERENCIA_COMPLETADA');
    }

    if (transferencia.estado === TransferenciaEstado.ANULADA) {
      return transferencia;
    }

    const cantidadDecimal = new Prisma.Decimal(transferencia.movimiento_envio.cantidad);
    const inventarioOrigen = transferencia.movimiento_envio.inventario;

    await tx.inventarioProducto.update({
      where: { id_inventario_producto: inventarioOrigen.id_inventario_producto },
      data: {
        stock_disponible: inventarioOrigen.stock_disponible.add(cantidadDecimal),
      },
    });

    await syncProductoStock(tx, transferencia.movimiento_envio.id_producto);

    await tx.movimientoInventario.update({
      where: { id_movimiento_inventario: transferencia.movimiento_envio.id_movimiento_inventario },
      data: {
        observaciones: [transferencia.movimiento_envio.observaciones, 'Transferencia anulada', input.motivo].filter(Boolean).join(' - ') || null,
      },
    });

    await tx.movimientoInventario.update({
      where: { id_movimiento_inventario: transferencia.movimiento_recepcion.id_movimiento_inventario },
      data: {
        observaciones: [transferencia.movimiento_recepcion.observaciones, 'Transferencia anulada', input.motivo].filter(Boolean).join(' - ') || null,
        id_usuario: input.usuarioId,
      },
    });

    const transferenciaActualizada = await tx.movimientoTransferencia.update({
      where: { id_movimiento_transferencia: transferencia.id_movimiento_transferencia },
      data: {
        estado: TransferenciaEstado.ANULADA,
      },
      include: buildTransferInclude(),
    });

    await registrarBitacora(tx, transferencia.movimiento_envio.id_movimiento_inventario, input.usuarioId, 'TRANSFERENCIA_ANULADA', 'Transferencia anulada y stock restaurado en origen', {
      cantidad: cantidadDecimal.toString(),
      motivo: input.motivo ?? null,
      metadata: input.metadata ?? null,
    });

    await registrarBitacora(tx, transferencia.movimiento_recepcion.id_movimiento_inventario, input.usuarioId, 'TRANSFERENCIA_ANULADA_DESTINO', 'Transferencia anulada antes de recepción', {
      cantidad: cantidadDecimal.toString(),
      motivo: input.motivo ?? null,
      metadata: input.metadata ?? null,
    });
    return transferenciaActualizada;
  });

  triggerStockIndicatorInvalidation();

  return transferencia;
};
