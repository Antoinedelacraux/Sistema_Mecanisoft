# Especificación: Plantillas prioritarias de reportes

Este archivo describe las 3 plantillas prioritarias sugeridas para el MVP: Ventas — Resumen, Órdenes por estado, e Inventario — Productos con stock bajo. Para cada plantilla incluyo: objetivo, filtros, columnas, SQL de ejemplo, notas de export y consideraciones de UI.

---

## 1) Ventas — Resumen

Objetivo
- Proveer un resumen agregable de ventas por periodo (día/semana/mes), con totales y conteos para análisis rápido y comparativas.

Filtros comunes
- fecha_inicio (required)
- fecha_fin (required)
- sucursal_id (opcional)
- vendedor_id (opcional)
- cliente_id (opcional)
- forma_pago (opcional)
- agrupar_por: ['dia','semana','mes','producto','vendedor'] (opcional)

Columnas (tabla / export)
- fecha (día/periodo según `agrupar_por`)
- cantidad_ventas
- total_bruto
- total_descuentos
- total_impuestos
- total_neto (total_bruto - descuentos + impuestos)
- ticket_promedio (total_neto / cantidad_ventas)
- sucursal
- vendedor

SQL ejemplo (Postgres)
```sql
SELECT
  date_trunc('day', v.fecha) AS dia,
  count(*) as cantidad_ventas,
  sum(v.total_bruto) as total_bruto,
  sum(v.descuento) as total_descuentos,
  sum(v.impuesto) as total_impuestos,
  sum(v.total_neto) as total_neto
FROM ventas v
WHERE v.fecha BETWEEN $1 AND $2
  AND ($3::int IS NULL OR v.sucursal_id = $3)
  AND ($4::int IS NULL OR v.vendedor_id = $4)
GROUP BY dia
ORDER BY dia
```

Visualización
- Tabla paginada (orden por fecha)
- Gráfico de líneas o barras (serie de `dia` vs `total_neto`)
- KPIs superiores: Total Neto, Ventas (cantidad), Ticket Promedio

Notas de export
- CSV: export plano con columnas anteriores.
- Excel: incluir fila de totales y formato de moneda.
- PDF: formato resumen con gráfico y tabla (paginación si muchas filas).

Consideraciones de rendimiento
- Indexar `ventas(fecha)`, `ventas(sucursal_id)`, `ventas(vendedor_id)`.
- Para periodos largos, encolar export (worker) si el row count o tiempo esperado excede umbral (ej. 30s).

---

## 2) Órdenes — Órdenes por estado y tiempos

Objetivo
- Mostrar el estado actual y el rendimiento (duraciones) de las órdenes de trabajo para gestión operativa.

Filtros
- fecha_inicio / fecha_fin (por fecha de creación o cierre)
- estado (abierta, en_progreso, cerrada, cancelada)
- trabajador_id (opcional)
- tipo_servicio_id (opcional)
- sucursal_id (opcional)

Columnas (tabla / export)
- id_orden
- estado
- fecha_creacion
- fecha_cierre (nullable)
- duracion_minutos (si cerrado) — calculado
- trabajador_asignado
- cliente
- total

SQL ejemplo (duración y agrupado por estado)
```sql
SELECT
  o.estado,
  count(*) as cantidad,
  avg(extract(epoch from (o.fecha_cierre - o.fecha_creacion))/60) as duracion_promedio_minutos,
  sum(o.total) as total
FROM ordenes o
WHERE o.fecha_creacion BETWEEN $1 AND $2
  AND ($3::int IS NULL OR o.trabajador_id = $3)
GROUP BY o.estado
ORDER BY cantidad DESC
```

Visualización
- Tabla con listado de órdenes (detallado)
- Gráfico tipo barra por estado (cantidad)
- Histograma o boxplot de duraciones por tipo de servicio o trabajador (Fase 2)

Notas de export
- Excel: incluir columnas detalladas por orden (una fila por orden), sheet adicional con agregados por estado.
- PDF: resumen + top N órdenes lentas.

Consideraciones
- Calcular `duracion` en la consulta; tener cuidado con `NULL` para órdenes abiertas.
- Indexar `ordenes(fecha_creacion)`, `ordenes(trabajador_id)`, `ordenes(estado)`.

---

## 3) Inventario — Productos con stock bajo

Objetivo
- Identificar productos que están por debajo del stock mínimo para reponer.

Filtros
- almacen_id (opcional)
- categoria_id (opcional)
- umbral_por_defecto (si se quiere filtrar con un umbral global)

Columnas (tabla / export)
- producto_id
- sku
- nombre_producto
- categoria
- stock_actual
- stock_minimo
- diferencia (stock_actual - stock_minimo)
- costo_unitario
- valor_total_stock (stock_actual * costo_unitario)

SQL ejemplo
```sql
SELECT p.id as producto_id, p.sku, p.nombre as nombre_producto, c.nombre as categoria,
  COALESCE(s.stock, 0) as stock_actual, p.stock_minimo,
  (COALESCE(s.stock,0) - p.stock_minimo) as diferencia,
  p.costo_unitario,
  COALESCE(s.stock, 0) * p.costo_unitario as valor_total_stock
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN (
  SELECT producto_id, sum(cantidad) as stock
  FROM inventario_movimientos
  WHERE almacen_id = $1 OR $1 IS NULL
  GROUP BY producto_id
) s ON s.producto_id = p.id
WHERE (COALESCE(s.stock,0) - p.stock_minimo) <= $2 -- $2 = umbral (0 para mostrar <= stock_minimo)
ORDER BY diferencia ASC
```

Visualización
- Tabla ordenada por diferencia ascendente (los más críticos arriba)
- Opcional: mapa/tabla por almacén si hay múltiples ubicaciones

Notas de export
- Excel: incluir columnas de costo y valor total; sheet adicional con resumen por categoría/almacén.
- PDF: lista con acciones sugeridas (reordenar) + totales por categoría.

Consideraciones
- Mantener consistencia en cálculo de `stock_actual` (usar la misma vista/servicio que usan otras funciones del sistema).
- Indexar `inventario_movimientos(producto_id, almacen_id)`.

---

## Formatos y outputs comunes
- CSV: export rápido para análisis en herramientas externas.
- Excel (.xlsx): formato preferido por contabilidad/gerencia (totales, estilos, filtros aplicados, sheets adicionales).
- PDF: reportes formateados listos para presentar (header/footer corporativo, logo, paginação).

Export recomendado por tamaño
- < 1000 filas: generar en request sin encolado.
- > 1000 filas o consultas complejas: encolar job y notificar cuando esté listo.

---

## Nota sobre parámetros y validación
- Para cada plantilla hay que declarar explícitamente parámetros permitidos y sus tipos (date, int, string, enum) en el backend.
- Rechazar/normalizar parámetros inesperados o inyectados.
- Implementar límites: máximo rango de días por defecto (ej. 365) salvo permiso especial.

---

## Siguientes pasos sugeridos (automáticos que puedo generar ahora)
- Crear `src/lib/reportes/ventasResumen.ts` con la consulta parametrizada y helpers para export.
- Generar endpoint esqueleto `src/app/api/reportes/generate` que soporte `key` y `params` y devuelva preview o encole export.
- Crear UI scaffold `src/app/reportes/ventas-resumen/page.tsx` con filtros y preview (tabla).

Si quieres que genere alguno o todos los artefactos anteriores (archivo, endpoint o scaffold), dime cuál y lo creo ahora.