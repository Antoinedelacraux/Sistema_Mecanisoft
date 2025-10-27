# Módulo Reportes — Guía rápida

Este documento describe cómo ejecutar y depurar el módulo de Reportes localmente y en CI.

Requisitos
- Node.js 18+ (preferible Node 20)
- Docker (para correr Redis localmente) — opcional si usas el modo fallback directo

Comandos útiles

Levantar Redis (Docker Compose):
```powershell
npm run redis:up
# bajar
npm run redis:down
```

Scripts de ayuda para reportes
```powershell
# Ejecutar worker (cola)
npm run report:worker

# Ejecutar scheduler (registra repeatable jobs)
npm run report:scheduler

# Encolar un job de prueba (usa Redis si está configurado, o llamará al processor directamente si REDIS_USE_MOCK=true)
npm run report:enqueue
```

Modo sin Redis (fallback directo)
Si no tienes Redis disponible localmente puedes ejecutar el scheduler o enqueue en modo fallback:
```powershell
$env:REDIS_USE_MOCK='true'; npm run report:scheduler
$env:REDIS_USE_MOCK='true'; npm run report:enqueue
```

Puppeteer / PDFs
- El worker intentará usar Puppeteer para generar PDFs (HTML -> PDF).
- Puppeteer descarga Chromium (~100MB). Ya se agregó `puppeteer` a `package.json` y se instaló en este workspace.
- Si prefieres usar `puppeteer-core` en CI, añade `puppeteer-core` y asegúrate de tener Chromium/Chrome disponible en el runner.

CI
- Se añadió un workflow `Reportes E2E` que arranca Redis como servicio y ejecuta un flujo mínimo: lanza worker + scheduler, encola un job y revisa la generación del archivo. Revisa `/.github/workflows/reportes-e2e.yml`.

Observabilidad
- Hay métricas in-memory accesibles en `GET /api/reportes/metrics` para diagnosticar jobs en ejecución.

Notas de desarrollo
- UI: las páginas de `templates` y `schedules` usan `react-hook-form` + `zod` para validaciones en cliente.
- Para subir archivos a S3 configura `S3_BUCKET` y la librería `src/lib/storage/s3` se usará automáticamente.

Problemas conocidos
- BullMQ requiere un Redis real; `ioredis-mock` no es compatible con BullMQ por el uso de scripts/Lua.
- Para pruebas E2E completas en CI necesitarás un servicio Postgres o mocks; el workflow actual no aplica migraciones en la DB remota.

Contacto
- Si quieres que automatice pruebas E2E completas con DB en CI, puedo añadir un servicio Postgres y pasos para ejecutar migraciones en el workflow.
