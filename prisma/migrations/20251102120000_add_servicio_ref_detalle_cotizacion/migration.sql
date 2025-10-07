-- Add servicio_ref column to detalle_cotizacion for product-service association in cotizaciones
ALTER TABLE "public"."detalle_cotizacion" ADD COLUMN "servicio_ref" INTEGER;
