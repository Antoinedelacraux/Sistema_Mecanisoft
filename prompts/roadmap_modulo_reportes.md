# Roadmap: Implementación completa del Módulo de Reportes

Este roadmap cubre todo lo necesario para diseñar, implementar, testear y desplegar un módulo de Reportes profesional en Sistema_Mecanisoft. Incluye fases, dependencias, tareas detalladas, requerimientos infra, migraciones, pruebas, riesgos y criterios de aceptación.

## Resumen ejecutivo
Duración estimada: 7–8 semanas (dependiendo del tamaño del equipo y prioridad).
Objetivo: Entregar un módulo robusto que permita generar, visualizar, exportar y programar reportes (PDF/Excel/CSV) con control de accesos, auditoría y escalabilidad.

## Equipo sugerido y roles
- Product Owner / Stakeholder (1): define plantillas y requisitos.
- Tech Lead (1): diseño de arquitectura y revisión.
- Backend devs (1–2): endpoints, jobs y DB.
- Frontend dev (1): UI/UX, integración y tests E2E.
- QA/Test engineer (1): tests automáticos y E2E.
- DevOps (0.5): cola, workers, storage y despliegue.

## Fase 0 — Discovery & Diseño (3-5 días)
Objetivo: validar alcance, priorizar plantillas, decidir infra y definir contratos.
Tareas:
- Reunión con stakeholders para priorizar 3 plantillas iniciales (ej. Ventas resumen, Órdenes por estado, Inventario bajo stock).
- Definir formatos de export (PDF, XLSX, CSV) y calidad requerida (paginado, logo, header/footer).
- Elegir infra de archivos (S3 vs almacenamiento local) y cola (Redis + BullMQ recomendado).
- Decidir renderer PDF (Puppeteer/Playwright vs HTML-to-PDF library). Recomendación: Puppeteer/Playwright para HTML/CSS completo.
- Especificar KPIs y SLAs (ej. generación < 30s para queries moderados; si > 30s -> encolar).
Entregables:
- Documento de especificaciones y diseño de plantillas (en `prompts/` o Confluence).
- Estimación y priorización del backlog.

## Fase 1 — MVP Backend + UI Preview + Export CSV/XLSX (10–12 días)
Objetivo: endpoints básicos, preview interactivo y export CSV/XLSX.
Tareas backend:
- Crear modelos Prisma básicos: `ReportTemplate`, `ReportAudit`, `ReportSchedule` (migration draft).
- Implementar endpoints:
  - GET `/api/reportes/templates`
  - GET `/api/reportes/template/:key`
  - POST `/api/reportes/generate` (preview, CSV/XLSX sync)
  - POST `/api/reportes/audit` o audit interno en cada endpoint
- Implementar validación y permisos (server-side) para `key` y `params`.
- Implementar helpers para consultas y agregaciones paramétricas (ej. servicio `src/lib/reportes/*`).

Tareas frontend:
- Página `src/app/reportes` con lista de plantillas (tile view).
- Página de plantilla con panel de filtros y preview (tabla paginada); botón export CSV/XLSX.
- Componentes: filtros reutilizables (date range, select de sucursal, select de trabajador), tabla paginada, gráficos básicos con Recharts/Chart.js.

Tareas ops/infra:
- Decidir almacenamiento temporal de archivos (local `public/exports` para MVP).
- Añadir variables de entorno necesarias (EXPORT_PATH, STORAGE_S3_*).

Pruebas:
- Unit tests backend para validación y consultas.
- UI tests para preview (Jest + RTL).

Entregables:
- Endpoints operativos y página de preview.
- Export CSV/XLSX funcional.

## Fase 2 — PDF Rendering y Generación Asíncrona (10–12 días)
Objetivo: implementar generación PDF profesional y encolado para cargas pesadas.
Tareas infra:
- Provisionar Redis para cola (o usar servicio gestionado).
- Añadir BullMQ y worker service (puede ser un script `node worker.js` separado o un proceso en la misma app con manejo de concurrency).
- Definir esquema de almacenamiento de archivos generados (S3 recomendado para producción; local aceptable para desarrollo/MVP).

Tareas backend:
- Implementar job queue para `generateReport` que:
  1. Reciba `key`, `params`, `format`.
  2. Ejecute queries (usar paginación o streaming si tablas grandes).
  3. Renderice HTML y convierta a PDF con Puppeteer/Playwright.
  4. Genere XLSX con `exceljs` cuando aplique.
  5. Suba archivo a storage y registre metadatos en `ReportFiles` o `ReportSchedule`.
  6. Notifique al solicitante (correo o webhook) y registre en `ReportAudit`.
- Implementar endpoint `GET /api/reportes/download/:fileId` que valide permisos y entregue archivo o link.

Tareas frontend:
- UI para generaciones largas: mostrar estado en UI, notificaciones e historial.
- Modal de programación (crear schedule).

Pruebas:
- Integration test del worker (puede mockear storage/DB) para validar output.
- E2E que genera un PDF y valida metadatos básicos.

Entregables:
- Worker de generación y cola operando en staging.
- Descarga segura de archivos.

## Fase 3 — Programación (Schedules), Auditoría y Gestión (5–7 días)
Objetivo: permitir programar envíos automáticos y gestionar programaciones.
Tareas:
- Endpoints CRUD para `ReportSchedule` (crear/editar/activar/desactivar/eliminar).
- UI para gestionar programaciones: lista, editar, pausar/activar.
- Programador que calcule `nextRunAt` y encole jobs a tiempo (o usar cron runner en worker).
- Auditoría completa: registrar en `ReportAudit` cada acción (GENERAR, DESCARGA, PROGRAMAR) con `params`.
- Página de historial / auditoría con filtros.

