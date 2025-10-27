# Proceso operativo integral — Representación para un único diagrama BPMN

## Propósito
Describir en detalle y de forma secuenciada el flujo operativo completo del taller: desde la solicitud de servicio hasta la entrega, facturación, registro de inventario y generación de reportes. El documento está pensado para ser representado en un único diagrama BPMN que contenga lanes por actor y subprocesos para actividades compuestas.

---

## Contrato mínimo del proceso
- Entradas principales:
  - Información del cliente y del vehículo.
  - Solicitud de servicio (cita o ingreso en taller).
  - Detalle de servicios y repuestos presupuestados.
- Salidas principales:
  - Orden de trabajo finalizada.
  - Comprobante de venta y registro de pago.
  - Movimientos de inventario actualizados.
  - Reportes e indicadores operativos.
- Criterios de éxito:
  - Trabajo completado según lo presupuestado, piezas consumidas registradas y venta conciliada.
- Fallos críticos:
  - Stock insuficiente, rechazo de presupuesto, errores en validaciones financieras o administrativas.

---

## Actores (lanes sugeridos)
- Cliente
- Recepción / Atención
- Taller / Técnico
- Almacén / Inventario
- Compras / Proveedor
- Caja / Facturación
- Administración / Backoffice
- Sistema automático / Batch (tareas programadas)
- Auditoría / Bitácora (registro)

---

## Objeto central
- Orden de Trabajo: elemento central del proceso que contiene diagnóstico, presupuesto, líneas de servicio, estado, consumos y referencias a movimientos y comprobantes.

---

## Módulos detallados (responsabilidades, entradas/salidas, flujos y errores)

A continuación se describen todos los módulos del sistema con el nivel de detalle necesario para modelarlos en un único diagrama BPMN.

- Clientes y Contactos
  - Responsabilidad: registro y mantenimiento de datos del cliente, verificación documental y preferencias de comunicación.
  - Entradas: alta/actualización de cliente, datos fiscales.
  - Salidas: datos para Recepción y Facturación.
  - Decisiones: ¿datos fiscales completos? → Sí / No.
  - Errores: datos incompletos bloquean emisión de comprobantes y requieren corrección.

- Vehículos
  - Responsabilidad: registro del vehículo, historial de servicios y alertas técnicas.
  - Entradas: información técnica, historial de órdenes.
  - Salidas: historial consultable por Técnicos y Reportes.
  - Decisiones: marcar prioridad si hay alertas previas.

- Agenda / Citas
  - Responsabilidad: gestionar citas, bloquear recursos y notificar al cliente.
  - Entradas: solicitud de cita o asignación interna.
  - Salidas: programación de la orden y recordatorios.
  - Errores: conflictos de agenda que generan reprogramaciones.

- Recepción / Atención
  - Responsabilidad: crear la Orden de Trabajo, verificar datos y derivar a diagnóstico.
  - Entradas: datos del cliente/vehículo y motivo de ingreso.
  - Salidas: orden en estado "creada" o solicitud de datos adicionales.
  - Errores: datos contradictorios que deben validarse antes de avanzar.

- Órdenes de Trabajo (Orquestador central)
  - Responsabilidad: mantener el ciclo de vida de la orden (estados, presupuesto, líneas, referencias).
  - Entradas: petición de Recepción, diagnóstico y aprobaciones del cliente.
  - Salidas: órdenes programadas, triggers a Inventario y Facturación.
  - Estados: creada → diagnóstico → presupuesto → aprobada → programada → en ejecución → finalizada → facturada → cerrada/cancelada.
  - Errores: inconsistencias entre consumo real y presupuestado, requieren ajuste y auditoría.

- Diagnóstico y Servicios (Taller / Técnico)
  - Responsabilidad: inspección, presupuesto y definición de repuestos/servicios.
  - Entradas: orden con síntoma y historial del vehículo.
  - Salidas: presupuesto detallado y lista de repuestos.
  - Decisiones: ¿repuestos indispensables disponibles? → Sí / No.

- Inventario y Repuestos (Almacén)
  - Responsabilidad: verificar stock, crear reservas, registrar salidas y entradas, y ajustar inventario.
  - Entradas: solicitudes de verificación, recepciones de compra y ajustes manuales.
  - Salidas: confirmación de reserva, movimientos de inventario y avisos a Compras.
  - Reglas: reservar solo tras aprobación del cliente; convertir reserva en salida al confirmar uso.
  - Errores: doble consumo o stock negativo → corrección y registro en auditoría.

