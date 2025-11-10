/*
    Warnings:

    - Made the column `created_at` on table `report_audit` required. This step will fail if there are existing NULL values in that column.
    - Made the column `created_at` on table `report_file` required. This step will fail if there are existing NULL values in that column.
    - Made the column `active` on table `report_schedule` required. This step will fail if there are existing NULL values in that column.
    - Made the column `created_at` on table `report_schedule` required. This step will fail if there are existing NULL values in that column.
    - Made the column `created_at` on table `report_template` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."report_audit" DROP CONSTRAINT "fk_report_audit_usuario";

-- DropForeignKey
ALTER TABLE "public"."report_file" DROP CONSTRAINT "fk_report_file_usuario";

-- DropForeignKey
ALTER TABLE "public"."report_schedule" DROP CONSTRAINT "fk_report_schedule_template";

-- DropForeignKey
ALTER TABLE "public"."report_schedule" DROP CONSTRAINT "fk_report_schedule_usuario";

-- DropForeignKey
ALTER TABLE "public"."report_template" DROP CONSTRAINT "fk_report_template_usuario";

-- AlterTable
ALTER TABLE "public"."report_audit" ALTER COLUMN "action" SET DATA TYPE TEXT,
ALTER COLUMN "template_key" SET DATA TYPE TEXT,
ALTER COLUMN "ip" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."report_file" ALTER COLUMN "template_key" SET DATA TYPE TEXT,
ALTER COLUMN "filename" SET DATA TYPE TEXT,
ALTER COLUMN "mime" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."report_schedule" ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "cron" SET DATA TYPE TEXT,
ALTER COLUMN "last_run_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "next_run_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."report_template" ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "key" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."correlativo_codigo" (
        "id_correlativo_codigo" SERIAL NOT NULL,
        "tipo" VARCHAR(50) NOT NULL,
        "anio" INTEGER NOT NULL,
        "ultimo_valor" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "correlativo_codigo_pkey" PRIMARY KEY ("id_correlativo_codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "correlativo_codigo_tipo_anio_key" ON "public"."correlativo_codigo"("tipo", "anio");

-- AddForeignKey
ALTER TABLE "public"."report_template" ADD CONSTRAINT "report_template_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_schedule" ADD CONSTRAINT "report_schedule_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."report_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_schedule" ADD CONSTRAINT "report_schedule_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_audit" ADD CONSTRAINT "report_audit_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_file" ADD CONSTRAINT "report_file_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
