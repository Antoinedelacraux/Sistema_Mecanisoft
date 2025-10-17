-- Tabla para cachear resultados de indicadores de mantenimientos
CREATE TABLE IF NOT EXISTS "public"."indicador_cache" (
  "id_indicador_cache" SERIAL PRIMARY KEY,
  "indicador" VARCHAR(60) NOT NULL,
  "hash" VARCHAR(64) NOT NULL,
  "rango_desde" TIMESTAMP(3) NOT NULL,
  "rango_hasta" TIMESTAMP(3) NOT NULL,
  "parametros" JSONB,
  "payload" JSONB NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "indicador_cache_hash_key"
  ON "public"."indicador_cache" ("hash");

CREATE INDEX IF NOT EXISTS "indicador_cache_indicador_rango_idx"
  ON "public"."indicador_cache" ("indicador", "rango_desde", "rango_hasta");
