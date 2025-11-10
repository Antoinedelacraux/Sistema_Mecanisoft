# MecaniSoft – Sistema de Gestión de Taller

Aplicación web construida con **Next.js 15**, **TypeScript** y **Prisma** para gestionar clientes, vehículos, órdenes de trabajo, inventario y facturación de un taller mecánico. Incluye indicadores operativos, manejo de permisos por rol, seeds de datos realistas y soporte para despliegue vía Docker.

## ⚡️ Puntos clave
- Arquitectura App Router (Next.js) con componentes shadcn UI.
- Autenticación con NextAuth y permisos granulares (roles y asignaciones manuales).
- Integración con PostgreSQL mediante Prisma ORM.
- Scripts para poblar datos base y dataset de demostración completo.
- KPIs de mantenimiento con caché y visualizaciones (line chart, donut, heatmap).
- Soporte de despliegue local y por contenedor (`docker compose`).

## 🚀 Primeros pasos (entorno local)

1. Instala dependencias:
   ```powershell
   npm install
   ```
2. Configura `.env` con al menos:
   ```env
   DATABASE_URL="postgresql://USER:PASS@localhost:5432/taller_mecanico?schema=public"
   NEXTAUTH_SECRET="clave-aleatoria"
   NEXTAUTH_URL="http://localhost:3000"
   REDIS_URL="redis://localhost:6379"
   SMTP_HOST="smtp.test.local"
   SMTP_PORT="587"
   SMTP_USER="notificaciones@test.local"
   SMTP_PASS="cambia-esto"
   INVENTARIO_ALERT_RECIPIENTS="operaciones@test.local"
   FACTURACION_HABILITADA="false" # Actívalo en despliegues listos para emitir
   FACTURACION_API_URL="https://facturacion.tu-servicio/api"
   FACTURACION_API_TOKEN="token-proveedor"
   FACTURACION_EMISOR_RUC="20123456789"
   ```
3. Inicializa la base:
   ```powershell
   npx prisma migrate reset --force
   npm run seed
   npx tsx scripts/create-admin-user.ts
   # Opcional: dataset de demo completo
   npx tsx scripts/seed-sample-data.ts
   ```
4. Levanta el servidor de desarrollo:
   ```powershell
   npm run dev
   ```
5. Abre `http://localhost:3000` y accede con las credenciales demo (`admin.pruebas` / `Admin123!`).

## 🐳 Levantar con Docker

Incluimos `Dockerfile`, `.dockerignore` y `docker-compose.yml`. Con Docker Desktop activo:

```powershell
docker compose up --build
```

Esto levanta PostgreSQL + app, aplica migraciones y ejecuta `npm run seed`. Para cargar datos de demo dentro del contenedor:

```powershell
docker compose exec web npx tsx scripts/seed-sample-data.ts
```

Más detalles y comandos en `manuales/manual_docker.md`.

## ☁️ Despliegue rápido en Vercel

Resumen express (consulta `manuales/manual_vercel.md` para el paso a paso completo):

Live demo (instancia pública): https://sistema-mecanisoft-z2td.vercel.app/

1. Provisión de base de datos administrada (Neon/Supabase/Railway) y exporta su `DATABASE_URL`.
2. Ejecuta migraciones apuntando al remoto:
   ```powershell
   $env:DATABASE_URL="postgresql://..."
   npx prisma migrate deploy
   npm run seed
   ```
3. Configura las variables `DATABASE_URL`, `NEXTAUTH_SECRET` y `NEXTAUTH_URL` en Vercel.
4. Despliega:
   ```powershell
   vercel --prod
   ```

El archivo `vercel.json` y el script `postinstall` (`prisma generate`) ya están preparados para la plataforma.

## 📚 Documentación adicional

- `manuales/manual_instalacion.md`: guía paso a paso para preparar el entorno, ejecutar seeds y resolver problemas comunes.
- `manuales/manual_docker.md`: instrucciones detalladas para levantar y administrar el proyecto con Docker (`docker compose`).
- `manuales/manual_vercel.md`: procedimiento para desplegar en Vercel con una base PostgreSQL administrada.

