-- AlterTable
ALTER TABLE "public"."usuario" ADD COLUMN     "bloqueado_en" TIMESTAMP(3),
ADD COLUMN     "envio_credenciales_pendiente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivo_bloqueo" TEXT,
ADD COLUMN     "password_temporal" VARCHAR(255),
ADD COLUMN     "password_temporal_expira" TIMESTAMP(3),
ADD COLUMN     "requiere_cambio_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimo_cambio_password" TIMESTAMP(3),
ADD COLUMN     "ultimo_envio_credenciales" TIMESTAMP(3),
ADD COLUMN     "ultimo_error_envio" TEXT;

-- CreateTable
CREATE TABLE "public"."permiso" (
    "id_permiso" SERIAL NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "modulo" VARCHAR(100) NOT NULL,
    "agrupador" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "public"."rol_permiso" (
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("id_rol","id_permiso")
);

-- CreateTable
CREATE TABLE "public"."usuario_permiso" (
    "id_usuario" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "concedido" BOOLEAN NOT NULL DEFAULT true,
    "origen" VARCHAR(20) NOT NULL,
    "comentario" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permiso_pkey" PRIMARY KEY ("id_usuario","id_permiso")
);

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_key" ON "public"."permiso"("codigo");

-- AddForeignKey
ALTER TABLE "public"."rol_permiso" ADD CONSTRAINT "rol_permiso_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."rol"("id_rol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rol_permiso" ADD CONSTRAINT "rol_permiso_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "public"."permiso"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_permiso" ADD CONSTRAINT "usuario_permiso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuario_permiso" ADD CONSTRAINT "usuario_permiso_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "public"."permiso"("id_permiso") ON DELETE CASCADE ON UPDATE CASCADE;
