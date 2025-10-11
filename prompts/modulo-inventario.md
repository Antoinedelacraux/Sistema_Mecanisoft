# Propuesta de módulo de inventario

## Contexto y objetivos
- Centralizar el control de existencias de repuestos e insumos del taller.
- Mantener trazabilidad de entradas, salidas, ajustes y transferencias entre ubicaciones.
- Integrarse con los módulos de productos, órdenes de trabajo y facturación para sincronizar consumos y valorizaciones.
- Ofrecer indicadores rápidos (stock disponible, stock comprometido, niveles críticos) junto con alertas automatizadas.

## Principios de diseño
- **Consistencia con el resto de la app**: mantener nomenclatura en español, esquema Prisma, bitácora de acciones y validaciones server-first.
- **Auditoría completa**: cada movimiento genera un registro en `bitacora_inventario` y se asocia al usuario autenticado.
- **Escalabilidad**: permitir ubicar productos por almacén, estante y contenedor; soportar variantes de productos o atributos adicionales sin refactor mayor.
- **Integración declarativa**: exponer servicios reutilizables para que órdenes y facturación descuenten o bloqueen stock mediante transacciones Prisma.

## Modelo de datos propuesto (Prisma)
```prisma
model Almacen {
  id_almacen        Int                  @id @default(autoincrement())
  nombre            String
  descripcion       String?
  direccion         String?
  activo            Boolean              @default(true)
  ubicaciones       AlmacenUbicacion[]
  inventarios       InventarioProducto[]
  creado_en         DateTime             @default(now())
  actualizado_en    DateTime             @updatedAt
}

model AlmacenUbicacion {
  id_almacen_ubicacion Int                @id @default(autoincrement())
  id_almacen           Int
  codigo               String             @unique
  descripcion          String?
  activo               Boolean            @default(true)
  inventarios          InventarioProducto[]
  almacen              Almacen            @relation(fields: [id_almacen], references: [id_almacen])
  creado_en            DateTime           @default(now())
  actualizado_en       DateTime           @updatedAt
}

model InventarioProducto {
  id_inventario_producto Int             @id @default(autoincrement())
  id_producto            Int
  id_almacen             Int
  id_almacen_ubicacion   Int?
  stock_disponible       Decimal          @default(0)
  stock_comprometido     Decimal          @default(0)
  stock_minimo           Decimal          @default(0)
  stock_maximo           Decimal?
  costo_promedio         Decimal          @default(0)
  producto               Producto         @relation(fields: [id_producto], references: [id_producto])
  almacen                Almacen          @relation(fields: [id_almacen], references: [id_almacen])
  ubicacion              AlmacenUbicacion @relation(fields: [id_almacen_ubicacion], references: [id_almacen_ubicacion])
  movimientos            MovimientoInventario[]
  creado_en              DateTime         @default(now())
  actualizado_en         DateTime         @updatedAt

  @@unique([id_producto, id_almacen, id_almacen_ubicacion])
}

model MovimientoInventario {
  id_movimiento_inventario Int            @id @default(autoincrement())
  tipo                     MovimientoTipo
  id_producto              Int
  id_inventario_producto   Int
  cantidad                 Decimal
  costo_unitario           Decimal
  referencia_origen        String?        // p.e. id de orden o factura
  origen_tipo              MovimientoOrigen?
  observaciones            String?
  id_usuario               Int
  fecha                    DateTime        @default(now())
  producto                 Producto         @relation(fields: [id_producto], references: [id_producto])
  inventario               InventarioProducto @relation(fields: [id_inventario_producto], references: [id_inventario_producto])
  usuario                  Usuario          @relation(fields: [id_usuario], references: [id_usuario])
  detalle_transferencia    MovimientoTransferencia? @relation("TransferenciaDetalle", fields: [id_movimiento_transferencia], references: [id_movimiento_transferencia])
  id_movimiento_transferencia Int?
  bitacora                 BitacoraInventario[]
}

enum MovimientoTipo {
  INGRESO
  SALIDA
  AJUSTE_POSITIVO
  AJUSTE_NEGATIVO
  TRANSFERENCIA_ENVIO
  TRANSFERENCIA_RECEPCION
}

enum MovimientoOrigen {
  COMPRA
  ORDEN_TRABAJO
  FACTURACION
  AJUSTE_MANUAL
  TRANSFERENCIA
  OTRO
}

model MovimientoTransferencia {
  id_movimiento_transferencia Int @id @default(autoincrement())
  id_movimiento_envio         Int
  id_movimiento_recepcion     Int
  estado                      TransferenciaEstado @default(PENDIENTE_RECEPCION)
  creado_en                   DateTime @default(now())
  actualizado_en              DateTime @updatedAt

  movimiento_envio     MovimientoInventario @relation("TransferenciaEnvio", fields: [id_movimiento_envio], references: [id_movimiento_inventario])
  movimiento_recepcion MovimientoInventario @relation("TransferenciaRecepcion", fields: [id_movimiento_recepcion], references: [id_movimiento_inventario])
}

enum TransferenciaEstado {
  PENDIENTE_RECEPCION
  COMPLETADA
  ANULADA
}

model BitacoraInventario {
  id_bitacora_inventario Int      @id @default(autoincrement())
  id_movimiento          Int
  id_usuario             Int
  accion                 String
  descripcion            String?
  metadata               Json?
  creado_en              DateTime @default(now())
  movimiento             MovimientoInventario @relation(fields: [id_movimiento], references: [id_movimiento_inventario])
  usuario                Usuario             @relation(fields: [id_usuario], references: [id_usuario])
}
```

