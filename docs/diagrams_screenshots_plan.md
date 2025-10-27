# Plan para diagramas y capturas de pantalla por módulo

Objetivo: definir qué procesos debemos diagramar (casos de uso, actividad y secuencia) y qué capturas de la aplicación sirven de evidencia para cada proceso. El plan facilita generar diagramas precisos y capturas consistentes que respalden la documentación y la presentación a stakeholders.

Instrucciones rápidas:
- Prioriza capturas en entorno de pruebas con datos realistas (seed de ejemplo).
- Guarda las imágenes en `public/exports/screenshots/` o `docs/screenshots/` siguiendo el esquema de nombres propuesto.
- Incluye: captura de lista (overview), captura de formulario (entrada), captura de confirmación/resultado, captura de errores o mensajes relevantes.
- Anota las capturas con números de paso y un pequeño comentario (puede ser en el MD o como un PNG con marcas).

---

Resumen: cuántos módulos y cuáles
- Total módulos a cubrir: 19
- Módulos (lista breve):
  1. Clientes y Contactos
  2. Vehículos
  3. Agenda / Citas
  4. Recepción / Atención
  5. Órdenes de Trabajo
  6. Diagnóstico y Servicios (Taller)
  7. Inventario y Repuestos
  8. Compras y Proveedores
  9. Facturación / Ventas / Caja
 10. Pagos y Conciliación
 11. Reportes e Indicadores
 12. Usuarios, Roles y Permisos
 13. Bitácora / Auditoría
 14. Notificaciones y Comunicación
 15. Scheduler / Workers
 16. Integraciones Externas
 17. Exportes / Importes de datos
 18. Configuración / Parametrización
 19. Seguridad, Backups y Continuidad

---

Qué entregar por módulo
- Diagramas: Caso de uso, Diagrama de actividad y Diagrama de secuencia (por proceso principal).
- Capturas: mínimo 3 por proceso crítico (lista, formulario/acción, resultado/confirmación). Para procesos muy largos, 5–8 capturas encadenadas.
- Artefactos: nombre de archivo sugerido, paso en el flujo y breve nota que explique qué muestra la captura.

Recomendación de prioridad (hacer primero)
1. Órdenes de Trabajo
2. Inventario y Repuestos
3. Facturación / Ventas / Caja
4. Pagos y Conciliación
5. Compras y Proveedores
6. Recepción / Atención

---

Plan detallado por módulo (procesos y capturas sugeridas)

1) Clientes y Contactos
- Procesos a diagramar:
  - Caso de uso: Registrar/editar cliente, consultar historial.
  - Actividad: Flujo de creación -> validación fiscal -> asociar vehículo.
  - Secuencia: Recepción crea cliente → validación → mostrar OK.
- Capturas necesarias (3):
  - `clientes_list.png` — lista de clientes / filtro y botón "Nuevo cliente".
  - `cliente_form_nuevo.png` — formulario de creación (campos RUC/DNI, dirección, email).
  - `cliente_detalle_historial.png` — vista del cliente con historial de órdenes.

2) Vehículos
- Procesos a diagramar:
  - Caso de uso: Registrar vehículo, consultar historial.
  - Actividad: Asociar vehículo a cliente y ver alertas.
- Capturas necesarias (3):
  - `vehiculos_list.png` — listado/ búsqueda de vehículos.
  - `vehiculo_form.png` — formulario para añadir vehículo (placa, modelo, km).
  - `vehiculo_historial.png` — historial de servicios del vehículo.

3) Agenda / Citas
- Procesos a diagramar:
  - Caso de uso: Agendar cita, reprogramar, cancelar.
  - Actividad: Agenda → notificación → check-in.
- Capturas necesarias (4):
  - `agenda_calendar.png` — vista calendario semanal con citas.
  - `agenda_form_cita.png` — formulario de creación de cita (cliente, vehículo, horario).
  - `agenda_notificacion_preview.png` — plantilla de recordatorio.
  - `agenda_checkin.png` — confirmación de llegada / check-in en recepción.

4) Recepción / Atención
- Procesos a diagramar:
  - Caso de uso: Crear orden de trabajo (ingreso rápido), pre-check de datos.
  - Actividad: Flujo ingreso → verificación → envío a diagnóstico.
- Capturas necesarias (5):
  - `recepcion_dashboard.png` — bandeja de recepción con vehículos programados.
  - `crear_orden_form.png` — formulario de creación de orden (cliente, vehículo, síntoma).
  - `precheck_validacion.png` — pantalla de validación fiscal/cliente (resultado OK/ERR).
  - `orden_detalle_initial.png` — vista de la orden recién creada.
  - `orden_enviar_diagnostico.png` — acción para derivar al taller.

5) Órdenes de Trabajo (orquestador central)
- Procesos a diagramar:
  - Caso de uso: Ciclo de vida completo: crear → diagnosticar → aprobar → ejecutar → facturar → cerrar.
  - Actividad: decisiones (aprobación, stock, reprogramación).
  - Secuencia: crear orden → reservar piezas → ejecutar → facturar.
