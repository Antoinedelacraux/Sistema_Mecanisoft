-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('DNI', 'RUC', 'CE', 'PASAPORTE');

-- AlterTable: add new columns to persona
ALTER TABLE "persona"
  ADD COLUMN     "registrar_empresa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "fecha_nacimiento" DATE;

-- Ensure existing document types are uppercase before casting
UPDATE "persona" SET "tipo_documento" = UPPER("tipo_documento") WHERE "tipo_documento" IS NOT NULL;

-- Alter columna tipo_documento to enum
ALTER TABLE "persona"
  ALTER COLUMN "tipo_documento" TYPE "TipoDocumento" USING "tipo_documento"::"TipoDocumento";

-- Drop legacy empresa field
ALTER TABLE "persona" DROP COLUMN IF EXISTS "empresa";

-- CreateTable empresa_persona
CREATE TABLE "empresa_persona" (
    "id_empresa_persona" SERIAL PRIMARY KEY,
    "persona_id" INTEGER NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(150) NOT NULL,
    "nombre_comercial" VARCHAR(100),
    "direccion_fiscal" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraints
CREATE UNIQUE INDEX "empresa_persona_ruc_key" ON "empresa_persona"("ruc");
CREATE UNIQUE INDEX "empresa_persona_persona_id_key" ON "empresa_persona"("persona_id");

-- Foreign key with cascade delete
ALTER TABLE "empresa_persona"
  ADD CONSTRAINT "empresa_persona_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;