## Servicios y utilidades back-end
- **`src/lib/inventario/prisma-utils.ts`**: helpers para cargar inventarios con includes frecuentes, conversión de decimales y validaciones de stock.
- **Servicios principales**:
  - `registrarIngreso({ productoId, almacenId, cantidad, costoUnitario, referencia })`
  - `registrarSalida({ productoId, almacenId, cantidad, origenTipo, referencia })`
  - `registrarAjuste({ productoId, almacenId, cantidad, motivo, esPositivo })`
  - `transferirStock({ productoId, origenAlmacenId, destinoAlmacenId, cantidad, usuarioId })`
  - Cada servicio opera en transacciones Prisma, actualiza `stock_disponible`/`stock_comprometido`, recalcula `costo_promedio` y genera bitácora.
- **Integración con órdenes**: al reservar una orden, incrementar `stock_comprometido`; al completarla, convertir a salida definitiva o devolver stock.
- **Alertas**: utilidades para detectar `stock_disponible` por debajo de `stock_minimo`. Se pueden ejecutar en un cron (p.e. `/api/inventario/alertas/cron`).

## API (App Router)
- `src/app/api/inventario/almacenes/route.ts`
  - GET (listado paginado, filtros activos), POST (crear almacén).
- `src/app/api/inventario/almacenes/[id]/route.ts`
  - GET detalle, PUT update, DELETE soft delete.
- `src/app/api/inventario/almacenes/[id]/ubicaciones/route.ts`
  - GET (paginado por almacén) y POST (crear ubicación con validaciones de unicidad).
- `src/app/api/inventario/almacenes/[id]/ubicaciones/[ubicacionId]/route.ts`
  - GET detalle, PUT update, DELETE soft delete de ubicaciones.
- `src/app/api/inventario/productos/route.ts`
  - GET stock por producto, POST crear inventario inicial.
- `src/app/api/inventario/movimientos/route.ts`
  - GET (paginación, filtros por tipo, producto, fecha), POST para registrar ingresos/salidas/ajustes.
- `src/app/api/inventario/transferencias/route.ts`
  - POST crear transferencia (genera envío + recepción pendiente).
- `src/app/api/inventario/transferencias/[id]/route.ts`
  - PATCH para confirmar recepción o anular.
