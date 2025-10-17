# Roadmap de implementación — Módulo de Indicadores

Objetivo
--------
Entregar un módulo de Indicadores (Analytics) 100% funcional, fiable y mantenible que cubra los KPIs definidos para el módulo de Mantenimientos (Planificación, Asignación, Seguimiento). Este roadmap es una guía paso a paso: migraciones, instrumentación de datos, APIs, UI, tests, monitorización y plan de despliegue.

Principios de diseño
--------------------
- Medible: cada KPI debe tener una fuente de verdad (tabla/columna).
- Reproducible: ejemplos de datos (seeds) y tests automatizados.
- Performante: cálculos pesados deben pre-agregarse/ejecutarse en jobs y cachearse.
- Observabilidad: logs y métricas para detectar desviaciones y regresiones.

Ramas y entregables
-------------------
- Rama principal: `main` (estable)
- Feature branches: `feat/indicadores/<subtask>` (una por endpoint/migración/widget)
- Pull Request: incluir tests, migraciones y descripción del cambio.

Fase 0 — Preparación (1 día)
----------------------------
- Revisar y mapear tablas existentes (`ordenes`, `comprobantes`, `inventario_producto`, `trabajadores`, `tareas`).
- Acordar SLAs y objetivos (ej: Coverage target 80%, On-schedule target 90%).
- Crear PR inicial con la propuesta (ya tenemos `prompts/modulo-mantenimientos-indicadores.md`).

Fase 1 — Instrumentación y migraciones (1–2 días)
-------------------------------------------------
Objetivo: garantizar que la base de datos contiene los campos y tablas necesarios para calcular KPIs de forma fiable.

Tareas:
- Añadir campos mínimos (migraciones Prisma/SQL):
  - `ordenes.fecha_cierre` (timestamptz NULL)
  - `mantenimientos.fecha_programada` (if separate table)
  - `inventario_producto.es_critico` boolean DEFAULT false
  - `trabajos.fecha_inicio`, `trabajos.fecha_fin`, `trabajos.id_trabajador`
- Añadir tablas de historial:
  - `orden_historial` (orden_id, old_status, new_status, nota, created_at, changed_by)
  - `mantenimiento_historial` (mantenimiento_id, old_fecha, new_fecha, reason, created_at, changed_by)
- Añadir tabla de feedback:
  - `feedback(id, orden_id, score INT, comentario TEXT, creado_en timestamptz)`
- Añadir índices para consultas de fechas y joins (p. ej. `idx_orden_fecha_cierre`, `idx_mantenimiento_fecha_programada`).

Validación:
- Crear small seed con 50–100 registros representativos (órdenes abiertas, reprogramadas, técnicos, repuestos críticos).

Fase 2 — Servicios/Agregaciones (1–2 días)
-----------------------------------------
Objetivo: implementar funciones/servicios que calculen las agregaciones necesarias. Reusar patrones de `src/lib/dashboard.ts`.

Tareas:
- Crear `src/lib/indicadores/mantenimientos.ts` con funciones:
  - `getCoverage(from,to)`
  - `getOnSchedule(from,to,windowDays)`
  - `getTechnicianUtilization(from,to)`
  - `getOnTimeClose(from,to, slaMapping?)`
- Implementación:
  - Prefer Prisma query builders; cuando sea necesario, usar `prisma.$queryRaw` con casting seguro.
  - Agregar tipos en `src/types/dashboard.ts` o `src/types/indicadores.ts`.

Tests:
- Tests unitarios y de integración que llamen las funciones con la seed.

Fase 3 — Endpoints API (1 día)
-------------------------------
Objetivo: exponer las agregaciones via API REST/Route handlers.

Tareas:
- Crear rutas en `src/app/api/indicadores/`:
  - `coverage/route.ts` -> `GET` params `from,to`
  - `on-schedule/route.ts` -> `GET` params `from,to,windowDays`
  - `technician-utilization/route.ts` -> `GET`
  - `on-time-close/route.ts` -> `GET` params `from,to`