- Compras y Proveedores
  - Responsabilidad: generar PO, negociar condiciones y registrar recepciones parciales/ totales.
  - Entradas: necesidades desde Inventario.
  - Salidas: confirmación de PO, entradas de stock y notificaciones a órdenes pendientes.
  - Errores: discrepancias de mercancía que desencadenan reclamos.

- Facturación / Ventas / Caja
  - Responsabilidad: validar datos fiscales, emitir comprobantes, calcular impuestos y gestionar caja.
  - Entradas: orden finalizada con consumos, datos del cliente.
  - Salidas: factura/boleta y registro de venta.
  - Reglas: no emitir sin validación fiscal; permitir pago parcial.
  - Errores: rechazo por validación fiscal → corrección y reintento.

- Pagos y Conciliación (Tesorería)
  - Responsabilidad: registro de cobros, conciliación bancaria y gestión de notas de crédito.
  - Entradas: medios de pago y comprobantes emitidos.
  - Salidas: registro de pago y estados de saldo.
  - Errores: pago rechazado → marcar y notificar para reintento.

- Reportes e Indicadores
  - Responsabilidad: consolidar datos operativos y financieros para KPIs y reportes periódicos.
  - Entradas: movimientos, ventas, pagos y actividad de usuarios.
  - Salidas: reportes, alertas y archivos exportables.
  - Errores: datos incompletos → alertas y reportes parciales.

- Usuarios, Roles y Permisos
  - Responsabilidad: controlar accesos y autorizar acciones críticas.
  - Entradas: creación/actualización de usuarios y asignación de roles.
  - Salidas: permisos aplicados y logs de acceso.
  - Errores: intento de acción sin permiso → denegación y registro.

- Bitácora / Auditoría
  - Responsabilidad: registrar eventos críticos para trazabilidad.
  - Entradas: eventos de reserva, consumo, ajuste, emisión y cambios de estado.
  - Salidas: registros consultables para auditoría.
  - Reglas: todo ajuste financiero o de inventario requiere bitácora asociada.

- Notificaciones y Comunicación (Correo/SMS)
  - Responsabilidad: envío de comprobantes, avisos de cita y seguimiento de pagos.
  - Entradas: eventos que disparan notificaciones.
  - Salidas: correos/SMS al cliente y notificaciones internas.
  - Errores: reintentos automáticos; si fallan, escalar a Administración.

- Scheduler / Workers (Procesos automáticos)
  - Responsabilidad: tareas programadas para reportes, reconciliaciones y mantenimiento.
  - Entradas: timers y triggers.
  - Salidas: reportes, eventos y actualizaciones de KPI.
  - Reglas: idempotencia y reintentos controlados.

- Integraciones Externas (Bancos, Proveedores, E-factura)
  - Responsabilidad: comunicación con terceros para pagos, facturación electrónica y suministro.
  - Entradas: datos de comprobantes y POs.
  - Salidas: confirmaciones y conciliaciones.
  - Errores: rechazo externo → flujo de reenvío y rectificación.

- Exportes/Importes de datos
  - Responsabilidad: generación de archivos y carga de catálogos/lotess.
  - Entradas: pedidos de exportación o importación.
  - Salidas: archivos CSV/PDF/Excel y actualizaciones masivas.
  - Errores: importación con fallos → rechazo del lote y reporte de errores.

- Configuración / Parametrización
  - Responsabilidad: definir reglas de negocio y parámetros operativos.
  - Entradas: acciones administrativas.
  - Salidas: comportamiento del sistema adaptado.
  - Errores: cambios críticos pueden requerir rollback.

- Seguridad, Backups y Continuidad
  - Responsabilidad: copias, restauración y plan de continuidad.
  - Entradas: políticas y triggers de recuperación.
  - Salidas: puntos de restauración y logs de integridad.
  - Decisiones: activar plan de continuidad en fallos mayores.

---

## Flujo end-to-end ampliado (integrando todos los módulos)

- Inicio: Cliente solicita servicio → Recepción crea Orden y la pone en Agenda.
- Diagnóstico: Taller inspecciona → genera presupuesto (servicios y repuestos).
- Verificación: Inventario chequea disponibilidad por cada repuesto:
  - Si disponible → crear reserva (Inventario).
  - Si no disponible → Compras genera PO y se espera recepción (sub-flujo event-based).
- Aprobación: Cliente aprueba presupuesto → reserva definitiva de ítems y programación en Agenda.
- Ejecución: Taller realiza trabajo, registra horas y consumo de repuestos → Inventario convierte reservas en salidas.
- Cierre técnico: Orden marcada como finalizada → trigger a Facturación.
- Facturación: validar datos del cliente, calcular impuestos y emitir comprobante.
- Cobro: registrar pago (total o parcial) → si parcial, Scheduler/Notificaciones programan follow-up.
- Entrega: notificar al Cliente y registrar salida en Recepción.
- Reportes: Scheduler genera reportes e indicadores periódicos.
- Cierre: conciliación financiera y auditoría final.