- Capturas necesarias (6–8):
  - `orden_list.png` — lista de órdenes con filtros por estado.
  - `orden_detalle_full.png` — vista completa (líneas, presupuesto, estado).
  - `orden_presupuesto_enviar.png` — modal/acción para enviar presupuesto al cliente.
  - `orden_aprobar_cliente.png` — pantalla o confirmación de aprobación.
  - `orden_programar.png` — scheduler o asignación técnica.
  - `orden_cerrar_finalizar.png` — marcar como finalizada.
  - `orden_historial_movimientos.png` — movimientos asociados (inventario, facturación).

6) Diagnóstico y Servicios (Taller / Técnico)
- Procesos a diagramar:
  - Caso de uso: Ejecutar diagnóstico, registrar horas, añadir servicios.
  - Actividad: detectar piezas necesarias, compilar presupuesto.
- Capturas necesarias (4):
  - `diagnostico_form.png` — formulario de diagnóstico (checklist, observaciones).
  - `diagnostico_agregar_linea.png` — añadir línea de servicio/repuesto.
  - `diagnostico_presupuesto_preview.png` — vista previa del presupuesto.
  - `diagnostico_asignar_tecnico.png` — asignación de técnico.

7) Inventario y Repuestos (Almacén)
- Procesos a diagramar:
  - Caso de uso: Verificar stock, crear reserva, registrar salida/ajuste.
  - Secuencia: orden solicita reserva → inventario confirma → crea movimiento.
- Capturas necesarias (6):
  - `inventario_list_stock.png` — listado de SKUs con stock disponible y filtros.
  - `inventario_detalle_sku.png` — ficha SKU con historial y ubicaciones.
  - `inventario_reserva_modal.png` — interfaz para reservar stock para orden.
  - `inventario_confirmar_salida.png` — pantalla para registrar salida por consumo.
  - `inventario_ajuste.png` — formulario de ajuste y justificación.
  - `inventario_alerta_critico.png` — alerta/umbral para stock crítico.

8) Compras y Proveedores
- Procesos a diagramar:
  - Caso de uso: Generar PO, enviar a proveedor, registrar recepción parcial.
  - Actividad: PO → recepción → ajuste inventario.
- Capturas necesarias (5):
  - `compras_po_list.png` — lista de POs pendientes/emitidos.
  - `compras_po_form.png` — crear PO (líneas, proveedor, fechas).
  - `compras_enviar_proveedor.png` — pantalla de envío / confirmación.
  - `compras_registrar_recepcion.png` — recepción y cantidades recibidas (parcial/total).
  - `compras_reclamo.png` — interfaz para discrepancias/reclamos.

9) Facturación / Ventas / Caja
- Procesos a diagramar:
  - Caso de uso: Generar comprobante, validar fiscal, emitir y enviar comprobante.
  - Secuencia: orden finalizada → validar datos → emitir → enviar PDF.
- Capturas necesarias (6):
  - `facturacion_pendientes.png` — lista de órdenes pendientes de facturar.
  - `facturacion_form_emitir.png` — pantalla para emitir comprobante (seleccionar tipo, aplicar impuestos).
  - `facturacion_validacion_error.png` — ejemplo de error fiscal y mensaje al usuario.
  - `facturacion_confirmacion.png` — comprobante emitido (número, PDF link).
  - `facturacion_enviar_email.png` — vista del envío por correo con adjunto.
  - `facturacion_notascredito.png` — gestión de notas de crédito / anulaciones.

10) Pagos y Conciliación (Tesorería)
- Procesos a diagramar:
  - Caso de uso: Registrar pago, conciliación automática/manual, generar recibo.
  - Secuencia: emitir comprobante → recibir pago → conciliar.
- Capturas necesarias (4):
  - `pagos_registrar.png` — formulario de registro de pago (método, monto, referencia).
  - `pagos_estado_factura.png` — vista de factura con estado de pagos y saldos.
  - `pagos_conciliacion_dashboard.png` — pantalla de conciliación bancaria / matcher.
  - `pagos_recibo_emitido.png` — recibo o comprobante de pago emitido.

11) Reportes e Indicadores
- Procesos a diagramar:
  - Caso de uso: Ejecutar reporte, programar reporte, descargar CSV/PDF.
  - Actividad: selección de rango, filtros y generación.
- Capturas necesarias (4):
  - `reportes_list.png` — catálogo de reportes disponibles.
  - `reportes_configurar.png` — pantalla para configurar parámetros y rango.
  - `reportes_generando.png` — vista de progreso / job en background.
  - `reportes_resultado_csv.png` — ejemplo de export CSV o PDF.

12) Usuarios, Roles y Permisos
- Procesos a diagramar:
  - Caso de uso: Crear usuario, asignar rol, verificar permisos.