- Seguridad: permisos `indicadores.ver` o `mantenimientos.ver`.
- Validación input: zod/validators to parse dates and windowDays.

Fase 4 — UI Widgets MVP (1–2 días)
---------------------------------
Objetivo: mostrar widgets server-side que consuman las APIs y se rendericen rápido.

Tareas:
- Crear componentes en `src/components/indicadores/`: `kpi-card.tsx`, `line-chart.tsx`, `heatmap.tsx`, `donut-chart.tsx`.
- Crear server components en `src/app/dashboard/indicadores/` o `src/app/mantenimientos/` que llamen a los endpoints y rendericen.
- Integrar con el layout del dashboard y añadir filtros (rango, técnico, almacen).

Fase 5 — Jobs y cache (1 día)
-----------------------------
Objetivo: evitar cálculos pesados en cada request.

Tareas:
- Implementar un job nocturno (script en `prisma/` o `/scripts`) que calcule y persista resúmenes en `dashboard_mantenimientos_resumen(from,to,...)` o en Redis.
- Endpoints deben poder devolver cache si existe y recalcular si se solicita `force=true`.
- Script disponible: `npm run indicadores:warm-cache` precarga los cuatro KPIs en la tabla `indicador_cache` (acepta rango, ventana, TTL, lista de indicadores y SLA personalizados).

Fase 6 — Tests y CI (1 día)
---------------------------
Objetivo: asegurar que el módulo se prueba y no rompe en PRs.

Tareas:
- Tests unitarios (Jest) para cada agregación.
- Tests de integración que usen seed + `tsx prisma/clean-test-data.ts`.
- Agregar step a CI (GitHub Actions) para correr `npx jest --runInBand` y `npx tsc --noEmit`.

Fase 7 — Observabilidad y alertas (1 día)
-----------------------------------------
Objetivo: añadir monitorización y alertas para detectar fallos y desviaciones a tiempo.

Tareas:
- Logs en endpoints y jobs (winston/pino o consola estructurada).
- Métricas básicas: duración de consultas, count de errores por endpoint (exponer /metrics si aplica).
- Sistema de alertas: threshold-driven alerts (coverage < 60% -> send email/Slack). Reutilizar `src/lib/mailer.ts`.

Fase 8 — Despliegue y verificación (0.5 día)
-------------------------------------------
Objetivo: desplegar a staging y verificar con datos reales.

Tareas:
- Deploy a staging, ejecutar migrations y seed si procede.
- Ejecutar smoke tests (dashboard pages, widgets, endpoints).
- Validación con stakeholders: revisar KPIs y ajustar SLAs/umbrales.

Rollback plan
-------------
- Si una migración causa problemas, revertir la migración y restaurar la base de datos desde backup.
- Desactivar el job nocturno y servir datos en modo 'live' temporalmente.

Checklist de aceptación
-----------------------
- [ ] Migraciones aplicadas sin errores en staging
- [ ] Seeds poblados y tests unitarios/integración verdes
- [ ] Endpoints implementados y protegidos por permisos
- [ ] Widgets renderizando datos correctos en staging
- [ ] Jobs nocturnos corriendo y resúmenes persisten
- [ ] Alertas configuradas y validadas (simulaciones)

Entregables finales
-------------------
- Migraciones SQL/Prisma
- Seeds y tests (Jest)
- `src/lib/indicadores/*` con implementaciones y tipos
- `src/app/api/indicadores/*` endpoints
- UI widgets en `src/components/indicadores/*` y `src/app/dashboard` (server components)
- Jobs y scripts de cache
- Documentación en `prompts/modulo-mantenimientos-indicadores.md` y `prompts/roadmap-indicadores.md`

Próximos pasos inmediatos
------------------------
1. Confirmas si quieres que empiece con la Fase 1 (migraciones + seed) o con Fase 2 (servicios) directamente.
2. Abriré feature branches y empezaré a trabajar por tareas pequeñas (uno o dos PRs simultáneos). 

---
Document preparado. Puedo empezar la Fase que elijas y actualizar la todo-list en consecuencia.