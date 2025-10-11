-- Create enum defensively (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservaestado') THEN
    CREATE TYPE "ReservaEstado" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'LIBERADA', 'CANCELADA');
  END IF;
END$$;

-- Create table defensively (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'reserva_inventario'
  ) THEN
    CREATE TABLE "public"."reserva_inventario" (
      "id_reserva_inventario" SERIAL PRIMARY KEY,
      "id_inventario_producto" INTEGER NOT NULL,
      "id_transaccion" INTEGER,
      "id_detalle_transaccion" INTEGER,
      "cantidad" DECIMAL(14,4) NOT NULL,
      "estado" "ReservaEstado" NOT NULL DEFAULT 'PENDIENTE',
      "motivo" TEXT,
      "metadata" JSONB,
      "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END$$;

-- Add foreign keys defensively only if target tables exist and constraint not present
DO $$
BEGIN
  -- FK to inventario_producto
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inventario_producto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'reserva_inventario'
      AND constraint_name = 'reserva_inventario_id_inventario_producto_fkey'
  ) THEN
    ALTER TABLE "public"."reserva_inventario"
      ADD CONSTRAINT "reserva_inventario_id_inventario_producto_fkey"
      FOREIGN KEY ("id_inventario_producto")
      REFERENCES "public"."inventario_producto"("id_inventario_producto")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  -- FK to transaccion
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'transaccion'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'reserva_inventario'
      AND constraint_name = 'reserva_inventario_id_transaccion_fkey'
  ) THEN
    ALTER TABLE "public"."reserva_inventario"
      ADD CONSTRAINT "reserva_inventario_id_transaccion_fkey"
      FOREIGN KEY ("id_transaccion")
      REFERENCES "public"."transaccion"("id_transaccion")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  -- FK to detalle_transaccion
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'detalle_transaccion'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'reserva_inventario'
      AND constraint_name = 'reserva_inventario_id_detalle_transaccion_fkey'
  ) THEN
    ALTER TABLE "public"."reserva_inventario"
      ADD CONSTRAINT "reserva_inventario_id_detalle_transaccion_fkey"
      FOREIGN KEY ("id_detalle_transaccion")
      REFERENCES "public"."detalle_transaccion"("id_detalle_transaccion")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Indexes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'reserva_inventario_transaccion_idx' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "reserva_inventario_transaccion_idx"
      ON "public"."reserva_inventario" ("id_transaccion");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'reserva_inventario_detalle_idx' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "reserva_inventario_detalle_idx"
      ON "public"."reserva_inventario" ("id_detalle_transaccion");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'reserva_inventario_estado_idx' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "reserva_inventario_estado_idx"
      ON "public"."reserva_inventario" ("estado");
  END IF;
END$$;
