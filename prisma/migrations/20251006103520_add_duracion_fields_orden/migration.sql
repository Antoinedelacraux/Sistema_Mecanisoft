-- DropForeignKey
ALTER TABLE "public"."tarea" DROP CONSTRAINT "tarea_id_trabajador_fkey";

-- AlterTable
ALTER TABLE "public"."transaccion" ADD COLUMN     "duracion_max" INTEGER,
ADD COLUMN     "duracion_min" INTEGER,
ADD COLUMN     "unidad_tiempo" VARCHAR(10);

-- AddForeignKey
ALTER TABLE "public"."tarea" ADD CONSTRAINT "tarea_id_trabajador_fkey" FOREIGN KEY ("id_trabajador") REFERENCES "public"."trabajador"("id_trabajador") ON DELETE SET NULL ON UPDATE CASCADE;