---

## Puntos transaccionales y de consistencia
- Reserva → Consumo → Emisión de factura: debe tratarse como unidad lógica; si alguna parte falla, definir compensación.
- Recepción parcial de compras: registrar entradas parciales y notificar órdenes afectadas.

---

## Concurrencia y bloqueos (riesgos y mitigaciones)
- Condición de carrera al reservar el mismo repuesto: priorizar la primera reserva y derivar la segunda al flujo "no disponible".
- Conflictos de edición en la misma orden: control de versiones y flujo de resolución manual.
- Workers duplicados: idempotencia y gestión de colas para evitar duplicidad.

---

## Errores y flujos de compensación detallados
- Fallo al emitir comprobante tras consumir stock:
  - Compensación: revertir salida o crear ajuste y abrir ticket de investigación.
  - Registrar incidente en Auditoría y notificar Backoffice.
- Recepción discrepante:
  - Iniciar reclamo a proveedor, ajustar inventario y notificar órdenes afectadas.
- Pago rechazado tras emisión:
  - Marcar factura como pendiente/impago, notificar cliente y gestionar reversión si corresponde.
- Importación masiva con errores:
  - Rechazar lote y generar reporte con líneas erróneas para corrección.

---

## Mapeo BPMN (elementos concretos por módulo para un único diagrama)
- Lanes: cada módulo como lane.
- Start Events: "Ingreso cliente", "Trigger scheduler".
- Tasks por lane (ejemplos):
  - Recepción: "Crear orden", "Verificar datos".
  - Taller: "Diagnosticar", "Elaborar presupuesto", "Ejecutar trabajo".
  - Inventario: "Verificar stock", "Crear reserva", "Registrar salida".
  - Compras: "Generar PO", "Registrar recepción".
  - Facturación: "Validar datos fiscales", "Emitir comprobante".
  - Pagos: "Registrar pago", "Conciliar".
  - Sistema: "Generar reporte", "Enviar notificación".
  - Auditoría: "Registrar evento".
- Gateways: XOR (aprobación, stock, validación fiscal), Event-based (espera por recepción), Parallel (emitir + notificar).
- Subprocesses sugeridos: Inventario, Compras, Facturación, Ejecución.

---

## Edge-cases operativos (detallados)
- Orden con líneas mixtas (algunas piezas llegan, otras no): ejecución parcial y comunicación al cliente.
- Devolución/reciclaje de piezas entre órdenes: reglas de ajuste y registro en auditoría.
- Presupuesto modificado durante ejecución: versionado y re-aprobación si supera umbral.
- Anulación post-consumo: devolución/nota de crédito y ajuste de inventario.

---

## Recomendaciones prácticas para el diagrama único
- Mantener la Orden como eje central y usar subprocesos expandibles para no saturar el diagrama.
- Señalar puntos transaccionales y sus compensaciones explícitamente.
- Incorporar timers visibles (caducidad presupuesto, recordatorios de pago).
- Añadir artefactos con reglas de negocio que no quepan en las etiquetas de tarea.

---

## Próximos pasos sugeridos
- Generar una lista de elementos BPMN con IDs y nombres exactos para pegar en un modelador.
- Crear archivo .bpmn (XML) con el flujo principal y subprocesos esenciales.
- Generar un diagrama visual (SVG/PNG) del flujo principal.

---

## Flujo consolidado (secuencia para modelar en un único BPMN)

1. Inicio — Cliente solicita servicio (Start Message).
2. Recepción crea Orden (Task: registrar datos del cliente y vehículo).
3. Orden enviada a Diagnóstico (Task: asignar a técnico y describir síntoma).
4. Taller elabora presupuesto (Task) y lo comunica al Cliente (Message).
5. Gateway (XOR): ¿Cliente aprueba presupuesto?
   - Sí: continuar a verificación de stock.
   - No: terminar como orden en espera o cancelar (End Event).
6. Inventario verifica disponibilidad (Task síncrono).
   - Gateway (XOR): ¿Stock disponible?
     - Sí: Inventario crea reserva (Task) y confirma.
     - No: Inventario genera solicitud de compra (Message a Compras) y marca la línea pendiente; proceso espera la recepción (Event-based Gateway con Message de recepción).
