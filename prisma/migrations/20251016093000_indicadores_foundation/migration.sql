-- Agregar soporte base para módulo de indicadores de mantenimientos

-- Columnas nuevas en transaccion
ALTER TABLE "public"."transaccion"
  ADD COLUMN IF NOT EXISTS "fecha_cierre" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "transaccion_fecha_cierre_idx"
  ON "public"."transaccion" ("fecha_cierre");

-- Columnas nuevas en inventario_producto
ALTER TABLE "public"."inventario_producto"
  ADD COLUMN IF NOT EXISTS "es_critico" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "inventario_producto_es_critico_idx"
  ON "public"."inventario_producto" ("es_critico");

-- Tabla orden_historial
CREATE TABLE IF NOT EXISTS "public"."orden_historial" (
  "id_orden_historial" SERIAL PRIMARY KEY,
  "orden_id" INTEGER NOT NULL,
  "old_status" VARCHAR(30),
  "new_status" VARCHAR(30) NOT NULL,
  "nota" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changed_by" INTEGER
);

CREATE INDEX IF NOT EXISTS "orden_historial_orden_created_idx"
  ON "public"."orden_historial" ("orden_id", "created_at");

ALTER TABLE "public"."orden_historial"
  ADD CONSTRAINT "orden_historial_orden_id_fkey"
  FOREIGN KEY ("orden_id") REFERENCES "public"."transaccion"("id_transaccion")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."orden_historial"
  ADD CONSTRAINT "orden_historial_changed_by_fkey"
  FOREIGN KEY ("changed_by") REFERENCES "public"."usuario"("id_usuario")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla mantenimiento
CREATE TABLE IF NOT EXISTS "public"."mantenimiento" (
  "id_mantenimiento" SERIAL PRIMARY KEY,
  "codigo" VARCHAR(50) NOT NULL,
  "id_vehiculo" INTEGER NOT NULL,
  "id_cliente" INTEGER,
  "id_transaccion" INTEGER,
  "titulo" VARCHAR(150),
  "descripcion" TEXT,
  "estado" VARCHAR(30) NOT NULL DEFAULT 'planificado',
  "prioridad" VARCHAR(20) NOT NULL DEFAULT 'media',
  "fecha_programada" TIMESTAMP(3) NOT NULL,
  "fecha_inicio" TIMESTAMP(3),
  "fecha_realizada" TIMESTAMP(3),
  "motivo_cancelacion" TEXT,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "mantenimiento_codigo_key"
  ON "public"."mantenimiento" ("codigo");

CREATE INDEX IF NOT EXISTS "mantenimiento_fecha_programada_idx"
  ON "public"."mantenimiento" ("fecha_programada");

CREATE INDEX IF NOT EXISTS "mantenimiento_estado_idx"
  ON "public"."mantenimiento" ("estado");

ALTER TABLE "public"."mantenimiento"
  ADD CONSTRAINT "mantenimiento_id_vehiculo_fkey"
  FOREIGN KEY ("id_vehiculo") REFERENCES "public"."vehiculo"("id_vehiculo")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."mantenimiento"
  ADD CONSTRAINT "mantenimiento_id_cliente_fkey"
  FOREIGN KEY ("id_cliente") REFERENCES "public"."cliente"("id_cliente")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."mantenimiento"
  ADD CONSTRAINT "mantenimiento_id_transaccion_fkey"
  FOREIGN KEY ("id_transaccion") REFERENCES "public"."transaccion"("id_transaccion")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla mantenimiento_historial
CREATE TABLE IF NOT EXISTS "public"."mantenimiento_historial" (
  "id_mantenimiento_historial" SERIAL PRIMARY KEY,
  "mantenimiento_id" INTEGER NOT NULL,
  "old_fecha" TIMESTAMP(3),
  "new_fecha" TIMESTAMP(3),
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changed_by" INTEGER
);

CREATE INDEX IF NOT EXISTS "mantenimiento_historial_mantenimiento_created_idx"
  ON "public"."mantenimiento_historial" ("mantenimiento_id", "created_at");

ALTER TABLE "public"."mantenimiento_historial"
  ADD CONSTRAINT "mantenimiento_historial_mantenimiento_id_fkey"
  FOREIGN KEY ("mantenimiento_id") REFERENCES "public"."mantenimiento"("id_mantenimiento")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."mantenimiento_historial"
  ADD CONSTRAINT "mantenimiento_historial_changed_by_fkey"
  FOREIGN KEY ("changed_by") REFERENCES "public"."usuario"("id_usuario")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla feedback
CREATE TABLE IF NOT EXISTS "public"."feedback" (
  "id_feedback" SERIAL PRIMARY KEY,
  "orden_id" INTEGER NOT NULL,
  "score" INTEGER NOT NULL CHECK ("score" BETWEEN 1 AND 5),
  "comentario" TEXT,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "feedback_orden_id_idx"
  ON "public"."feedback" ("orden_id");

ALTER TABLE "public"."feedback"
  ADD CONSTRAINT "feedback_orden_id_fkey"
  FOREIGN KEY ("orden_id") REFERENCES "public"."transaccion"("id_transaccion")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Evitar duplicar relación mantenimiento-orden
CREATE UNIQUE INDEX IF NOT EXISTS "mantenimiento_id_transaccion_key"
  ON "public"."mantenimiento" ("id_transaccion")
  WHERE "id_transaccion" IS NOT NULL;
