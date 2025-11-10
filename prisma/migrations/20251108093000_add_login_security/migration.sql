ALTER TABLE "usuario"
  ADD COLUMN "intentos_fallidos_login" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ultimo_intento_fallido" TIMESTAMP(3);