7. Subproceso: Programación y ejecución del trabajo (Tasks paralelos: asignar técnico, preparar orden, ejecutar trabajo).
8. Ejecución: consumo de repuestos y registro de mano de obra (Task) → Inventario actualiza: reserva pasa a salida efectiva (Task).
9. Subproceso transaccional: Facturación y cobro
   - Validar datos del cliente/fiscales (Task, síncrono).
   - Si válido: emitir comprobante (Task) y registrar pago (Task, puede ser parcial o total).
   - Si inválido: Error Event → flujo de corrección de datos en Recepción (User Task).
10. Evento de pago parcial: registrar saldo pendiente y programar seguimiento (Timer Event si aplica).
11. Entrega: vehículo devuelto al cliente, notificación de entrega (Message) y registro en Auditoría (Task/Artefacto).
12. Sistema automático: generación de reportes e indicadores periódicos (Timer Start Events) y envío de notificaciones.
13. Fin — Orden cerrada y conciliada (End Event).

---

## Decisiones y Gateways clave
- XOR: aprobación del presupuesto por el cliente.
- XOR: verificación automática de stock antes de programar ejecución.
- XOR: validación de datos para emisión de comprobante.
- Event-based: espera por recepción de repuestos desde proveedor.
- Parallel (AND): tareas concurrentes como emitir comprobante y enviar notificación.

---

## Subprocesos recomendados (para agrupar en el diagrama)
- Gestión de Inventario: verificar → reservar → solicitar compra → recibir → ajustar.
- Ejecución Técnica: diagnóstico → plan → ejecutar → registrar consumos.
- Facturación y Cobro: validar → emitir → cobrar → conciliar.
- Reportes y Notificaciones: programar → generar → distribuir.

---

## Eventos externos y compensaciones
- Mensaje de proveedor: recepción parcial o total de repuestos que desata la continuación de líneas pendientes.
- Compensación en caso de fallos durante facturación o ajuste de stock (revertir reservas, anular comprobantes o crear notas de crédito según política).
- Reintentos automáticos para envíos fallidos; si exceden N intentos, escalar a Administración.

---

## Manejo de errores y flujos alternativos (principales)
- Stock insuficiente: ruta de compra y espera por recepción o comunicación al cliente para reprogramación.
- Cliente rechaza presupuesto: cerrar o archivar orden.
- Error en facturación: corregir datos y reintentar emisión.
- Pago rechazado: marcar como fallido, notificar al cliente y esperar reintento.

---

## Temporizadores y seguimientos
- Caducidad de presupuesto (ej.: 7 días) — Timer Event que desbloquea o cancela reservas.
- Recordatorio de pago pendiente — Timer Event para enviar aviso al cliente.
- Generación periódica de reportes e indicadores — Timer Start Events.

---

## Artefactos de datos a mostrar en el diagrama
- Orden de Trabajo
- Presupuesto
- Movimiento de Inventario (reserva/entrada/salida/ajuste)
- Orden de Compra (PO)
- Comprobante / Factura
- Pago
- Reporte / Indicador
- Registro de Auditoría

---

## Reglas operativas que deben quedar visibles
- Reservar stock únicamente después de la aprobación del presupuesto por el cliente.
- No emitir comprobante sin validar la información fiscal del cliente.
- Registrar obligatoriamente el consumo de repuestos para cualquier salida de inventario.
- Mantener trazabilidad de todas las acciones críticas mediante registros de auditoría.

---

## Métricas recomendadas para adjuntar al diagrama (opcional)
- TAT: tiempo desde ingreso hasta entrega.
- % de presupuestos aprobados.
- Tiempo medio de reabastecimiento por ítem.
- Rotación de inventario.
- % de facturaciones sin incidencias.

---

## Sugerencias para dibujar el único diagrama BPMN
- Usar lanes por actor y situar la Orden de Trabajo como eje central.
- Representar subprocesos expandibles para no saturar el diagrama con detalles.
- Emplear eventos intermedios para esperas por externalidades (proveedor/cliente).
- Indicar claramente qué tareas son automáticas y cuáles requieren intervención humana.
- Etiquetar gateways y eventos (por ejemplo: "Stock disponible?", "Cliente aprueba?").

---

## Resumen ejecutivo (versión ultra corta para portada del diagrama)
1. Registro: Cliente + vehículo → crear orden.
2. Diagnóstico y presupuesto.
3. Verificación de stock → reservar o solicitar compra.
4. Aprobación del cliente → ejecutar trabajo.
5. Consumo de repuestos, cierre técnico.
6. Facturación y cobro.
7. Entrega y notificaciones.
8. Actualización de inventario, generación de reportes y registro en auditoría.


