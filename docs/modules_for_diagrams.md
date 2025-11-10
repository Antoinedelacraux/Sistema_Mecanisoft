## Módulos a representar en diagramas y capturas (presentes en el repo)

Este documento lista los módulos que realmente existen en tu código (evidencia en `src/lib`, `src/app/api` y `src/components`) y especifica para cada uno:
- qué diagramas producir (Caso de uso, Diagrama de actividad, Diagrama de secuencia)
- qué capturas tomar (lista, formulario, resultado, error)
- nombres de archivo sugeridos y carpeta destino

Carpeta recomendada para capturas: `docs/screenshots/<module-slug>/` (alternativa pública: `public/exports/screenshots/<module-slug>/`).

Prioridad sugerida: 1) Órdenes, 2) Inventario, 3) Facturación, 4) Pagos, 5) Compras, 6) Clientes.

---

1) Clientes
- Evidencia en repo: `src/lib/clientes/`, `src/components/clientes/`.
- Diagrams: Caso de uso (Registrar/Editar/Buscar), Actividad (crear y validar cliente), Secuencia (recepción → crear cliente → asociar vehículo).
- Capturas mínimas: `clientes_list.png`, `cliente_form_nuevo.png`, `cliente_detalle_historial.png`, `cliente_error_validacion.png`.

2) Vehículos
- Evidencia: `src/components/vehiculos/` (UI). Revisar si hay lógica en `src/lib` relacionada.
- Diagrams: Caso de uso (Registrar vehículo), Actividad (asociar a cliente), Secuencia (creación → asociación → historial).
- Capturas: `vehiculos_list.png`, `vehiculo_form.png`, `vehiculo_historial.png`.

3) Órdenes de Trabajo (central)
- Evidencia: `src/lib/ordenes/`, `src/components/ordenes/`.
- Diagrams: Caso de uso (crear → diagnosticar → aprobar → ejecutar → facturar → cerrar), Actividad (reservas de piezas, aprobaciones), Secuencia (cliente solicita → taller ejecuta → facturación).
- Capturas: `orden_list.png`, `orden_detalle_full.png`, `orden_presupuesto_enviar.png`, `orden_aprobar_cliente.png`, `orden_cerrar_finalizar.png`, `orden_historial_movimientos.png`.

4) Inventario / Productos / Repuestos
- Evidencia: `src/lib/inventario/` (incluye `basico/`), `src/components/inventario/`, `src/components/productos/`.
- Diagrams: Caso de uso (consultar stock, reservar, salida), Actividad (reserva y salida por orden), Secuencia (orden reserva → inventario confirma → movimiento).
- Capturas: `inventario_list_stock.png`, `inventario_detalle_sku.png`, `inventario_reserva_modal.png`, `inventario_confirmar_salida.png`, `inventario_ajuste.png`.

5) Compras y Proveedores
- Evidencia: endpoints API en `src/app/api/inventario/compras/` y UI si aplica en `src/components/`.
- Diagrams: Caso de uso (crear PO, enviar, recibir parcial), Actividad (PO → recepción → ajuste), Secuencia (generar PO → recepción → actualizar stock).
- Capturas: `compras_po_list.png`, `compras_po_form.png`, `compras_registrar_recepcion.png`, `compras_reclamo.png`.

6) Facturación / Comprobantes / Cotizaciones
- Evidencia: `src/lib/facturacion/`, `src/components/facturacion/`.
- Diagrams: Caso de uso (emitir comprobante fiscal, enviar PDF), Actividad (validación fiscal → emisión), Secuencia (orden finalizada → emitir → enviar al cliente / SUNAT/etc.).
- Capturas: `facturacion_pendientes.png`, `facturacion_form_emitir.png`, `facturacion_validacion_error.png`, `facturacion_confirmacion.png`, `facturacion_enviar_email.png`.

7) Pagos y Conciliación
- Evidencia: `src/app/api/ventas/pagos/route.ts`, `src/components/ventas/`.
- Diagrams: Caso de uso (registrar pago, conciliar), Actividad (registro → conciliación automática/manual), Secuencia (pago recibido → conciliar → marcar factura pagada).
- Capturas: `pagos_registrar.png`, `pagos_estado_factura.png`, `pagos_conciliacion_dashboard.png`, `pagos_recibo_emitido.png`.

