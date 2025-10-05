/*
  Warnings:

  - You are about to drop the column `tiempo_minutos` on the `servicio` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."servicio" DROP COLUMN "tiempo_minutos",
ADD COLUMN     "tiempo_maximo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tiempo_minimo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unidad_tiempo" VARCHAR(10) NOT NULL DEFAULT 'minutos';