- Capturas necesarias (3):
  - `usuarios_list.png` — lista de usuarios y roles.
  - `usuarios_form_crear.png` — crear usuario y asignar role/permissions.
  - `usuarios_prueba_permiso.png` — ejemplo de rechazo al intentar acción sin permiso.

13) Bitácora / Auditoría
- Procesos a diagramar:
  - Caso de uso: Registrar evento, consultar historial de cambios.
- Capturas necesarias (3):
  - `bitacora_list.png` — lista de eventos/auditoría con filtros.
  - `bitacora_detalle.png` — detalle de un evento con payload.
  - `bitacora_export.png` — exportar logs para auditoría.

14) Notificaciones y Comunicación
- Procesos a diagramar:
  - Caso de uso: Configurar plantilla, enviar notificación (comprobante, cita).
- Capturas necesarias (3):
  - `notificaciones_templates.png` — listado de plantillas.
  - `notificaciones_preview.png` — preview de correo/SMS.
  - `notificaciones_log.png` — historial de envíos y estado.

15) Scheduler / Workers
- Procesos a diagramar:
  - Caso de uso: Programar job, monitorizar ejecución y reintentos.
- Capturas necesarias (3):
  - `scheduler_jobs.png` — lista de jobs programados.
  - `scheduler_job_run.png` — detalle de ejecución y logs.
  - `scheduler_retries.png` — historial de reintentos.

16) Integraciones Externas (Bancos, Proveedores, E-factura)
- Procesos a diagramar:
  - Caso de uso: Envío de comprobante a e-factura, recepción de confirmación de pago.
- Capturas necesarias (3):
  - `integraciones_status.png` — estado de integraciones y colas.
  - `integraciones_send_factura.png` — pantalla de envío/resultado a ente externo.
  - `integraciones_bank_recon.png` — resultado de conciliación con banco.

17) Exportes / Importes de datos
- Procesos a diagramar:
  - Caso de uso: Importar catálogo, exportar reportes.
- Capturas necesarias (3):
  - `export_import_menu.png` — menú de import/export.
  - `import_preview_errors.png` — preview de import con errores marcados.
  - `export_download.png` — descarga de archivo generado.

18) Configuración / Parametrización
- Procesos a diagramar:
  - Caso de uso: Cambiar parámetros (tiempo caducidad, impuestos), aplicar cambios.
- Capturas necesarias (3):
  - `config_general.png` — panel de configuración general.
  - `config_fiscal.png` — parametrización de impuestos y plantillas.
  - `config_save_confirmation.png` — confirmación de guardado.

19) Seguridad, Backups y Continuidad
- Procesos a diagramar:
  - Caso de uso: Ejecutar backup, restaurar, gestión de accesos de emergencia.
- Capturas necesarias (3):
  - `backup_jobs.png` — listado de backups/restore points.
  - `backup_run.png` — pantalla de ejecución/resultado de backup.
  - `continuidad_plan.png` — opción para activar plan de continuidad.

---

Guía de captura y formato
- Resolución: preferible 1366×768 o superior; guarda en PNG.
- Anotaciones: añade número de paso (1,2,3...) y breve nota (ej.: "Paso 2 — completar formulario"). Puedes crear un MD con cada captura y su explicación.
- Nombres de archivos: usar prefijo del módulo y proceso, por ejemplo: `orden_01_list.png`, `orden_02_form.png`, `orden_03_confirm.png`.
- Carpeta destino: `docs/screenshots/<module-slug>/` o `public/exports/screenshots/<module-slug>/`.
- Datos: usa datos de pruebas; evita exponer datos reales de clientes.

Estimación de volumen de capturas
- Módulos prioritarios (6): 6×(4–8) = ~36–48 capturas.
- Resto módulos (13): 13×3 = 39 capturas.
- Total estimado: 75–90 capturas para cubrir todo el sistema en detalle.

Mapeo rápido: captura → elemento de diagrama
- Lista de objetos UI (lista, form, detalle) → corresponderá a nodos de actividad o lifelines en diagramas de secuencia.
- Mensajes / confirmaciones → gateways/ event nodes.
- Formularios con validación → mostrar tanto la entrada como el error (para modelar ramas de excepción).

---

Checklist de entrega por módulo (usar antes de exportar imágenes)
1. ¿Captura de lista/overview? (sí/no)
2. ¿Captura del formulario/acción principal? (sí/no)
3. ¿Captura del resultado/confirmación? (sí/no)
4. ¿Captura de un caso de error/excepción? (sí/no)
5. ¿Nombre y metadata aplicada (paso, nota) en el MD de acompañamiento? (sí/no)

---

Si quieres, puedo ahora:
- Generar automáticamente las carpetas y un README con la checklist en `docs/screenshots/` (creo las carpetas y archivo). 
- Empezar capturando los 6 módulos prioritarios mediante un guion de pasos (te doy la lista exacta de pantallas y pasos para que captures). 
- Crear plantillas Markdown por módulo que incluyan espacio para insertar las capturas y su explicación.

Indica qué quieres que haga ahora y lo aplico.
