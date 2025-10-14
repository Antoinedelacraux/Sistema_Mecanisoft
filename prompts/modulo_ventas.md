# Módulo Ventas — Especificación de alto nivel

Propósito
- Unificar y visualizar las ventas del taller a partir de las facturaciones (comprobantes electrónicos).
- Permitir distinguir el origen de cada comprobante: si la venta proviene de una Orden de Trabajo o de una Cotización.
- Mostrar en una tabla el resumen de lo solicitado (líneas / totales) y permitir ver el detalle completo del comprobante.
- Validar y registrar el estado de pago por método (efectivo, tarjeta, app móvil u otros) y permitir marcar o editar el pago.
- Ofrecer tarjetas de KPI (total ventas, facturas emitidas, ventas por método, etc.) donde el total de ventas se actualice según el filtro por fecha.
- Incluir filtros avanzados (fecha *obligatorio*, estado, tipo, origen, método de pago, serie) y exportación simple (CSV/PDF).

Alcance importante
- El módulo "Ventas" sólo trabaja con comprobantes en estado `EMITIDO`. Todas las vistas, tarjetas KPI y operaciones de conciliación deben filtrar por `estado=EMITIDO` por defecto. Esto evita incluir borradores o comprobantes anulados/observados en los totales y reportes del módulo.

Audiencia
- Administradores y personal de caja / facturación que necesitan revisar y conciliar ventas diarias.

Requisitos funcionales (resumido)
------------------------------
1. Listado principal
   - Fuente de datos: `GET /api/facturacion/comprobantes` (ya existente). El módulo consumirá ese endpoint filtrando por estado "EMITIDO" y/o el rango de fecha seleccionado.
   - Tabla con columnas mínimas:
     - Código (serie-número)
     - Fecha de emisión
     - Origen (Cotización / Orden) + enlace al origen si existe
     - Resumen/Descripción corta (ej: 3 ítems • subtotal/total)
     - Receptor (nombre y documento)
     - Método de pago (si hay registro)
     - Total
     - Estado (BORRADOR / EMITIDO / ANULADO / OBSERVADO)
     - Acciones: Ver detalle, Marcar pago, Exportar PDF, Enviar por correo
   - Paginación y orden por fecha descendente por defecto.

2. Tarjetas KPI (arriba del listado)
   - Total ventas (suma de `total` de comprobantes emitidos en el filtro actual).
   - Número de comprobantes (emitidos) en el período.
   - Ventas por método (tarjeta / efectivo / app móvil / otros) — tarjetas o mini-gráfico.
   - Promedio por comprobante.
   - Estas tarjetas deben recalcularse cada vez que se cambie el filtro por fecha (fecha o rango). El requisito puntual: "debe tener sí o sí el filtro por fecha y que por fecha cambie el total de ventas de la tarjeta".

3. Filtro por fecha
   - Input tipo fecha (single day) y opción de rango (fecha_desde / fecha_hasta) más adelante.
   - Por defecto: hoy.
   - Al cambiar la fecha, la tabla y las tarjetas KPI se recalculan usando `date=YYYY-MM-DD` o `fecha_desde`/`fecha_hasta` pasados al endpoint.

4. Ver detalle
   - Modal o página que muestra el comprobante completo (el mismo detalle que en `facturacion-comprobantes`): ítems, totales, receptor, origen, PDF.
   - Allí se podrá ver la referencia al origen (si existe): enlace a la orden o cotización.

5. Pago y conciliación
   - Cada comprobante tiene un campo de pago opcional (puede existir en la tabla `facturacion_pago` o como metadata en `comprobante` según el model existente). Si no existe, permitir marcar el pago manualmente.
   - Operaciones:
     - Marcar como pagado (seleccionar método: `EFECTIVO`, `TARJETA`, `APP_MOVIL`, `OTRO`) y registrar fecha/hora y referencia (autorización de tarjeta o número de operación).
     - Editar/Anular registro de pago (si el usuario tiene permiso).
   - Visualizar en la tabla el estado de pago (Pagado / Pendiente) y el método.

6. Exportar y reporte rápido
   - Botón para exportar el listado filtrado a CSV.
   - Botón para imprimir o descargar PDF de una selección.

7. Seguridad y permisos
   - Mostrar/permitir acciones según permisos (`facturacion.emitir`, `facturacion.ver`, `ventas.conciliar`, etc.).
   - Operaciones sensibles (anular comprobante, editar pago) requieren permiso específico.

