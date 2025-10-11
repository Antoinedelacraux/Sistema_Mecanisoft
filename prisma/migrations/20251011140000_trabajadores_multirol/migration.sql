-- Alter persona to store address information
ALTER TABLE "persona"
ADD COLUMN "direccion" VARCHAR(200);

-- Allow trabajadores without usuario assigned and adjust foreign key
ALTER TABLE "trabajador"
ALTER COLUMN "id_usuario" DROP NOT NULL;

ALTER TABLE "trabajador"
DROP CONSTRAINT "trabajador_id_usuario_fkey";

ALTER TABLE "trabajador"
ADD CONSTRAINT "trabajador_id_usuario_fkey"
FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename fecha_contrato to fecha_ingreso to align with business terminology
ALTER TABLE "trabajador"
RENAME COLUMN "fecha_contrato" TO "fecha_ingreso";

-- Add new employment fields
ALTER TABLE "trabajador"
ADD COLUMN "cargo" VARCHAR(100) NOT NULL DEFAULT 'Mecánico';

ALTER TABLE "trabajador"
ALTER COLUMN "cargo" DROP DEFAULT;

ALTER TABLE "trabajador"
ADD COLUMN "sueldo_mensual" DECIMAL(10,2);

ALTER TABLE "trabajador"
ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "trabajador"
ADD COLUMN "id_persona" INTEGER;

UPDATE "trabajador" t
SET "id_persona" = u."id_persona"
FROM "usuario" u
WHERE t."id_usuario" = u."id_usuario";

ALTER TABLE "trabajador"
ALTER COLUMN "id_persona" SET NOT NULL;

ALTER TABLE "trabajador"
ADD CONSTRAINT "trabajador_id_persona_fkey"
FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trabajador"
ADD CONSTRAINT "trabajador_id_persona_key" UNIQUE ("id_persona");