- `src/app/api/inventario/reportes/route.ts`
  - GET con totales por almacén, valorización y nivel crítico.
- Todas las rutas con guardia `getServerSession(authOptions)` y bitácora con `prisma.bitacoraInventario.create`.

## Componentes y vistas (App Router)
- `src/app/dashboard/inventario/page.tsx`
  - Overview con KPIs, cards de stock crítico, gráfico simples (stock vs comprometido).
- `src/app/dashboard/inventario/almacenes/page.tsx`
  - Vista para gestionar almacenes y sus ubicaciones con formularios rápidos de creación.
- `src/app/dashboard/inventario/movimientos/page.tsx`
  - Tabla con filtro por tipo, fecha, almacén; botón "Registrar movimiento".
- `src/app/dashboard/inventario/transferencias/page.tsx`
  - Asistente para transferencias (seleccionar almacén origen/destino, productos, cantidades) + timeline de estados.
- `src/app/dashboard/inventario/ajustes/page.tsx`
  - Formulario de ajuste con motivo, soporte adjunto (opcional) y vista previa de impacto.
- Componentes reutilizables en `src/components/inventario/`:
  - `inventario-table.tsx`, `movimiento-form.tsx`, `transferencia-wizard.tsx`, `stock-badges.tsx`.
  - Formularios rápidos (`movimiento-quick-form.tsx`, `transferencia-wizard.tsx`) utilizan los selectores de almacenes/ubicaciones para reducir errores al capturar IDs manuales.
  - `almacenes/almacenes-manager.tsx` centraliza listado paginado, búsqueda y formularios para almacenes/ubicaciones.
  - Selectores de dominio (`selectors/almacen-select.tsx`, `selectors/ubicacion-select.tsx`) exponen listas reusables de almacenes y ubicaciones con soporte para estados inactivos, búsqueda incremental con debounce y paginación "cargar más".
  - El asistente de órdenes (`orden-wizard.tsx`) reutiliza estos selectores para asociar cada producto a un almacén y, opcionalmente, a una ubicación específica antes de confirmar la orden.
- Integración con productos: botón "Ver stock" que abre drawer con stock por almacén y detalle de movimientos recientes.

## Flujos clave
1. **Ingreso por compra**
   - API de compras u órdenes genera `registrarIngreso` con costo unitario del proveedor.
   - Recalcula `costo_promedio` usando `costo_promedio = ((stock_actual * costo_actual) + (cantidad * costo_nuevo)) / (stock_actual + cantidad)`.
2. **Reserva de stock para orden de trabajo**
   - Al crear orden, reservar (incrementar `stock_comprometido`).
   - Al comenzar la ejecución, convertir reserva en salida real (disminuir disponible, comprometido).
3. **Ajuste inventario**
   - Usuario con rol "Supervisor" hace conteo físico, registra diferencia en módulo de ajustes.
   - Se requiere motivo, evidencia (foto). Bitácora almacena metadata.
4. **Transferencia entre almacenes**
   - Se crea movimiento doble: envío (disminuye disponible en origen) y recepción pendiente.
   - Al confirmar recepción, aumentar disponible en destino.
5. **Alertas y reportes**
   - Cron diario evalúa `stock_disponible <= stock_minimo` y envía notificación (correo o notificación in-app).
   - Reporte de valorización: suma `stock_disponible * costo_promedio` por almacén.

## Seguridad y roles
- Permisos nuevos en tabla de roles: `inventario_ver`, `inventario_editar`, `inventario_transferir`, `inventario_ajustar`.
- Middleware y componentes deben verificar roles antes de mostrar acciones sensibles.
- Todas las mutaciones registran usuario y IP opcional en metadata.