8. API / Contrato servidor
   - Reutilizar `GET /api/facturacion/comprobantes` con soporte de query params:
       - `date=YYYY-MM-DD` (filtra `fecha_emision` dentro del día) 
       - `fecha_desde` / `fecha_hasta` (rango) 
       - `origen` (COTIZACION|ORDEN) 
       - `metodo_pago` (EFECTIVO|TARJETA|APP_MOVIL|OTRO) 
       - `estado` (BORRADOR|EMITIDO|ANULADO|OBSERVADO) 
   - Nuevo endpoint para marcar/registrar pago:
     - POST /api/ventas/pagos
       - body: { id_comprobante: number, metodo: string, referencia?: string, monto?: number, fecha_pago?: string }
       - valida permisos y crea/actualiza registro de pago.
   - Nuevo endpoint para obtener resumen KPI (alternativa: calcular en el cliente sumando la respuesta del GET):
     - GET /api/ventas/resumen?date=YYYY-MM-DD
       - devuelve { totalVentas, numeroComprobantes, porMetodo: { TARJETA: x, EFECTIVO: y, ... }, promedio }

9. UI / UX notes
   - Mantener los componentes visuales shadcn existentes y el mismo lenguaje en español.
   - Tabla con row-click para abrir detalle en modal.
   - Marcar pago abre un modal pequeño con selección de método y campo referencia.
   - Las tarjetas KPI deben ser responsive y mostrar subtítulo con el periodo actualmente seleccionado (ej: "Hoy: 2025-10-14").

10. Casos borde y validaciones
   - Si se filtra por fecha con formato inválido, mostrar error local y no llamar al API.
   - Si no hay comprobantes en el rango, tarjetas muestran 0 y la tabla muestra mensaje "No se encontraron ventas".
   - Conciliar pagos parcial: si un comprobante es parcialmente pagado (monto < total), el estado será "Parcial" y se podrá registrar múltiples pagos parciales (si el modelo lo permite). Si no, prohibir y requerir registro manual de ajuste.

11. Tests sugeridos
   - API tests para `GET /api/ventas/resumen` con diferentes fechas.
   - API tests para `POST /api/ventas/pagos` (crear, actualizar, permisos, invalid data).
   - UI test: cambiar filtro por fecha actualiza tarjetas y tabla.

12. Entregables mínimos (MVP)
   - `prompts/modulo_ventas.md` (este archivo) — idea y requisitos.
   - Página `src/app/dashboard/ventas/page.tsx` placeholder con estructura de tarjetas + tabla que consume `GET /api/facturacion/comprobantes?date=YYYY-MM-DD`.
   - Endpoint `POST /api/ventas/pagos` (esqueleto) y tests básicos.
   - Documentación breve en `prompts/` sobre los flujos de pago y permisos.

Notas técnicas y decisiones recomendadas
- Reusar los helpers y serializadores de `src/lib/facturacion/comprobantes.ts` para no duplicar lógica de serialización.
- Para el registro de pagos, agregar la tabla `venta_pago` o `comprobante_pago` en Prisma sólo si el dominio lo requiere; para MVP se puede usar `comprobante.metadatos` (JSON) para guardar { pagos: [...] } y luego normalizar si crece.
- Mantener las validaciones del lado servidor (zod) y bitácora para los cambios importantes (registro de pago, anulación).

Estrategia recomendada (intermedia)
-----------------------------------
Para un equilibrio entre simplicidad y rendimiento recomendamos materializar una entidad `Venta` (tabla) y escribir/actualizarla atómicamente en el flujo de emisión del comprobante (upsert dentro de la transacción de `emitirComprobante`).

Por qué esta opción:
- No es tan básica como consultar en tiempo real (evita recálculos pesados constantes en lectura).
- No es tan compleja como montar cola/worker (no requiere infraestructura extra de mensajería ni workers).
- Permite lecturas y KPIs muy rápidas, indexables y fáciles de auditar.
- Garantiza consistencia si el upsert se ejecuta dentro de la misma transacción que emite el comprobante.

