-- DropForeignKey
ALTER TABLE "public"."detalle_cotizacion" DROP CONSTRAINT "detalle_cotizacion_id_producto_fkey";

-- DropForeignKey
ALTER TABLE "public"."detalle_transaccion" DROP CONSTRAINT "detalle_transaccion_id_producto_fkey";

-- AlterTable
ALTER TABLE "public"."detalle_cotizacion" ADD COLUMN     "id_servicio" INTEGER,
ALTER COLUMN "id_producto" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."detalle_transaccion" ADD COLUMN     "id_servicio" INTEGER,
ALTER COLUMN "id_producto" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."servicio" (
    "id_servicio" SERIAL NOT NULL,
    "codigo_servicio" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "es_general" BOOLEAN NOT NULL DEFAULT false,
    "id_marca" INTEGER,
    "id_modelo" INTEGER,
    "precio_base" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "oferta" BOOLEAN NOT NULL DEFAULT false,
    "tiempo_minutos" INTEGER NOT NULL DEFAULT 60,
    "estatus" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id_servicio")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicio_codigo_servicio_key" ON "public"."servicio"("codigo_servicio");

-- AddForeignKey
ALTER TABLE "public"."detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_cotizacion" ADD CONSTRAINT "detalle_cotizacion_id_servicio_fkey" FOREIGN KEY ("id_servicio") REFERENCES "public"."servicio"("id_servicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."servicio" ADD CONSTRAINT "servicio_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "public"."marca"("id_marca") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."servicio" ADD CONSTRAINT "servicio_id_modelo_fkey" FOREIGN KEY ("id_modelo") REFERENCES "public"."modelo"("id_modelo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_transaccion" ADD CONSTRAINT "detalle_transaccion_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."producto"("id_producto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detalle_transaccion" ADD CONSTRAINT "detalle_transaccion_id_servicio_fkey" FOREIGN KEY ("id_servicio") REFERENCES "public"."servicio"("id_servicio") ON DELETE SET NULL ON UPDATE CASCADE;
