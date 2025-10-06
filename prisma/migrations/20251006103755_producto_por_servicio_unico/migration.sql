/*
  Warnings:

  - A unique constraint covering the columns `[id_detalle_servicio_asociado]` on the table `detalle_transaccion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."detalle_transaccion" ADD COLUMN     "id_detalle_servicio_asociado" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "detalle_transaccion_id_detalle_servicio_asociado_key" ON "public"."detalle_transaccion"("id_detalle_servicio_asociado");

-- AddForeignKey
ALTER TABLE "public"."detalle_transaccion" ADD CONSTRAINT "detalle_transaccion_id_detalle_servicio_asociado_fkey" FOREIGN KEY ("id_detalle_servicio_asociado") REFERENCES "public"."detalle_transaccion"("id_detalle_transaccion") ON DELETE SET NULL ON UPDATE CASCADE;