Qué implica (pasos concretos)
1. Añadir un modelo `Venta` en Prisma que materialice la información esencial de la venta (FK a `comprobante`, fecha, total, método principal, estado de pago, metadata, created/updated timestamps). Ver ejemplo de schema abajo.
2. Actualizar la función `emitirComprobante` para que, dentro del `prisma.$transaction`, haga un `upsert` en `venta` (crear si no existe o actualizar si ya existe). Usar `upsert` aporta idempotencia y evita duplicados en reintentos.
3. Crear un script de backfill para poblar `venta` desde los comprobantes existentes (`estado = 'EMITIDO'`). Ejecutarlo en staging/producción controlada.
4. Añadir tests que cubran emisión → venta creado, reintentos (idempotencia), anulación/edición → venta actualizada o marcada como anulada.
5. Añadir índices en `venta` (por ejemplo, `fecha`, `metodo_principal`) para acelerar consultas y KPIs.

Ejemplo de modelo Prisma (fragmento a añadir en `prisma/schema.prisma`):

```prisma
model Venta {
   id_venta         Int      @id @default(autoincrement())
   id_comprobante   Int      @unique
   fecha            DateTime
   total            Decimal  @db.Decimal(10,2)
   metodo_principal String?  // EFECTIVO/TARJETA/APP_MOVIL/OTRO
   estado_pago      String?  // pendiente/pagado/parcial
   metadata         Json?
   creado_en        DateTime @default(now())
   actualizado_en   DateTime @updatedAt

   comprobante      Comprobante @relation(fields: [id_comprobante], references: [id_comprobante])
   @@index([fecha])
   @@index([metodo_principal])
}
```

Ejemplo de upsert atómico dentro de `emitirComprobante` (esqueleto TypeScript):

```ts
// dentro del prisma.$transaction(async (tx) => { ... })
await tx.venta.upsert({
   where: { id_comprobante: comprobanteId },
   update: {
      total: resultado.total,
      fecha: resultado.fecha_emision ?? new Date(),
      metodo_principal: resultado.metodo_principal ?? null,
      estado_pago: resultado.estado_pago ?? 'pendiente',
      metadata: resultado.metadata as Prisma.JsonObject
   },
   create: {
      id_comprobante: comprobanteId,
   Para un equilibrio entre simplicidad y rendimiento recomendamos materializar una entidad `Venta` (tabla) y escribir/actualizarla atómicamente en el flujo de emisión del comprobante (upsert dentro de la transacción de `emitirComprobante`).

   Por qué esta opción:
      fecha: resultado.fecha_emision ?? new Date(),
      total: resultado.total,
      metodo_principal: resultado.metodo_principal ?? null,
      estado_pago: resultado.estado_pago ?? 'pendiente',
      metadata: resultado.metadata as Prisma.JsonObject
   }
})
```

Backfill (esquema rápido)
- Implementar un script que lea comprobantes `EMITIDO` por lotes y haga `upsert` en `venta` para todos los históricos. Ejecutar con prudencia en staging/producción.

Despliegue recomendado en 3 pasos
1. Aplicar la migration de Prisma para crear la tabla `venta` (sin cambiar comportamientos todavía).
2. Desplegar el cambio en `emitirComprobante` que hace el `upsert` (atómico). Como `upsert` es idempotente, reintentos no duplican.
3. Ejecutar el backfill para poblar históricos si lo necesitas.

Pruebas mínimas recomendadas
- Emitir comprobante → `venta` creada (integración).
- Reintento de emisión → no crear duplicados (idempotencia via upsert).
- Anulación/edición de comprobante → `venta` actualizada o marcada como anulada.
- Endpoint resumen (si se implementa) compara resultados con agregación directa a `comprobante` (sanity check).

Notas operativas
- Si guardas pagos parciales, considera una tabla `venta_pago` asociada para normalizar múltiples pagos; para MVP puedes usar `venta.metadata.pagos`.
- Añade logs y métricas para monitorear fallos al crear/actualizar `venta` (latencia, errores).
- Indexa las columnas usadas en filtros y KPIs (`fecha`, `metodo_principal`).

---

Siguientes pasos sugeridos (priorizados)
1. Crear el archivo `src/app/dashboard/ventas/page.tsx` que consuma `GET /api/facturacion/comprobantes?date=` y renderice tarjetas y tabla. (Mínimo viable)
2. Crear endpoint `POST /api/ventas/pagos` que añada/edite registro de pago (esqueleto funcional).
3. Añadir modal "Marcar pago" y enlazar con el endpoint.
4. Añadir tests básicos para API y UI.

---

Si quieres, implemento el MVP (1–3) ahora: crear la página, el endpoint esqueleto y la UI básica que permita filtrar por fecha y marcar un pago en memoria (sin persistir) para validar la UX. ¿Procedo con la implementación ahora o prefieres ajustar la especificación?