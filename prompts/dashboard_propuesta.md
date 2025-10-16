Propuesta de implementación — Módulo Dashboard (nivel intermedio)

Resumen
-------
Esta propuesta describe una implementación de nivel intermedio para el módulo "Dashboard" en el sistema Taller MecaniSoft. El objetivo es entregar un panel útil para operadores y gerencia con KPIs, gráficos y filtros reutilizables que puedan extenderse a Reportes y Analytics.

Alcance MVP
-----------
KPIs (widgets rápidos):
- Ventas hoy (importe total y número de comprobantes)
- Ventas mes (importe total, comparación % vs mes anterior)
- Órdenes abiertas (cantidad y lista de las más urgentes)
- Stock bajo (número de productos por debajo del stock mínimo y lista resumida)
- Ticket promedio (promedio de ventas por comprobante en el periodo seleccionado)

Gráficos (series / tendencias):
- Ventas por día (últimos 30 días) — gráfico de líneas
- Ventas por método de pago (pastel o barras) — último mes
- Top 10 productos por ventas (barras) — periodo seleccionable

Filtros y control de fecha:
- Rango de fechas predefinidos (Hoy, Últimos 7 días, Últimos 30 días, Mes actual, Personalizado)
- Filtros opcionales: Sucursal/Almacén, Usuario/Trabajador, Tipo de comprobante (BOLETA/FACTURA), Categoría de producto
- Persistir filtros en query string para enlaces y compartición rápida

API / Servicios
---------------
- `GET /api/dashboard/kpis?from=yyyy-mm-dd&to=yyyy-mm-dd&almacen=&usuario=`
  - Retorna valores para los KPIs y pequeñas listas (por ejemplo, top 5 órdenes abiertas)
- `GET /api/dashboard/ventas-series?from=&to=&granularity=day|week|month`
  - Retorna series de ventas agregadas para gráficos
- `GET /api/dashboard/top-productos?from=&to=&limit=10&categoria=`
  - Retorna top productos por cantidad/importe

Implementación backend
----------------------
- Ubicación: `src/lib/dashboard.ts` (servicios de agregación) y `src/app/api/dashboard/*` (endpoints si se prefieren API routes).
- Implementar consultas Prisma optimizadas:
  - Usar `groupBy` o `aggregate` para ventas por día y ticket promedio.
  - Indexar `transaccion.fecha`, `detalle_transaccion.id_producto`, `inventario.stock` si no existe.
  - Para grandes tablas, limitar la ventana temporal y usar paginación para listas recuperadas.
- Cache (opcional): cachear KPIs por 30–60s en memoria con `lru-cache` o usar Redis si está disponible.

Interfaz / Frontend
-------------------
- Página server component: `src/app/dashboard/page.tsx` (hace server-side fetch a los servicios y pasa props) para mejorar SEO y tiempo hasta contenido útil. UI cliente para filtros (client component) `src/components/dashboard/Filters.tsx`.
- Widgets (componentes UI) en `src/components/dashboard/`:
  - `KpiCard.tsx` (reutilizable): título, valor principal, delta (%), icono y pequeño sparkline opcional
  - `LineChart.tsx`, `BarChart.tsx`, `PieChart.tsx` (wrappers que usan Chart.js o Recharts)
  - `OrdersList.tsx` (lista compacta de órdenes abiertas)
  - `LowStockList.tsx` (lista / enlace a inventario)
- Librería de gráficos: preferible `chart.js` (ligero y sin SSR issues) o `recharts`; usar wrappers para aislar la dependencia.
- Manejo de permisos: renderiza el Dashboard solo si `usePermisos().puede('dashboard.ver')` — si no, renderizar fallback o redirección.

UX y detalles
-------------
- Filtros persistentes en Query String: permite compartir un link con los filtros aplicados.
- Estado de carga y skeletons: para KPIs y gráficos usar skeleton placeholders mientras carga la data.
- Mobile: colocar los KPIs en un carrusel o en una columna apilada en mobile.

Alertas (requerido)
------------------
- Productos con bajo stock: alerta visible en el dashboard con el número de SKUs bajo el umbral y link directo a la ficha de inventario o a la acción de crear compra/orden de reposición.
- Cotizaciones vencidas: lista de cotizaciones cuya fecha de vigencia ya pasó (o están próximas a vencer), con acción rápida para reenviar/renovar o convertir a orden.
- Órdenes por hacer / pendientes: contador de órdenes en estado pendiente/por iniciar y una lista de las más urgentes (por prioridad o fecha de entrega esperada).
- Pagos pendientes / facturas sin conciliar: alerta para comprobantes con estado pendiente de pago o conciliación que superen cierto umbral de antigüedad.
- Notificaciones configurables: permitir configurar umbrales (ej. stock mínimo, días para vigencia de cotización) por usuario/rol o por almacén.

Estado de implementación Sprint 1-3:
 ✅ Productos con bajo stock (top críticos y alerta en `getDashboardSummary`).
 ✅ Cotizaciones vencidas con resumen y enlaces.
 ✅ Órdenes pendientes priorizadas por fecha/prioridad.
 ✅ Pagos pendientes con saldo y antigüedad configurable (`alertThresholds`).
 ⏳ Notificaciones configurables: los umbrales están parametrizados en filtros y API, falta UI para ajuste por rol/almacén.
 🔄 Cache/backoff opcionales: recomendado como mejora, sin implementación porque no se detectaron cuellos críticos en Sprint 1-3.
 🔄 Tests de integración end-to-end: planificados para siguiente release (actualmente solo cobertura unit).

  - Reutilizar los servicios de dominio existentes (`src/lib/ordenes`, `src/lib/inventario`, `src/lib/cotizaciones`, `src/lib/ventas`) en lugar de duplicar lógica.
  - Validar los inputs de filtros y paginación en los endpoints del dashboard (fechas, IDs de almacén/usuario) y devolver errores claros con status HTTP apropiados.