8) Reportes e Indicadores
- Evidencia: `src/lib/reportes/`, `src/lib/indicadores/`, `src/components/indicadores/`.
- Diagrams: Caso de uso (ejecutar/reprogramar reporte), Actividad (configurar filtros → generar job), Secuencia (usuario solicita → job en background → archivo disponible).
- Capturas: `reportes_list.png`, `reportes_configurar.png`, `reportes_generando.png`, `reportes_resultado_csv.png`.

9) Roles, Permisos y Usuarios
- Evidencia: `src/lib/roles/`, `src/lib/permisos/`, `src/components/roles/`, `src/components/usuarios/`, `src/components/permisos/`.
- Diagrams: Caso de uso (crear usuario, asignar rol), Actividad (asignación y validación), Secuencia (crear usuario → asignar rol → intentar acción restringida).
- Capturas: `usuarios_list.png`, `usuarios_form_crear.png`, `usuarios_prueba_permiso.png`.

10) Bitácora / Auditoría
- Evidencia: `src/lib/bitacora/`, `src/components/bitacora/`.
- Diagrams: Caso de uso (registrar evento, consultar historial), Actividad (registro y consulta), Secuencia (acción de usuario → log creado → revisión).
- Capturas: `bitacora_list.png`, `bitacora_detalle.png`, `bitacora_export.png`.

11) Mailer / Notificaciones
- Evidencia: `src/lib/mailer.ts`, `src/lib/facturacion/email-client.ts`.
- Diagrams: Caso de uso (enviar comprobante/cita), Actividad (preparar template → enviar), Secuencia (evento→colocar en queue→worker envía).
- Capturas: `notificaciones_templates.png`, `notificaciones_preview.png`, `notificaciones_log.png`.

12) Storage / Integraciones de archivos (S3) y otras integraciones
- Evidencia: `src/lib/storage/s3.ts`, `src/lib/facturacion/email-client.ts`, endpoints de integración en `src/app/api`.
- Diagrams: Caso de uso (subir/descargar documento, enviar a ente externo), Actividad (upload→confirmación→enlace), Secuencia (archivo generado → subir → recibir URL).
- Capturas: `integraciones_status.png`, `integraciones_send_factura.png`, `integraciones_bank_recon.png`.

13) Workers / Scheduler / Scripts
- Evidencia: `scripts/report-worker.ts`, `scripts/report-scheduler.ts`, `src/lib/reportes/workerUtils.ts`.
- Diagrams: Caso de uso (programar job, reintentos), Actividad (agendar → ejecutar → reintentar), Secuencia (scheduler → worker → resultado / retry).
- Capturas: `scheduler_jobs.png`, `scheduler_job_run.png`, `scheduler_retries.png`.

14) Exportes / Importes y utilidades administrativas
- Evidencia: `scripts/`, `public/exports/`.
- Diagrams: Caso de uso (exportar CSV/PDF, importar catálogo), Actividad (validar import → aplicar), Secuencia (usuario solicita → job → descarga).
- Capturas: `export_import_menu.png`, `import_preview_errors.png`, `export_download.png`.

15) Seguridad, Backups y Continuidad
- Evidencia: scripts y documentación en `scripts/` y `docs/` (parcial).
- Diagrams: Caso de uso (ejecutar backup, restaurar), Actividad (backup programado → verificar integridad), Secuencia (iniciar backup → confirmar → registrar resultado).
- Capturas: `backup_jobs.png`, `backup_run.png`, `continuidad_plan.png`.

---

Plantilla breve para cada módulo (puedes copiar esto en un MD por módulo):

- Módulo: <nombre>
- Ruta evidencia: <ruta en repo>
- Propósito: <1-2 líneas>
- Diagramas a generar: Caso de uso / Actividad / Secuencia
- Capturas requeridas:
  1. Lista/overview — `<module>_01_list.png`
  2. Formulario/acción — `<module>_02_form.png`
  3. Resultado/confirmación — `<module>_03_result.png`
  4. Caso de error (si aplica) — `<module>_04_error.png`
- Carpeta destino: `docs/screenshots/<module-slug>/`

---

Siguientes pasos que puedo ejecutar ahora (elige):
1. Crear `docs/screenshots/` y subcarpetas por módulo + README/checklist por módulo (auto). 
2. Generar MD por módulo usando la plantilla (archivo `docs/screenshots/<module-slug>/README.md`).
3. Preparar guion paso-a-paso para los 6 módulos prioritarios (Órdenes, Inventario, Facturación, Pagos, Compras, Clientes) con clicks y datos de ejemplo para capturar.

Cuando me indiques, lo creo y marco la tarea como completada en la lista TODO.
