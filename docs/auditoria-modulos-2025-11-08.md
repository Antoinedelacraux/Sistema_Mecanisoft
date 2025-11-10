# Auditoría integral de módulos

**Fecha:** 8 de noviembre de 2025  
**Repositorio:** `Sistema_Mecanisoft`

## Metodología
- Revisión estática de código y carpetas en `src/app`, `src/lib`, `tests` y `scripts`.
- Correlación con pruebas automatizadas existentes (`tests/api`, `tests/lib`, `tests/ui`).
- Identificación de patrones repetidos (p. ej. validaciones manuales, generación de códigos) y comparación entre módulos.
- Detección de comentarios, errores controlados y rutas sin cubrir por pruebas para inferir brechas funcionales.

## Resumen ejecutivo
- La arquitectura por dominios (`src/lib/*`) está bien definida, pero varios endpoints todavía implementan lógica de negocio directamente en la ruta, lo que dificulta su reutilización y prueba aislada.
- Existen operaciones críticas (login, generación de códigos correlativos, subida de archivos) sin salvaguardas adicionales; son candidatas a endurecimiento de seguridad antes de una salida a producción.
- Los módulos de reporting, indicadores e inventario cuentan con servicios robustos y pruebas, pero carecen de automatización completa (p. ej. jobs programados, orquestación de colas en todos los entornos).
- La mayoría de los módulos tienen cobertura de pruebas Jest; sin embargo, hay huecos en flujos UI y en validaciones de entrada que hoy dependen de comprobaciones manuales.

## Hallazgos prioritarios
| Módulo | Severidad | Hallazgo | Evidencia | Recomendación |
| --- | --- | --- | --- | --- |
| Autenticación | Alta | No existe rate limiting ni bloqueo por intentos fallidos; los accesos dependen solo de `bcrypt.compare` | `src/lib/auth.ts` | Incorporar contador de intentos fallidos + backoff (Redis o Prisma) y rate limiting por IP/usuario antes de despliegues públicos |
| Cotizaciones / Productos | Alta | La generación de códigos (`COT-YYYY-###`, `PROD-YYYY-###`) es vulnerable a condiciones de carrera; el propio comentario lo documenta | `src/app/api/cotizaciones/route.ts`, `src/app/api/productos/route.ts` | Mover la generación a una transacción con bloqueo (`SELECT ... FOR UPDATE`) o usar secuencias en BD |
| Subida de archivos | Media | El endpoint acepta cualquier imagen y la escribe en disco sin escaneo, ni quotas por usuario | `src/app/api/upload/route.ts` | Añadir validación antivirus (ClamAV o servicio SaaS), límites diarios y limpieza programada |
| Vehículos / Servicios / Productos | Media | Las rutas implementan validaciones manuales inconsistentes en vez de usar Zod (a diferencia de otros dominios) | `src/app/api/vehiculos/route.ts`, `src/app/api/servicios/route.ts`, `src/app/api/productos/route.ts` | Crear esquemas Zod compartidos en `src/lib` y reutilizarlos para mantener coherencia |
| Reportes programados | Media | Los scripts dependen de Redis para BullMQ, pero no existe verificación de conexión en `npm run verify`; fallan silenciosamente en entornos sin Redis | `scripts/report-scheduler.ts`, `src/lib/reportes/workerUtils.ts` | Añadir health check y fallback controlado (ej. modo "direct" documentado) en checklist de despliegue |

## Detalle por módulo

### 1. Autenticación y sesiones (`src/lib/auth.ts`, `src/app/login`)
**Estado actual**
- NextAuth usando `CredentialsProvider` con normalización de usuario, manejo de contraseña temporal y registro en bitácora.
- Sesiones JWT con TTL de 8 horas y carga de permisos a nivel de token.
- Registro exitoso/erróneo mediante `logEvent`, con controles sobre usuarios bloqueados/inactivos.

**Brechas detectadas**
- No hay rate limiting, recuento de intentos ni bloqueo por IP/usuario; un actor puede realizar fuerza bruta ilimitada.
- Sólo se emiten advertencias si `NEXTAUTH_SECRET` falta (no se aborta el inicio del servidor).
- `console.log` expone detalles sensibles (usuario normalizado, estado de bloqueo) en ambientes productivos.
- Sin MFA ni validación de dispositivos/ubicaciones nuevas.

**Recomendaciones**
- Implementar middleware de throttling (Redis/BullMQ o `@upstash/ratelimit`) y bloquear temporalmente tras N intentos fallidos.
- Forzar `NEXTAUTH_SECRET` mediante `process.env` en build (abortar si falta).
- Sustituir `console.log` por logger centralizado (p. ej. Pino) con niveles configurables.
- Evaluar MFA (correo/SMS) y notificaciones de inicio de sesión sospechoso.

### 2. Gestión de usuarios (`src/app/api/usuarios`, `src/components/usuarios`)
**Estado actual**
- Controladores separados para CRUD, envío de credenciales, restablecimiento y toggles (`controllers/*`).
- Uso extensivo de bitácora y banderas como `envio_credenciales_pendiente`, filtrables desde UI.
- Pruebas unitarias y de API (`tests/api/usuarios*.test.ts`).

**Brechas detectadas**
- Varias rutas aplican validaciones ad-hoc; no existe un esquema unificado tipo Zod para payloads (ej. `create-controller.ts`, `update-controller.ts`).
- `envio_credenciales_pendiente` depende de intervención manual; no hay job automatizado para reprocesar pendientes.
- No se hallaron pruebas sobre `notifications-controller.ts` ni el flujo completo de reintentos de correo.
- Los filtros avanzados (por rol, estado, pendientes de envío) sólo viven en UI; falta endpoint consolidado para reportes/exportaciones.

**Recomendaciones**
- Extraer validaciones a `src/lib/usuarios/validators.ts` siguiendo el patrón de órdenes/clientes.
- Crear script o job BullMQ que procese usuarios con `envio_credenciales_pendiente = true`.
- Agregar pruebas sobre `registrarEnvioCredenciales` simulando fallo SMTP (`tests/api/usuariosRoute.test.ts`).
- Exponer endpoint de exportación con los filtros actuales para que reportes puedan reutilizarlo.

### 3. Roles y permisos (`src/lib/permisos`, `src/app/dashboard/permisos`)
**Estado actual**
- Servicios para catálogo, asignación masiva y personalizaciones (`setPermisosDeRol`, `setPermisosPersonalizadosDeUsuario`).
- Guardias reutilizables (`PermisosChecker`, `asegurarPermiso`) y precarga desde sesión NextAuth.
- Amplia cobertura de pruebas en `tests/api/permisos*.test.ts` y `tests/lib/permisos`.

**Brechas detectadas**
- Las funciones de servicio lanzan `Error` genérico cuando faltan permisos solicitados (ej. `assertPermisosEncontrados`), lo que dificulta manejar errores en la capa API.
- No existe cache corto plazo (memoria/Redis) para `listarPermisosPorModulo`, provocando consultas pesadas repetidas.
- Faltan migraciones para revocar permisos obsoletos; la semilla (`prisma/seed.ts`) sólo agrega.

**Recomendaciones**
- Introducir errores específicos (`PermisoNoEncontradoError`) para distinguir problemas de datos.
- Cachear catálogos (TTL 5-10 min) aprovechando que rara vez cambian.
- Añadir script/migración que limpie permisos descontinuados y sincronice módulos.

### 4. Clientes y vehículos (`src/lib/clientes`, `src/app/api/clientes`, `src/app/api/vehiculos`)
**Estado actual**
- Validación sólida de clientes en `validateClientePayload` (mayoría de edad, duplicados, RUC, etc.).
- Endpoints para listar todos los clientes y sólo activos (`clientes/activos/route.ts`).
- Vehículos filtrados por cliente activo y placa única.

**Brechas detectadas**
- Rutas de clientes y vehículos contienen lógica de paginación/búsqueda directamente en el endpoint; no existe servicio en `src/lib/clientes` que encapsule listados.
- En vehículos/POST se aceptan campos clave como `numero_chasis` sin sanitización adicional ni validación formal (`Zod`).
- No hay exportación CSV/Excel para clientes o vehículos, aunque la UI ofrece filtros.
- Cobertura de pruebas para clientes es buena, pero no hay tests específicos de vehículos (`tests/api/vehiculos*.test.ts` no existe).

**Recomendaciones**
- Migrar listados a `src/lib/clientes/service.ts` y `src/lib/vehiculos/service.ts`, permitiendo reutilización futura.
- Crear esquemas Zod para payload de vehículo (tipos, enums).
- Añadir endpoints de exportación (similar a bitácora) y pruebas Jest correspondientes.

### 5. Servicios y catálogos (`src/app/api/servicios`, `src/app/api/categorias`, `src/app/api/productos`)
**Estado actual**
- Endpoints soportan filtros avanzados (estado, marca, stock mínimo) y generan códigos correlativos.
- Bitácora registra altas, ediciones y toggles.
- Hay pruebas para servicios y productos (`tests/api/servicios*.test.ts`, `tests/api/productosApi.test.ts`).

**Brechas detectadas**
- Validaciones manuales replicadas en cada endpoint; faltan utilidades compartidas (`precio_base`, `tiempo_minimo`, etc.).
- Condición de carrera en la generación de códigos (`generateCodigoProducto`, `generateCodigoServicio` dentro de `POST` de servicios).
- Filtro de stock bajo se ejecuta en memoria, lo que puede degradarse con catálogos grandes.

**Recomendaciones**
- Refactorizar a validadores compartidos en `src/lib/catalogos` y reutilizar en tests.
- Mover generación de código a transacción en BD o usar campo `codigo` con default en Postgres.
- Para stock bajo, considerar vista materializada/consulta SQL (`WHERE stock <= stock_minimo`) mediante `prisma.$queryRaw`.

### 6. Inventario (`src/lib/inventario`, `src/app/api/inventario/*`)
**Estado actual**
- Servicios transaccionales (`registrarIngreso`, `registrarSalida`, `reservarStockEnTx`) con `InventarioError` tipado.
- Sincronización de stock (`syncProductoStock`) y bitácora de movimientos.
- Alertas de stock crítico y reportes consolidados (`obtenerResumenInventario`).
- Cobertura amplia de tests (`tests/api/inventario*.test.ts`, `tests/lib/inventario`).

**Brechas detectadas**
- `alertas/cron` requiere sesión estándar; no valida rol/permisos específicos para ejecutar cron.
- El pipeline de alertas sólo entrega JSON; no se encontró job que envíe notificaciones (correo, Slack) pese a `generarAlertasStockMinimo`.
- Los scripts no documentan tiempos de ejecución ni cleanup de reservas caducadas.

**Recomendaciones**
- Limitar la ruta de cron a un permiso dedicado (p. ej. `inventario.alertas` o header interno).
- Implementar notificaciones (reutilizar `lib/mailer` o BullMQ) y programar job con la cola existente.
- Agregar job/scheduled script que libere reservas expiradas y documentar en `README`.

### 7. Órdenes y tareas (`src/lib/ordenes`, `src/app/api/ordenes`, `src/app/api/tareas`)
**Estado actual**
- Servicios robustos (`crearOrden.ts` de 380+ líneas) manejan reservas de stock, asignaciones de trabajadores y estimaciones de tiempo.
- `actualizarOrden.ts` valida transiciones permitidas, estados de reserva y bitácora.
- Tareas listan con includes extensos y fallback cuando Prisma falla.
- Pruebas en `tests/lib/ordenes` y `tests/api/tareasApi.test.ts`.

**Brechas detectadas**
- `crearOrden.ts` concentra demasiada lógica; difícil de mantener y probar secciones específicas (validaciones, reservas, terceros).
- No existe rutinas automáticas para mover tareas a histórico o limpiar estados “pausado” prolongados.
- UI aún no muestra alertas globales (comentario TODO en `dashboard/ordenes/page.tsx`).

**Recomendaciones**
- Dividir `crearOrden` en submódulos (`validarItems`, `prepararReservas`, `calcularFechas`), facilitando tests unitarios.
- Crear job diario que marque tareas con `estado = pausado` durante >N horas y notifique responsables.
- Completar manejo de toasts globales dentro del dashboard de órdenes.

### 8. Cotizaciones (`src/app/api/cotizaciones`, `src/lib/facturacion/cotizaciones.ts`)
**Estado actual**
- Validación avanzada con Zod (`cotizacionBodySchema`) y control de estado (borrador, aprobada, etc.).
- Tokens de aprobación generados con `crypto.randomBytes`.
- Comentarios en código documentan reintentos para evitar colisiones.

**Brechas detectadas**
- Generación de código sujeta a condiciones de carrera; no se cierra con transacción.
- Falta endpoint público protegido por hash/token para que el cliente final apruebe/rechace la cotización (sólo hay lógica interna).
- No se encontró proceso automático que invalide cotizaciones vencidas (`vigencia_hasta`).

**Recomendaciones**
- Usar `prisma.$transaction` con `SELECT ... FOR UPDATE` o secuencias para códigos.
- Implementar ruta `POST /cotizaciones/approval` que valide `approval_token` y actualice estado.
- Cron job que marque como `vencida` cuando `vigencia_hasta < now()`.

### 9. Facturación y ventas (`src/lib/facturacion/*`, `src/app/api/ventas`)
**Estado actual**
- `prepararOrdenParaFacturacion` asegura orden completada, sin comprobante previo, y calcula totales/IGV.
- Rutas de ventas permiten filtros por método de pago, estado, origen, tipo; registran bitácora.
- Controladores para registrar pagos actualizan método principal y estado de comprobante.

**Brechas detectadas**
- Configuración de facturación (`facturacionConfig`) se consulta globalmente sin cache; cada emisión pega a BD.
- No se valida que facturación esté habilitada/parametrizada antes de preparar orden.
- Falta integración real con servicio SUNAT o similar; los comprobantes quedan sólo en BD (según código revisado).
- No hay reporte de conciliación entre pagos registrados y estado de orden.

**Recomendaciones**
- Cachear configuración (TTL corto) mediante `indicadores/cache` o Redis.
- Validar `config.facturacion_habilitada` y lanzar error explícito si no hay credenciales.
- Documentar/planificar integración con API externa o generador CFDI, extendiendo `facturacion/pdf.ts`.
- Construir reporte de conciliación (`ventasDashboard`) y prueba específica.

### 10. Indicadores y dashboard (`src/lib/indicadores`, `src/lib/dashboard`, `src/app/dashboard/*`)
**Estado actual**
- Cálculos complejos con caching MD5 (`withIndicatorCache`) y normalización de rangos.
  - Ejemplo: KPIs de cobertura, puntualidad, utilización (`mantenimientos.ts`).
- Dashboard server-side (`src/app/dashboard/page.tsx`) obtiene summary, series y top productos en paralelo.
- Hay pruebas en `tests/lib/indicadores` y `tests/lib/dashboard.test.ts`.

**Brechas detectadas**
- `withIndicatorCache` usa Prisma directo; no hay invalidación programática tras movimientos relevantes (orden completada, inventario).
- Dashboard depende de fetch server components; no existe fallback offline ni control de errores detallado.
- No se implementaron endpoints para forzar recalcular (más allá de `force: true` en código).

**Recomendaciones**
- Emitir eventos (BullMQ) cuando orden cambia a `completado` para invalidar caches pertinentes.
- Añadir manejo de errores en dashboard (mostrar skeleton + mensaje) para evitar caídas totales.
- Exponer endpoint/admin action para recalcular KPIs específicos.

### 11. Reportes programados (`src/lib/reportes`, `scripts/report-*.ts`)
**Estado actual**
- Plantillas y schedules en BD (`reportTemplate`, `reportSchedule`), worker capaz de renderizar PDF y enviar correo.
- Fallback a `pdfkit` cuando Puppeteer no está disponible.
- Scripts de soporte (`report-scheduler.ts`, `report-worker.ts`, `purge-old-exports.ts`).

**Brechas detectadas**
- Dependencia fuerte de Redis sin verificación previa; si falla, algunos scripts recurren a ejecución directa silenciosa.
- `sendEmailWithAttachment` genera cuentas de prueba en producción si faltan credenciales SMTP.
- No hay monitoreo de carpeta `public/exports`; el purge depende de ejecución manual o variable `ENABLE_PURGE_SCHEDULE`.
- Falta test end-to-end del pipeline (cola -> worker -> envío correo).

**Recomendaciones**
- Validar conexión Redis/S3 al iniciar scheduler; abortar con mensaje claro.
- En producción, abortar si SMTP no está configurado (no crear cuenta temporal de Nodemailer).
- Automatizar `purge-old-exports` (cron) y documentarlo en checklist de operación.
- Añadir test de integración que simule schedule con `REDIS_FALLBACK_DIRECT=true`.

### 12. Bitácora y auditoría (`src/lib/bitacora`, `src/app/api/bitacora`)
**Estado actual**
- Panel UI con filtros, autocompletado de usuario y exportación CSV (`BitacoraPanel.tsx`).
- Endpoint API soporta paginación y exportación (`export=csv`).
- Registro de eventos presente en módulos críticos (auth, clientes, servicios, etc.).

**Brechas detectadas**
- En API sólo se devuelve `id_usuario`; el panel carece de join para mostrar nombre/correo.
- No hay retención/rotación definida; la tabla puede crecer sin límites.
- Faltan pruebas de API para exportación CSV y filtros combinados.

**Recomendaciones**
- Incluir join con `usuario`/`persona` en `prisma.bitacora.findMany` para mostrar nombre.
- Definir política de retención y job de purga similar a reportes.
- Añadir pruebas con filtros múltiples (usuario + fechas + acción).

### 13. Subida y almacenamiento de archivos (`src/app/api/upload`, `src/lib/storage/s3.ts`)
**Estado actual**
- Upload local con validaciones básicas de tipo/tamaño y bitácora.
- Helpers S3 que cargan SDK bajo demanda (`optionalCjsImport`).

**Brechas detectadas**
- Sin escaneo antivirus ni validación EXIF; riesgo de malware.
- No se crea thumbnail ni se optimiza imagen; UI puede servir archivos grandes sin controles.
- No hay limpieza automática de archivos huérfanos.
- Endpoint sólo verifica autenticación básica; no valida permisos específicos.

**Recomendaciones**
- Integrar escaneo (ClamAV, Cloudflare AV) antes de guardar.
- Generar variantes optimizadas y almacenar metadata en BD.
- Reemplazar almacenamiento local por S3 en producción, usando `src/lib/storage/s3.ts`.
- Limitar acceso al permiso `inventario.productos` o similar.

### 14. DevOps, scripts y pruebas (`package.json`, `scripts/*`, `tests/*`)
**Estado actual**
- Scripts de verificación (`npm run verify`), seeds (`npm run seed`, `seed:indicadores`), y warm-up (`indicadores:warm-cache`).
- Documentación en `README.md`, manuales y prompts.
- Cobertura extensa de pruebas unitarias/API para dominios principales.

**Brechas detectadas**
- No hay script que levante Redis en entornos CI por defecto; se requiere `docker compose` manual.
- `npm run verify` no ejecuta `test:critical`; depende de pipeline externo.
- Falta integración continua configurada (no se halló `.github/workflows`).
- Algunas funciones críticas (p. ej. `reportes/workerUtils`) carecen de pruebas.

**Recomendaciones**
- Añadir workflow CI con matrix (lint, typecheck, `test:critical`, `test --runInBand`).
- Documentar requisito de Redis/SMTP en `README` con sección troubleshooting.
- Incluir `test:critical` dentro de `verify` o crear comando `ci` que los ejecute en serie.
- Priorizar pruebas para scripts worker (usar `REDIS_USE_MOCK` en Jest).

---

## Próximos pasos sugeridos
1. **Seguridad:** implementar rate limiting y endurecer endpoints sensibles (login, upload, cron internos).
2. **Transacciones críticas:** refactorizar generación de códigos y modularizar creación de órdenes.
3. **Validaciones:** unificar esquemas Zod en catálogos y vehículos para evitar divergencias.
4. **Automatización operativa:** programar jobs (alertas inventario, purga bitácora/reportes, reenvío credenciales).
5. **Observabilidad:** sustituir `console.log` por logger estructurado y monitorear colas/reportes.

Con esta hoja de ruta, los módulos quedarían alineados para un despliegue estable y auditable. Se recomienda priorizar las actividades de seguridad antes de abrir el sistema a usuarios externos.

## Plan de acción priorizado

### Ola 0 · Quick wins (≤3 días)
- [x] **Bitácora**: incluir join a `usuario` y `persona` en respuesta, más prueba Jest para exportación CSV.
- [x] **Upload**: validar permiso explícito (`inventario.productos`) y mover paths/constantes a config central.
- [x] **Usuarios**: encapsular validaciones en esquemas Zod compartidos y añadir pruebas para `registrarEnvioCredenciales`.
- [x] **Permisos**: introducir `PermisoNoEncontradoError` y cache in-memory (TTL 5 min) en `listarPermisosPorModulo`.
- [x] **Bitácora/reportes**: añadir cron/documentación para scripts `purge-old-exports` y purga de bitácora (ver `docs/cron-jobs.md`).

### Ola 1 · Seguridad y resiliencia (1-2 semanas)
- [x] **Autenticación**: implementar rate limiting (Redis) y contador de intentos fallidos; reemplazar `console.log` por logger.
- [x] **Upload**: integrar escaneo antivirus/antimalware y límites diarios por usuario.
- [x] **Cron inventario**: proteger `/api/inventario/alertas/cron` con permiso dedicado y notificación por correo usando cola existente.
- [x] **Reportes programados**: validar conexión Redis/S3/SMTP al iniciar y abortar con mensaje claro; impedir cuentas temporales en producción.
- [x] **DevOps**: crear workflow CI (lint, typecheck, `test:critical`) y documentar requisitos Redis/SMTP en README.

### Ola 2 · Integridad de datos (2-3 semanas)
- [x] **Generación de códigos**: mover lógica de correlativos (cotizaciones, productos, servicios) a transacciones con bloqueo o secuencias.
- [x] **Órdenes**: refactorizar `crearOrden` en submódulos testeables (validaciones, reservas, estimaciones) y añadir pruebas unitarias.
- [x] **Vehículos/Servicios**: migrar validaciones y listados a `src/lib/{vehiculos,servicios}/service.ts` con cobertura de pruebas.
- [x] **Indicadores/dashboards**: disparar invalidaciones de cache tras eventos clave (orden completada, movimientos inventario).
- [x] **Facturación**: cachear configuración, validar banderas de habilitación y documentar integración futura con SUNAT/CFDI.

### Ola 3 · Automatización operativa (≥1 mes)
- [x] **Usuarios**: job BullMQ para reprocesar `envio_credenciales_pendiente` y seguimiento de fallos SMTP.
- [x] **Inventario**: job para liberar reservas caducadas + reportes periódicos de stock crítico por correo/Slack.
- [x] **Órdenes/Tareas**: scheduler diario que detecte tareas en pausa prolongada y envíe alertas.
- [x] **Indicadores**: endpoint/admin para recalcular KPIs y fallback offline en dashboard.
- [x] **Bitácora**: política de retención configurable y visualización mejorada (nombre de usuario, IPs, filtros combinados).