- Consistencia y transacciones:
  - Para operaciones que lean múltiples tablas (por ejemplo calcular stock disponible + reservas), usar consultas que garanticen consistencia o ejecutar consultas en una sola transacción de lectura si es necesario.
  - Evitar que una query que agregue datos paralelos haga varias llamadas separadas sin un plan de reintento; usar `prisma.$transaction` cuando combine lecturas que deban ser consistentes entre sí.

- Tolerancia a esquemas parciales:
  - Algunas instalaciones pueden tener migraciones pendientes o tablas parcialmente pobladas. Los endpoints del dashboard deben comportarse de forma tolerante: si una tabla (p.ej. `reserva_inventario`) no existe o está vacía, retornar 0 o una estructura vacía en lugar de un 500; loggear el incidente.

- Rendimiento y límites:
  - Limitar el rango máximo de fechas por petición (ej. 365 días) y ofrecer paginación para listas (órdenes, productos). Documentar y aplicar límites razonables en la API.
  - Implementar cache de short-term para KPIs (30–60s) y considerar pre-aggregaciones nocturnas para series históricas si la carga crece.

- Permisos y seguridad:
  - Verificar permisos en cada endpoint (ej. `dashboard.ver`, `inventario.ver` o `ventas.ver`) y evitar exponer datos sensibles a roles no autorizados.
  - Registrar en la bitácora cuando usuarios con permisos especiales modifiquen thresholds o envíen alertas masivas.

- Manejo de errores y fallbacks:
  - Devolver estructuras parciales con un campo `warnings` cuando algunas sub-queries fallen (ej. problemas con la tabla de pagos), para que la UI muestre lo disponible y el usuario pueda reintentar.
  - Tener un mecanismo de retry con backoff en operaciones no críticas que fallen temporalmente.

- Tests y validación por módulo:
  - Asegurar que cada cambio en `src/lib/*` usado por el dashboard tenga cobertura de tests unitarios y contract tests que validen las shape de los resultados.
  - Añadir tests de integración que reproduzcan escenarios comunes: tablas vacías, sin permisos, datos parcialmente migrados, grandes volúmenes de filas.

Verificación tras Sprint 3:
- ✅ Reutilización de dominios: los servicios consultan Prisma directo con validaciones de fechas y rangos (`normalizeFilters`) y respetan límites (365 días).
- ✅ Permisos obligatorios (`dashboard.ver`) en todas las rutas nuevas y página server-side.
- ✅ Manejo de errores: API responde 401/403 y 500 con mensajes claros; limpieza de query params via `parseDashboardParams`.
- ✅ Tests unitarios añadidos (`tests/lib/dashboard.test.ts`) cubriendo agregaciones y nuevas métricas.
- 🔄 Cache/backoff opcionales y pruebas end-to-end se mantienen como próximas acciones.


Tests y calidad
---------------
- Unit tests para `src/lib/dashboard.ts` (jest): comprobar agregaciones con datos mock (happy path + ventana vacía de fechas).
- Tests de integración para `GET /api/dashboard/kpis` (supertest + db mock o sqlite en memoria si es viable).
- E2E opcional con Playwright para validar filtro y estado de KPIs.

Roadmap por sprints (sugerido)
------------------------------
Sprint 1 (1 día):
- Implementar `src/lib/dashboard.ts` con funciones: getKpis, getVentasSeries, getTopProductos.
- Crear `src/app/api/dashboard/kpis` y `ventas-series` que llamen a las funciones.
- Implementar `src/app/dashboard/page.tsx` que renderice KPIs y un gráfico de ventas por día básico.

Sprint 2 (1 día):
- Añadir filtros UI (`Filters.tsx`) y persistencia en query string.
- Agregar KPI "Stock bajo" y lista de órdenes abiertas.
- Añadir tests unitarios para `src/lib/dashboard.ts`.

Sprint 3 (1 día):
- Añadir Top productos, gráfico por método de pago, exportación CSV simple para series.
- Mejorar UI (icones, sparklines) y mobile tweaks.

Extensiones futuras
-------------------
- Pre-aggregations: tablas resumen nocturnas para acelerar queries históricas.
- Integración con alertas: disparar notificaciones cuando stock bajo supera umbral.
- Dashboards multi-sucursal y multi-tenant si aplica.

Entrega y archivos que crearé (si apruebas la propuesta inicial)
----------------------------------------------------------------
- `prompts/dashboard_propuesta.md` (este documento)
- `src/lib/dashboard.ts` (servicios)
- `src/app/api/dashboard/kpis/route.ts`, `ventas-series/route.ts`, `top-productos/route.ts`
- `src/app/dashboard/page.tsx`
- `src/components/dashboard/*` (KpiCard, Filters, LineChart wrapper, OrdersList, LowStockList)
- Tests unitarios en `tests/lib/dashboard.test.ts`

Notas finales
-------------
- La propuesta busca ser práctica: empezar con KPIs y una gráfica para entregar valor rápido. Analytics y Reportes reutilizarán los mismos servicios.
- Si prefieres priorizar gráficos interactivos complejos (zoom, brush, export), elegiremos `apexcharts` o `chart.js` y asignaremos tiempo extra.