Pruebas:
- Integration tests para schedules (crear -> job encola -> job ejecuta).

Entregables:
- Programaciones y auditoría funcionando.

## Fase 4 — Harden, Rendimiento, Seguridad, Tests (7–10 días)
Objetivo: endurecer, testear y optimizar para producción.
Tareas:
- Añadir índices DB para consultas frecuentes (revisar consultas slow queries con EXPLAIN).
- Añadir límites/guards en queries (max rows, timeouts).
- Añadir caching para preview (Redis cache por params con TTL corto).
- Tests: cobertura unit/integration + E2E Playwright para flujos críticos.
- Permisos y roles: mapear permisos (`reportes.view`, `reportes.export`, `reportes.schedule`, `reportes.view_audit`) y actualizar seeds.
- Seguridad: validar inputs, sanitizar, proteger endpoints con rate-limits si necesario.
- Logging y monitoreo (Sentry, Prometheus/Grafana para workers/queue sizes).
- Backup & retention policy para archivos generados (ej. mantener 90 días).

Entregables:
- Tests verdes, observabilidad y performance optimizada.

## Fase 5 — Documentación, Formación y Go-live (3–5 días)
Objetivo: preparar al equipo y usuarios para el lanzamiento.
Tareas:
- Documentación técnica (README en `src/lib/reportes`, ejemplos de configuración, variables env).
- Manual de usuario / guía de uso para el reporte.
- Sesión de demo y formación a stakeholders.
- Plan de despliegue y rollback (migración de Prisma y jobs a producción, feature flag si necesario).

## Cronograma propuesto (resumen)
- Semana 1: Discovery + Fase 1 (start)
- Semana 2: Fase 1 (finish) + empezar Fase 2
- Semana 3: Fase 2 (PDF + workers)
- Semana 4: Fase 2 (finish) + Fase 3
- Semana 5: Fase 3 + empezar Fase 4
- Semana 6: Fase 4
- Semana 7: Fase 5 (docs, training, go-live)

Total: ~7 semanas (ajustable)

## Dependencias técnicas y listas de verificación

Infra & servicios
- Redis (cola)
- Storage: S3 preferente (o disco local para MVP)
- Puppeteer/Playwright y headless Chromium soportado en infra (Docker image debe incluir dependencia)
- Email provider (SMTP) o servicio (SendGrid) para envíos programados

Variables de entorno sugeridas
- EXPORT_PATH (local path)
- STORAGE_S3_BUCKET, S3_ACCESS_KEY, S3_SECRET, S3_REGION
- REDIS_URL
- REPORTS_WORKER_CONCURRENCY
- PDF_RENDERER (puppeteer|playwright)

Seguridad
- Validación server-side de `params` y `key`
- Control de acceso por permisos
- Escapar/sanitizar valores interpolados en queries
- Escoger lugares seguros para almacenar archivos (no dejar archivos sensibles accesibles públicamente sin autorización)

Backups y retención
- Política de retención para archivos generados (ej. 90 días)
- Automatizar purge job para eliminar archivos viejos y registros asociados

Testing checklist
- Unit tests para helpers y validación
- Integration tests para endpoints y worker flows (mock S3/Redis)
- E2E Playwright: generar reporte, descargar y validar metadatos

Observabilidad
- Métricas: jobs en cola, tiempo de generación, errores de rendering
- Logs estructurados para tracing (request id, user id, params)
- Alertas: cola acumulada, error ratio en workers

## Migraciones y Backfill
- Crear migration Prisma con `ReportTemplate`, `ReportSchedule`, `ReportAudit`, `ReportFiles`.
- Backfill scripts si hay artefactos históricos a migrar.
- Probar migración en staging antes de producción.

## Plan de despliegue y rollback
- Despliegue por etapas:
  1. Desplegar cambios DB (con migration) en ventana de mantenimiento si necesario.
  2. Desplegar API + worker en staging y validar jobs.
  3. Activar feature flag para reportes y permitir testers validar.
  4. Promover a producción con monitoreo en tiempo real.
- Rollback: revertir deployment y restaurar DB desde backup en caso de fallo crítico (tener snapshot antes de migration en producción).

## Riesgos y mitigaciones
- Consultas pesadas que bloquean DB: Mitigación — encolar, paginar, añadir índices y límites.
- Rendering PDF en infra limitada (memoria): Mitigación — ejecutar workers en instancias con suficiente memoria; usar Chromium en Docker con tunings.
- Archivos grandes: Mitigación — subir a S3 y no servir inline; comprimir si es posible.
- Seguridad / fuga de datos: Mitigación — permisos estrictos, enlaces presigned S3 con expiración, auditoría.

## Criterios de aceptación (detallado)
- Endpoints y UI permiten generar y descargar al menos las 3 plantillas prioritarias.
- Programación genera y envía reportes correctamente (job encola -> worker ejecuta -> archivo enviado / guardado).
- Auditoría registra evento con params reproducibles.
- Permisos aplicados: usuarios sin `reportes.export` no pueden descargar.
- Tests E2E y unit/integration verdes.

---

Si quieres, realizo los siguientes pasos automáticos ahora:
- Generar el migration draft en `prisma/schema.prisma` con las tablas propuestas (`ReportTemplate`, `ReportSchedule`, `ReportAudit`, `ReportFiles`).
- Crear los endpoints esqueleto en `src/app/api/reportes/*` y las páginas base en `src/app/reportes` (UI scaffold).
- Preparar un worker de ejemplo `scripts/report-worker.ts` y un README con instrucciones de despliegue (incluyendo Dockerfile para worker).

Dime cuál de esos pasos quieres que ejecute a continuación y lo hago (aplico cambios y ejecuto un `npx tsc --noEmit` + tests relevantes si lo deseas).