## Testing
- Tests unitarios en `tests/lib/inventario/` para cada servicio (mock Prisma + bitácora) siguiendo patrón actual.
- Tests de API (`tests/api/inventarioMovimientosApi.test.ts`, `tests/api/inventarioAlmacenesApi.test.ts`, `tests/api/inventarioUbicacionesApi.test.ts`) para validar validaciones y respuestas 401/422/409.
- Tests de integración front-end con React Testing Library para formularios críticos (movimientos, transferencias).

## Migraciones y despliegue
- Nueva migración Prisma con tablas y enums anteriores.
- Script de seed opcional para crear almacén principal "Almacén Central" y ubicaciones base.
- Ajustar `prisma/clean-test-data.ts` para limpiar tablas inventario.

## Roadmap futuro
- Webhooks o integración con ERP.
- Inventario multi-moneda (costo promedio por moneda).
- Serialización o lotes (tracking por número de serie o lote).
- Forecasting con series históricas para recomendar reposición.

## Plan de implementación iterativo
1. **Iteración 0 – Preparación**
  - Revisar y aprobar el modelo de datos con negocio.
  - Crear migración inicial de Prisma y actualizar seeds (almacén principal, ubicaciones base).
  - Configurar tests básicos (`tests/lib/inventario` y `tests/api/inventario`) como skeleton con mocks de Prisma.
2. **Iteración 1 – Core de inventario**
  - Implementar servicios `registrarIngreso`, `registrarSalida`, `registrarAjuste` con pruebas unitarias.
  - Exponer endpoints `POST /api/inventario/movimientos` para ingresos y salidas.
  - UI mínima para registrar movimientos manuales y ver stock disponible.
  - Ejecutar `npx tsc --noEmit` y `npm run lint` al cierre.
3. **Iteración 2 – Reservas y órdenes**
  - Conectar con módulo de órdenes para reservar stock (`stock_comprometido`).
    - Añadir endpoints específicos (`POST /api/inventario/reservas`) y hooks del lado de órdenes.
    - Cobertura de tests sobre escenarios de reserva/consumo y errores de stock insuficiente.
    - Reutilizar selectores de almacén/ubicación en el wizard de órdenes para definir el punto exacto de reserva por producto.
4. **Iteración 3 – Transferencias y ajustes avanzados**
  - Implementar flujo completo de transferencia (envío, recepción, anulación) con wizard UI.
  - Registrar ajustes con evidencia y ampliar bitácora.
  - Pruebas end-to-end sobre transferencias (API + componentes clave).
5. **Iteración 4 – Alertas y reportes**
  - Implementar cron/endpoint para alertas de stock mínimo.
  - Generar reportes de valorización y tablero de KPIs.
  - Afinar documentación, métricas y observabilidad.

Cada iteración debe concluir con:
- `npx tsc --noEmit` para garantizar que no se introducen errores de tipos.
- `npm run lint` y tests pertinentes (`npx jest tests/lib/inventario --runInBand`).
- Actualización de bitácora de cambios y checklist de dependencias (órdenes, facturación, productos).

## Buenas prácticas y mantenibilidad
- **Límites de archivo**: dividir servicios y componentes grandes en archivos de ~500 líneas máximo (ej. separar `movimiento-service.ts`, `transferencia-service.ts`).
- **Agrupación por dominio**: usar estructura `src/lib/inventario/`, `src/app/api/inventario/`, `src/components/inventario/` para aislar lógica y UI.
- **Transacciones Prisma**: encapsular operaciones críticas en funciones utilitarias para reuso y consistencia.
- **Tipado estricto**: definir tipos compartidos en `src/types/inventario.ts` y reexportarlos para evitar duplicación.
- **Bitácora consistente**: crear helper `registrarBitacoraInventario` que reciba acción, descripción y metadata normalizada.
- **Validaciones server-first**: validar payloads con Zod en las rutas API antes de invocar servicios.
- **Integración continua**: incluir el directorio `tests/lib/inventario` en la suite existente y asegurar que `npx tsc --noEmit` forma parte del pipeline antes de merge.
- **Documentación viva**: mantener este `.md` y los README parciales sincronizados con cada iteración.
