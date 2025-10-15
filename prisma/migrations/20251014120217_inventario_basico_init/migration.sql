-- CreateEnum
CREATE TYPE "public"."MovimientoBasicoTipo" AS ENUM ('INGRESO', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "public"."CompraEstado" AS ENUM ('PENDIENTE', 'RECIBIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "public"."inventario" (
    "id_inventario" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "stock_disponible" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "stock_comprometido" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "costo_promedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id_inventario")
);

-- CreateTable
CREATE TABLE "public"."compra" (
    "id_compra" SERIAL NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estado" "public"."CompraEstado" NOT NULL DEFAULT 'RECIBIDO',
    "creado_por" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "public"."compra_detalle" (
    "id_compra_detalle" SERIAL NOT NULL,
    "id_compra" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "precio_unitario" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "compra_detalle_pkey" PRIMARY KEY ("id_compra_detalle")
);

-- CreateTable
CREATE TABLE "public"."movimiento" (
    "id_movimiento" SERIAL NOT NULL,
    "tipo" "public"."MovimientoBasicoTipo" NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "costo_unitario" DECIMAL(14,4),
    "referencia" VARCHAR(120),
    "id_usuario" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventario_id_producto_key" ON "public"."inventario"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "compra_detalle_id_compra_id_producto_key" ON "public"."compra_detalle"("id_compra", "id_producto");

-- CreateIndex
CREATE INDEX "movimiento_id_producto_idx" ON "public"."movimiento"("id_producto");

-- AddForeignKey
ALTER TABLE "public"."inventario" ADD CONSTRAINT "inventario_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra" ADD CONSTRAINT "compra_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "public"."proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra" ADD CONSTRAINT "compra_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_detalle" ADD CONSTRAINT "compra_detalle_id_compra_fkey" FOREIGN KEY ("id_compra") REFERENCES "public"."compra"("id_compra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."compra_detalle" ADD CONSTRAINT "compra_detalle_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento" ADD CONSTRAINT "movimiento_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."movimiento" ADD CONSTRAINT "movimiento_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