## 🔗 Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` | Build de producción |
| `npm run seed` | Datos base (roles, permisos, catálogos) |
| `npx tsx scripts/seed-sample-data.ts` | Dataset de demostración integral |
| `npm run indicadores:warm-cache` | Precálculo de KPIs de mantenimiento |
| `npm run verify` | Lint + typecheck + pruebas críticas |
| `npm run usuarios:worker` | Worker BullMQ para reprocesar credenciales pendientes |
| `npm run usuarios:scheduler` | Agenda el reproceso periódico de credenciales |
| `npm run inventario:worker` | Worker BullMQ para liberar reservas caducadas y alertas de stock |
| `npm run inventario:scheduler` | Agenda liberación de reservas y notificaciones de inventario |
| `npm run ordenes:worker` | Worker BullMQ para alertas de tareas pausadas |
| `npm run ordenes:scheduler` | Agenda el escaneo periódico de tareas en pausa |

## 🛠️ Infraestructura requerida

- **Redis**: usado para rate limiting, cuotas de subida y cola de reportes/alertas. Los workers validan la conexión al iniciar; habilita `REDIS_USE_MOCK=true` únicamente en entornos locales de prueba.
- **SMTP**: obligatorio en producción; sin `SMTP_HOST` configurado los correos fallan (no se crean cuentas temporales). Define `SMTP_*` en `.env` o en tu gestor de secretos.
- **S3 (opcional)**: si `S3_BUCKET` está definido se intentará validar credenciales y bucket (usa `S3_VERIFY=true` para obligar la verificación en staging). De lo contrario los reportes se almacenan en `public/exports`.
- **Alertas de inventario**: configura `INVENTARIO_ALERT_RECIPIENTS` con uno o más correos separados por coma para recibir los avisos encolados desde `/api/inventario/alertas/cron`.
- **Reservas de inventario**: `INVENTARIO_RESERVA_TTL_HOURS` (default 48) define cuándo caduca una reserva pendiente; `INVENTARIO_RESERVA_RELEASE_LIMIT` controla el lote máximo por job y `INVENTARIO_RESERVA_CRON`/`INVENTARIO_ALERT_CRON` permiten ajustar la frecuencia del scheduler. Usa `INVENTARIO_ALERT_SLACK_WEBHOOK` para notificaciones en Slack y `INVENTARIO_ALERT_FORCE=true` si quieres alertar incluso sin críticos.
- **Tareas pausadas**: `TAREAS_PAUSADAS_THRESHOLD_HOURS` (default 12) y `TAREAS_PAUSADAS_ALERT_LIMIT` personalizan el job; define `TAREAS_ALERT_RECIPIENTS` y opcionalmente `TAREAS_ALERT_SLACK_WEBHOOK` para correos/Slack. Ajusta la frecuencia con `TAREAS_ALERT_CRON`.
- **Indicadores**: el endpoint `/api/indicadores/recalcular` fuerza el cache de KPIs; puedes exponerlo en un panel admin y documentar `ForceRecalcButton` en el dashboard para ejecuciones manuales.
- **Reenvío de credenciales**: BullMQ agenda jobs con `npm run usuarios:scheduler`; ajusta `USUARIOS_CREDENCIALES_CRON`, `USUARIOS_CREDENCIALES_LIMIT`, `USUARIOS_SYSTEM_USER_ID`, `USUARIOS_CREDENCIALES_ASUNTO` y `USUARIOS_CREDENCIALES_MENSAJE_AUTO`. En entornos sin Redis establece `REDIS_FALLBACK_DIRECT=true` para ejecutar el reproceso inmediato.

## ✅ Checklist rápida antes de entregar

- [ ] `.env` configurado (al menos `DATABASE_URL`, `NEXTAUTH_SECRET`).
- [ ] Migraciones ejecutadas (`npx prisma migrate deploy`).
- [ ] Seeds básicos aplicados (`npm run seed`).
- [ ] Usuario admin generado (`npx tsx scripts/create-admin-user.ts`).
- [ ] Datos demo cargados si aplica (`npx tsx scripts/seed-sample-data.ts`).
- [ ] `npm run verify` ejecutado sin errores.
- [ ] Servidor funcionando (`npm run dev` o `docker compose up`).

