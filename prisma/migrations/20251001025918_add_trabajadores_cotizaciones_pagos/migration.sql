/*
  Warnings:

  - You are about to drop the column `id_usuario` on the `tarea` table. All the data in the column will be lost.
  - You are about to drop the column `notas` on the `tarea` table. All the data in the column will be lost.
  - Added the required column `id_trabajador` to the `tarea` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `tarea` table without a default value. This is not possible if the table is not empty.
  - Made the column `estado_orden` on table `transaccion` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."tarea" DROP CONSTRAINT "tarea_id_usuario_fkey";

-- AlterTable
ALTER TABLE "public"."tarea" DROP COLUMN "id_usuario",
DROP COLUMN "notas",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_trabajador" INTEGER NOT NULL,
ADD COLUMN     "notas_trabajador" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "estado" SET DEFAULT 'pendiente';

-- AlterTable
ALTER TABLE "public"."transaccion" ADD COLUMN     "entregado_por" INTEGER,
ADD COLUMN     "estado_pago" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "fecha_entrega" TIMESTAMP(3),
ADD COLUMN     "fecha_fin_estimada" TIMESTAMP(3),
ADD COLUMN     "fecha_fin_real" TIMESTAMP(3),
ADD COLUMN     "fecha_inicio" TIMESTAMP(3),
ADD COLUMN     "id_trabajador_principal" INTEGER,
ALTER COLUMN "estado_orden" SET NOT NULL,
ALTER COLUMN "estado_orden" SET DEFAULT 'pendiente';

-- CreateTable
CREATE TABLE "public"."cotizacion" (
    "id_cotizacion" SERIAL NOT NULL,
    "codigo_cotizacion" VARCHAR(50) NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_vehiculo" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'borrador',
    "vigencia_hasta" TIMESTAMP(3) NOT NULL,
    "fecha_aprobacion" TIMESTAMP(3),
    "aprobado_por" VARCHAR(50),
    "comentarios_cliente" TEXT,
    "razon_rechazo" TEXT,
    "approval_token" VARCHAR(255),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento_global" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizacion_pkey" PRIMARY KEY ("id_cotizacion")
);

-- CreateTable
CREATE TABLE "public"."detalle_cotizacion" (
    "id_detalle_cotizacion" SERIAL NOT NULL,
    "id_cotizacion" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "detalle_cotizacion_pkey" PRIMARY KEY ("id_detalle_cotizacion")
);

-- CreateTable
CREATE TABLE "public"."trabajador" (
    "id_trabajador" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "codigo_empleado" TEXT NOT NULL,
    "especialidad" VARCHAR(100) NOT NULL,
    "nivel_experiencia" VARCHAR(20) NOT NULL,
    "tarifa_hora" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fecha_contrato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trabajador_pkey" PRIMARY KEY ("id_trabajador")
);

-- CreateTable
CREATE TABLE "public"."transaccion_trabajador" (
    "id_transaccion" INTEGER NOT NULL,
    "id_trabajador" INTEGER NOT NULL,
    "rol" VARCHAR(50),
    "asignado_en" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaccion_trabajador_pkey" PRIMARY KEY ("id_transaccion","id_trabajador")
);

-- CreateTable
CREATE TABLE "public"."pago" (
    "id_pago" SERIAL NOT NULL,
    "id_transaccion" INTEGER NOT NULL,
    "tipo_pago" VARCHAR(30) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "numero_operacion" VARCHAR(50),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" INTEGER NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id_pago")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizacion_codigo_cotizacion_key" ON "public"."cotizacion"("codigo_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "cotizacion_approval_token_key" ON "public"."cotizacion"("approval_token");

-- CreateIndex
CREATE UNIQUE INDEX "trabajador_id_usuario_key" ON "public"."trabajador"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "trabajador_codigo_empleado_key" ON "public"."trabajador"("codigo_empleado");

-- AddForeignKey
ALTER TABLE "public"."cotizacion" ADD CONSTRAINT "cotizacion_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "public"."cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cotizacion" ADD CONSTRAINT "cotizacion_id_vehiculo_fkey" FOREIGN KEY ("id_vehiculo") REFERENCES "public"."vehiculo"("id_vehiculo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cotizacion" ADD CONSTRAINT "cotizacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_cotizacion_fkey" FOREIGN KEY ("id_cotizacion") REFERENCES "public"."cotizacion"("id_cotizacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trabajador" ADD CONSTRAINT "trabajador_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_trabajador" ADD CONSTRAINT "transaccion_trabajador_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion_trabajador" ADD CONSTRAINT "transaccion_trabajador_id_trabajador_fkey" FOREIGN KEY ("id_trabajador") REFERENCES "public"."trabajador"("id_trabajador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion" ADD CONSTRAINT "transaccion_id_trabajador_principal_fkey" FOREIGN KEY ("id_trabajador_principal") REFERENCES "public"."trabajador"("id_trabajador") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transaccion" ADD CONSTRAINT "transaccion_entregado_por_fkey" FOREIGN KEY ("entregado_por") REFERENCES "public"."usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pago" ADD CONSTRAINT "pago_id_transaccion_fkey" FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pago" ADD CONSTRAINT "pago_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tarea" ADD CONSTRAINT "tarea_id_trabajador_fkey" FOREIGN KEY ("id_trabajador") REFERENCES "public"."trabajador"("id_trabajador") ON DELETE RESTRICT ON UPDATE CASCADE;
