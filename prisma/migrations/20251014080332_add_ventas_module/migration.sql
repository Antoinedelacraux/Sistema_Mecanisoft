-- CreateEnum
CREATE TYPE "public"."EstadoPagoVenta" AS ENUM ('pendiente', 'parcial', 'pagado');

-- CreateEnum
CREATE TYPE "public"."MetodoPagoVenta" AS ENUM ('EFECTIVO', 'TARJETA', 'APP_MOVIL', 'TRANSFERENCIA', 'OTRO');

-- CreateTable
CREATE TABLE "public"."venta" (
    "id_venta" SERIAL NOT NULL,
    "id_comprobante" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2) NOT NULL,
    "total_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metodo_principal" "public"."MetodoPagoVenta",
    "estado_pago" "public"."EstadoPagoVenta" NOT NULL DEFAULT 'pendiente',
    "metadata" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id_venta")
);

-- CreateTable
CREATE TABLE "public"."venta_pago" (
    "id_venta_pago" SERIAL NOT NULL,
    "id_venta" INTEGER NOT NULL,
    "metodo" "public"."MetodoPagoVenta" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia" VARCHAR(120),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "registrado_por" INTEGER NOT NULL,

    CONSTRAINT "venta_pago_pkey" PRIMARY KEY ("id_venta_pago")
);

-- CreateIndex
CREATE UNIQUE INDEX "venta_id_comprobante_key" ON "public"."venta"("id_comprobante");

-- CreateIndex
CREATE INDEX "venta_fecha_idx" ON "public"."venta"("fecha");

-- CreateIndex
CREATE INDEX "venta_metodo_principal_idx" ON "public"."venta"("metodo_principal");

-- CreateIndex
CREATE INDEX "venta_estado_pago_idx" ON "public"."venta"("estado_pago");

-- CreateIndex
CREATE INDEX "venta_pago_id_venta_fecha_pago_idx" ON "public"."venta_pago"("id_venta", "fecha_pago");

-- AddForeignKey
ALTER TABLE "public"."venta" ADD CONSTRAINT "venta_id_comprobante_fkey" FOREIGN KEY ("id_comprobante") REFERENCES "public"."comprobante"("id_comprobante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venta_pago" ADD CONSTRAINT "venta_pago_id_venta_fkey" FOREIGN KEY ("id_venta") REFERENCES "public"."venta"("id_venta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venta_pago" ADD CONSTRAINT "venta_pago_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