## 🧰 Órdenes de trabajo

- Los servicios de orden (`src/lib/ordenes/crear.ts` y `src/lib/ordenes/actualizar.ts`) utilizan validaciones con [Zod](https://zod.dev). El esquema `actualizarOrdenSchema` asegura que cualquier actualización incluya identificadores válidos, estados permitidos y montos positivos.
- Las pruebas unitarias de estos servicios viven en `tests/lib/ordenes/crearOrden.test.ts` y `tests/lib/ordenes/actualizarOrden.test.ts`, donde se mockean las dependencias de Prisma e inventario.
- Para ejecutar únicamente esta batería puedes usar:

```powershell
npx jest tests/lib/ordenes
```

## Permisos y verificación rápida

- El seed (`npm run seed`) ahora crea también los permisos `servicios.*`, `cotizaciones.*`, `tareas.*` y `reportes.ver`. Después de reseed recuerda volver a iniciar sesión para que la sesión consuma los permisos actualizados.
- Agregamos un set de pruebas enfocadas en los guardas de permisos:
   - API servicios: `tests/api/serviciosApi.test.ts` y `tests/api/serviciosIdApi.test.ts`
   - API reportes de inventario: `tests/api/inventarioReportesApi.test.ts`
   - UI `ServiciosTable`: `tests/ui/serviciosTable.test.tsx`

Para ejecutar todas ellas en bloque:

```powershell
npx jest tests/api/serviciosApi.test.ts tests/api/serviciosIdApi.test.ts tests/api/inventarioReportesApi.test.ts tests/ui/serviciosTable.test.tsx
```

## Problema común en Windows: bloqueo de Prisma

En sistemas Windows es posible que `npx prisma generate` falle con un error EPERM al renombrar archivos temporales del cliente Prisma (`query_engine-windows.dll.node.tmp`). Para mitigarlo hemos añadido un script de ayuda:

```powershell
$env:DATABASE_URL = 'postgresql://user:pass@localhost:5432/tu_bd'
npm run prisma:fix-locks
```

El script eliminará archivos `*.tmp` en `node_modules/.prisma/client` y volverá a ejecutar `npx prisma generate`. Si el problema persiste, cierra procesos `node`/VSCode y ejecuta `takeown` / `icacls` como sugiere el script.


## Script DX `npm run verify`

Se añadió un script de verificación básica que encadena linting, chequeo de tipos y el paquete de pruebas anteriores:

```powershell
npm run verify
```

Internamente ejecuta:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:critical`

⚠️ El chequeo de tipos (`tsc --noEmit`) expone deuda técnica previa (principalmente sesiones opcionales) y hoy rompe la cadena. Mantuvimos ese comportamiento para visibilizar los pendientes; corrige los errores reportados antes de abrir PRs.

## Módulo de indicadores (MVP)

- Al ejecutar `npm run seed:indicadores` se genera un dataset sintético (~100 registros) con órdenes demo, mantenimientos reprogramados, técnicos y repuestos críticos para validar los KPIs.
- Los indicadores viven en `src/lib/indicadores/mantenimientos.ts`; hay endpoints REST bajo `/api/indicadores/*` protegidos por los permisos `indicadores.ver` o `mantenimientos.ver`.
- La vista `/dashboard/indicadores` consume directamente esos servicios en el servidor e incluye cards KPI, donut por prioridad y heatmap de utilización.
- Pruebas unitarias en `tests/lib/indicadores/mantenimientos.test.ts` cubren cálculos principales (coverage, on-schedule, utilización y cierre en SLA).
- Puedes precargar el cache de KPIs con `npm run indicadores:warm-cache`. Acepta flags opcionales (`--from`, `--to`, `--window-days`, `--ttl-hours`, `--indicators`, `--sla`) y, por defecto, recalcula los últimos 30 días con `force=true`.
