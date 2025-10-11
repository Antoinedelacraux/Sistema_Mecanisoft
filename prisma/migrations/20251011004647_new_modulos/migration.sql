-- CreateEnum
CREATE TYPE "public"."TipoComprobante" AS ENUM ('BOLETA', 'FACTURA');

-- CreateEnum
CREATE TYPE "public"."EstadoComprobante" AS ENUM ('BORRADOR', 'EMITIDO', 'ANULADO', 'OBSERVADO');

-- CreateEnum
CREATE TYPE "public"."TipoItemComprobante" AS ENUM ('PRODUCTO', 'SERVICIO');

-- CreateEnum
CREATE TYPE "public"."OrigenComprobante" AS ENUM ('COTIZACION', 'ORDEN');

-- CreateEnum
CREATE TYPE "public"."MovimientoTipo" AS ENUM ('INGRESO', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA_ENVIO', 'TRANSFERENCIA_RECEPCION');

-- CreateEnum
CREATE TYPE "public"."MovimientoOrigen" AS ENUM ('COMPRA', 'ORDEN_TRABAJO', 'FACTURACION', 'AJUSTE_MANUAL', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TransferenciaEstado" AS ENUM ('PENDIENTE_RECEPCION', 'COMPLETADA', 'ANULADA');

-- DropIndex
DROP INDEX "public"."reserva_inventario_detalle_idx";

-- DropIndex
DROP INDEX "public"."reserva_inventario_estado_idx";

-- DropIndex
DROP INDEX "public"."reserva_inventario_transaccion_idx";

-- AlterTable
ALTER TABLE "public"."cliente" ADD COLUMN     "motivo_override" TEXT,
ADD COLUMN     "override_tipo_comprobante" "public"."TipoComprobante";

-- AlterTable
ALTER TABLE "public"."empresa_persona" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."reserva_inventario" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."facturacion_config" (
    "id_config" INTEGER NOT NULL DEFAULT 1,
    "afecta_igv" BOOLEAN NOT NULL DEFAULT true,
    "igv_porcentaje" DECIMAL(5,4) NOT NULL DEFAULT 0.18,
    "serie_boleta_default" VARCHAR(10) NOT NULL,
    "serie_factura_default" VARCHAR(10) NOT NULL,
    "precios_incluyen_igv_default" BOOLEAN NOT NULL DEFAULT true,
    "moneda_default" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturacion_config_pkey" PRIMARY KEY ("id_config")
);

-- CreateTable
CREATE TABLE "public"."facturacion_serie" (
    "id_facturacion_serie" SERIAL NOT NULL,
    "tipo" "public"."TipoComprobante" NOT NULL,
    "serie" VARCHAR(10) NOT NULL,
    "correlativo_actual" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturacion_serie_pkey" PRIMARY KEY ("id_facturacion_serie")
);

-- CreateTable
CREATE TABLE "public"."comprobante" (
    "id_comprobante" SERIAL NOT NULL,
    "id_facturacion_serie" INTEGER,
    "tipo" "public"."TipoComprobante" NOT NULL,
    "serie" VARCHAR(10) NOT NULL,
    "numero" INTEGER NOT NULL,
    "origen_tipo" "public"."OrigenComprobante" NOT NULL,
    "origen_id" INTEGER NOT NULL,
    "estado_pago" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "codigo" VARCHAR(30),
    "estado" "public"."EstadoComprobante" NOT NULL DEFAULT 'BORRADOR',
    "incluye_igv" BOOLEAN NOT NULL DEFAULT true,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "receptor_nombre" VARCHAR(200) NOT NULL,
    "receptor_documento" VARCHAR(20) NOT NULL,
    "receptor_direccion" VARCHAR(200),
    "descripcion" TEXT,
    "notas" TEXT,
    "precios_incluyen_igv" BOOLEAN NOT NULL DEFAULT true,
    "fecha_emision" TIMESTAMP(3),
    "pdf_url" TEXT,
    "xml_url" TEXT,
    "override_tipo_comprobante" "public"."TipoComprobante",
    "motivo_override" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "actualizado_por" INTEGER,
    "id_persona" INTEGER NOT NULL,
    "id_empresa_persona" INTEGER,
    "id_cliente" INTEGER NOT NULL,
    "id_cotizacion" INTEGER,
    "id_transaccion" INTEGER,

    CONSTRAINT "comprobante_pkey" PRIMARY KEY ("id_comprobante")
);

-- CreateTable
CREATE TABLE "public"."comprobante_detalle" (
    "id_comprobante_detalle" SERIAL NOT NULL,
    "id_comprobante" INTEGER NOT NULL,
    "tipo_item" "public"."TipoItemComprobante" NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidad_medida" VARCHAR(10),
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "id_producto" INTEGER,
    "id_servicio" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "comprobante_detalle_pkey" PRIMARY KEY ("id_comprobante_detalle")
);

-- CreateTable
CREATE TABLE "public"."comprobante_bitacora" (
    "id_comprobante_bitacora" SERIAL NOT NULL,
    "id_comprobante" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobante_bitacora_pkey" PRIMARY KEY ("id_comprobante_bitacora")
);

-- CreateTable
CREATE TABLE "public"."almacen" (
    "id_almacen" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacen_pkey" PRIMARY KEY ("id_almacen")
);

-- CreateTable
CREATE TABLE "public"."almacen_ubicacion" (
    "id_almacen_ubicacion" SERIAL NOT NULL,
    "id_almacen" INTEGER NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacen_ubicacion_pkey" PRIMARY KEY ("id_almacen_ubicacion")
);

-- CreateTable
CREATE TABLE "public"."inventario_producto" (
    "id_inventario_producto" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_almacen" INTEGER NOT NULL,
    "id_almacen_ubicacion" INTEGER,
    "stock_disponible" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "stock_comprometido" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "stock_maximo" DECIMAL(14,4),
    "costo_promedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_producto_pkey" PRIMARY KEY ("id_inventario_producto")
);

-- CreateTable
CREATE TABLE "public"."movimiento_inventario" (
    "id_movimiento_inventario" SERIAL NOT NULL,
    "tipo" "public"."MovimientoTipo" NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_inventario_producto" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "costo_unitario" DECIMAL(14,4) NOT NULL,
    "referencia_origen" VARCHAR(100),
    "origen_tipo" "public"."MovimientoOrigen",
    "observaciones" TEXT,
    "id_usuario" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id_movimiento_inventario")
);

-- CreateTable
CREATE TABLE "public"."movimiento_transferencia" (
    "id_movimiento_transferencia" SERIAL NOT NULL,
    "id_movimiento_envio" INTEGER NOT NULL,
    "id_movimiento_recepcion" INTEGER NOT NULL,
    "estado" "public"."TransferenciaEstado" NOT NULL DEFAULT 'PENDIENTE_RECEPCION',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimiento_transferencia_pkey" PRIMARY KEY ("id_movimiento_transferencia")
);

-- CreateTable
CREATE TABLE "public"."bitacora_inventario" (
    "id_bitacora_inventario" SERIAL NOT NULL,
    "id_movimiento" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "accion" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "metadata" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_inventario_pkey" PRIMARY KEY ("id_bitacora_inventario")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturacion_serie_tipo_serie_key" ON "public"."facturacion_serie"("tipo", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_id_cotizacion_key" ON "public"."comprobante"("id_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_id_transaccion_key" ON "public"."comprobante"("id_transaccion");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_serie_numero_key" ON "public"."comprobante"("serie", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_origen_tipo_origen_id_key" ON "public"."comprobante"("origen_tipo", "origen_id");

-- CreateIndex
CREATE UNIQUE INDEX "almacen_ubicacion_codigo_key" ON "public"."almacen_ubicacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_producto_id_producto_id_almacen_id_almacen_ubica_key" ON "public"."inventario_producto"("id_producto", "id_almacen", "id_almacen_ubicacion");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_transferencia_id_movimiento_envio_key" ON "public"."movimiento_transferencia"("id_movimiento_envio");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_transferencia_id_movimiento_recepcion_key" ON "public"."movimiento_transferencia"("id_movimiento_recepcion");

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_id_facturacion_serie_fkey" FOREIGN KEY ("id_facturacion_serie") REFERENCES "public"."facturacion_serie"("id_facturacion_serie") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "public"."persona"("id_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_id_empresa_persona_fkey" FOREIGN KEY ("id_empresa_persona") REFERENCES "public"."empresa_persona"("id_empresa_persona") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "public"."cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizacion"("id_cotizacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante" ADD CONSTRAINT "comprobante_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante_detalle" ADD CONSTRAINT "comprobante_detalle_id_comprobante_fkey" FOREIGN KEY ("id_comprobante") REFERENCES "public"."comprobante"("id_comprobante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante_detalle" ADD CONSTRAINT "comprobante_detalle_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante_detalle" ADD CONSTRAINT "comprobante_detalle_id_servicio_fkey" FOREIGN KEY ("id_servicio") REFERENCES "public"."servicio"("id_servicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante_bitacora" ADD CONSTRAINT "comprobante_bitacora_id_comprobante_fkey" FOREIGN KEY ("id_comprobante") REFERENCES "public"."comprobante"("id_comprobante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprobante_bitacora" ADD CONSTRAINT "comprobante_bitacora_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."almacen_ubicacion" ADD CONSTRAINT "almacen_ubicacion_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "public"."almacen"("id_almacen") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario_producto" ADD CONSTRAINT "inventario_producto_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario_producto" ADD CONSTRAINT "inventario_producto_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "public"."almacen"("id_almacen") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventario_producto" ADD CONSTRAINT "inventario_producto_id_almacen_ubicacion_fkey" FOREIGN KEY ("id_almacen_ubicacion") REFERENCES "public"."almacen_ubicacion"("id_almacen_ubicacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_inventario_producto_fkey" FOREIGN KEY ("id_inventario_producto") REFERENCES "public"."inventario_producto"("id_inventario_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento_transferencia" ADD CONSTRAINT "movimiento_transferencia_id_movimiento_envio_fkey" FOREIGN KEY ("id_movimiento_envio") REFERENCES "public"."movimiento_inventario"("id_movimiento_inventario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento_transferencia" ADD CONSTRAINT "movimiento_transferencia_id_movimiento_recepcion_fkey" FOREIGN KEY ("id_movimiento_recepcion") REFERENCES "public"."movimiento_inventario"("id_movimiento_inventario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bitacora_inventario" ADD CONSTRAINT "bitacora_inventario_id_movimiento_fkey" FOREIGN KEY ("id_movimiento") REFERENCES "public"."movimiento_inventario"("id_movimiento_inventario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bitacora_inventario" ADD CONSTRAINT "bitacora_inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reserva_inventario" ADD CONSTRAINT "reserva_inventario_id_inventario_producto_fkey" FOREIGN KEY ("id_inventario_producto") REFERENCES "public"."inventario_producto"("id_inventario_producto") ON DELETE RESTRICT ON UPDATE CASCADE;
