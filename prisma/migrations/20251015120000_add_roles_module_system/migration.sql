CREATE TABLE "modulo" (
    "id_modulo" SERIAL PRIMARY KEY,
    "clave" VARCHAR(100) NOT NULL UNIQUE,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert core module rows that may already be referenced by existing permiso records
-- This ensures the foreign key constraint added later will not fail when permisos exist
INSERT INTO "modulo" (clave, nombre, descripcion, activo)
VALUES
  ('dashboard', 'Dashboard', 'Indicadores generales del taller', true),
  ('clientes', 'Clientes', 'Gestión de clientes y personas asociadas', true),
  ('inventario', 'Inventario', 'Stock, movimientos y compras de inventario', true),
  ('ordenes', 'Órdenes de trabajo', 'Flujos de órdenes y tareas del taller', true),
  ('facturacion', 'Facturación', 'Emisión de comprobantes y ventas', true),
  ('usuarios', 'Usuarios', 'Administración de cuentas y credenciales', true),
  ('cotizaciones', 'Cotizaciones', 'Gestión de cotizaciones comerciales', true),
  ('servicios', 'Servicios', 'Catálogo de servicios ofrecidos', true),
  ('tareas', 'Tareas', 'Kanban y seguimiento de tareas internas', true),
  ('reportes', 'Reportes', 'Reportes analíticos y descargas', true),
  ('roles', 'Roles', 'Plantillas de permisos y asignaciones', true),
  ('ventas', 'Ventas', 'Módulo de ventas y facturación', true)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE "rol" ADD COLUMN "descripcion" TEXT;
ALTER TABLE "rol" ADD COLUMN "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "permiso" ADD CONSTRAINT "permiso_modulo_fkey"
  FOREIGN KEY ("modulo") REFERENCES "modulo"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "permiso_modulo_idx" ON "permiso"("modulo");

ALTER TABLE "rol_permiso" ADD COLUMN "asignado_por" INTEGER;
ALTER TABLE "rol_permiso" ADD COLUMN "descripcion" TEXT;

ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_asignado_por_fkey"
  FOREIGN KEY ("asignado_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL;