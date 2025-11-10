# Programación de tareas periódicas

Este documento resume las tareas de mantenimiento que deben ejecutarse en segundo plano y cómo programarlas mediante `cron` o servicios equivalentes.

## Purga de exportaciones (`report:purge`)
- **Script:** `npm run report:purge`
- **Descripción:** elimina registros viejos de `reportFile` y borra los archivos físicamente (soporta almacenamiento local o S3).
- **Variables de entorno:**
  - `REPORTS_RETENTION_DAYS` (opcional, predeterminado 30).
  - `S3_BUCKET` y credenciales correspondientes cuando se usa almacenamiento en la nube.
- **Frecuencia recomendada:** diaria, preferentemente durante la madrugada.
- **Ejemplo `cron`:** `0 3 * * * cd /var/www/taller && npm run report:purge >> /var/log/taller/report-purge.log 2>&1`

## Purga de bitácora (`bitacora:purge`)
- **Script:** `npm run bitacora:purge`
- **Descripción:** borra entradas de bitácora antiguas basadas en la retención definida.
- **Variables de entorno:**
  - `DAYS` (opcional, predeterminado 365) para ajustar la retención.
- **Frecuencia recomendada:** semanal o según políticas de cumplimiento.
- **Ejemplo `cron`:** `0 2 * * 0 cd /var/www/taller && DAYS=180 npm run bitacora:purge >> /var/log/taller/bitacora-purge.log 2>&1`

## Alertas de inventario crítico
- **Endpoint:** `GET /api/inventario/alertas/cron` (requiere sesión de servicio con permiso `inventario.alertas`).
- **Descripción:** genera el resumen de productos en nivel crítico y encola el envío de correos a los destinatarios configurados.
- **Variables de entorno:**
  - `INVENTARIO_ALERT_RECIPIENTS` con la lista de correos (separados por coma).
  - `REDIS_URL` y `SMTP_*` activos; el cron aborta si no puede validar estas dependencias.
- **Frecuencia recomendada:** cada hora durante horario laboral.
- **Ejemplo `cron`:** `0 8-18 * * 1-6 curl -fsS -H "Authorization: Bearer <token-servicio>" https://taller.example.com/api/inventario/alertas/cron >> /var/log/taller/inventario-alertas.log 2>&1`

## Buenas prácticas generales
- Asegurar que `npm install --production` y las migraciones estén aplicadas antes de programar los cron jobs.
- Registrar la salida de cada tarea en archivos de log rotados (`logrotate`) para facilitar auditorías.
- Monitorizar fallos con su sistema de observabilidad (ej. enviar alertas si el código de salida es distinto de cero).
- Revisar los permisos del usuario que ejecuta el cron para evitar accesos indebidos a carpetas de uploads o exports.
