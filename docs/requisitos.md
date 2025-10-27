# Requisitos funcionales y no funcionales — Sistema Taller

## Propósito
Documento que reúne los requisitos funcionales y no funcionales que describen lo que el sistema actual implementa y las garantías operativas que ofrece. Este MD sirve como contrato de comportamiento para la propuesta optimizada y como base para pruebas, aceptación y planificación.

## Alcance
- Dominio: gestión integral de taller mecánico — desde la entrada del cliente hasta la entrega, facturación y reportes.
- Incluye: gestión de clientes y vehículos, órdenes de trabajo, diagnóstico, inventario, compras, facturación, pagos, reportes, usuarios/roles, bitácora, notificaciones y procesos en background.

---

## Actores principales (stakeholders)
- Cliente (externo)
- Recepción / Atención
- Técnico / Taller
- Almacén / Inventario
- Compras / Proveedores
- Caja / Facturación / Tesorería
- Administración / Backoffice
- Sistema (workers, mailer, scheduler)

---

## Requisitos funcionales (RF)
Cada requisito incluye una breve descripción y criterios de aceptación mínimos.

RF-01: Gestión de Clientes
- Descripción: crear, leer, actualizar y eliminar clientes; mantener datos fiscales y contactos.
- Criterio de aceptación: se pueden registrar clientes con Nombres, DNI/RUC, dirección y contactos; validación básica de formato de documento.

RF-02: Gestión de Vehículos
- Descripción: asociar vehículos a clientes, registrar km, historial de servicios y alertas.
- Criterio de aceptación: crear vehículo vinculado a cliente con placa, modelo, año; registrar órdenes históricas.

RF-03: Creación y ciclo de vida de Órdenes de Trabajo
- Descripción: crear órdenes con estado, líneas de servicio, líneas de repuestos, presupuesto, asignación a técnico y seguimiento de estados.
- Criterio de aceptación: orden debe cambiar entre estados predefinidos (creada, diagnóstico, aprobada, programada, en ejecución, finalizada, facturada, cerrada/cancelada) y registrar responsable y timestamps.

RF-04: Diagnóstico y Presupuestado
- Descripción: técnicos registran diagnóstico y generan presupuesto con líneas de mano de obra y repuestos.
- Criterio de aceptación: presupuesto debe poder enviarse al cliente y quedar asociado a la orden; registro de versión y fecha.

RF-05: Verificación, Reserva y Consumo de Inventario
- Descripción: verificar disponibilidad, reservar stock para una orden, convertir reserva en salida al consumir, registrar movimientos.
- Criterio de aceptación: reserva bloquea cantidad disponible; consumo reduce stock y genera movimiento con referencia a orden.

RF-06: Compras y Recepciones
- Descripción: generar órdenes de compra para reponer stock, registrar recepciones parciales y actualizar inventario.
- Criterio de aceptación: PO puede crearse con líneas, el almacén puede registrar recepción parcial/total y stock se ajusta correctamente.

RF-07: Facturación y emisión de comprobantes
- Descripción: generar comprobantes fiscales (factura/boleta) a partir de la orden finalizada, aplicar impuestos y validar datos fiscales.
- Criterio de aceptación: comprobante generado con datos del cliente, detalle de servicios y repuestos; validación previa de RUC/DNI cuando aplica.

RF-08: Pagos y conciliación
- Descripción: registrar pagos (parciales/total), emitir recibos, conciliación contra caja/bancos.
- Criterio de aceptación: pago queda asociado a factura y orden; estado financiero actualizado (pagada/parcial/pendiente).

RF-09: Reportes e indicadores
- Descripción: generar reportes de ventas, stock, rotación, órdenes y KPI (TAT, % aprobaciones, etc.).
- Criterio de aceptación: existencia de reportes predefinidos exportables (CSV/PDF) y ejecución programada.

RF-10: Usuarios, Roles y Permisos
- Descripción: gestionar usuarios y roles con permisos granulares sobre acciones críticas (emitir factura, ajustar stock, cerrar orden).
- Criterio de aceptación: permisos aplicados a acciones; usuarios sin permiso reciben rechazo y registro de evento.

RF-11: Bitácora / Auditoría
- Descripción: registrar acciones críticas (cambios de estado, ajustes de inventario, emisiones, pagos) con usuario y timestamp.
- Criterio de aceptación: cada ajuste financiero o de inventario tiene una entrada de auditoría asociada consultable.

RF-12: Notificaciones y comunicaciones
- Descripción: envío de correos y notificaciones para presupuestos, recepción, entrega y comprobantes.
- Criterio de aceptación: enviar email con adjunto PDF del comprobante y notificaciones de estado al cliente.

RF-13: Procesos en background y scheduler
- Descripción: generación de reportes periódicos, tareas de mantenimiento y reintentos de notificaciones.
- Criterio de aceptación: scheduler ejecuta jobs programados y worker maneja reintentos idempotentes.

RF-14: Importes/Exportes de datos
- Descripción: importación de catálogos y exportación de reportes en formatos estándar.
- Criterio de aceptación: importar CSV con validaciones y exportar reportes en CSV/PDF.

---

## Requisitos no funcionales (NFR)
Requisitos que describen propiedades globales del sistema.

NFR-01: Performance
- Objetivo: operaciones CRUD y validaciones síncronas deben responder en < 300 ms promedio bajo carga normal; procesos pesados (reportes) pueden ser asíncronos.

NFR-02: Escalabilidad
- Objetivo: arquitectura capaz de escala horizontal para servicios críticos (workers, API) y manejo de picos mediante colas.

NFR-03: Disponibilidad
- Objetivo: 99.5% SLA para la API durante horas laborales; degradación controlada para sub-sistemas no críticos (reports, exports).

NFR-04: Consistencia y atomicidad
- Objetivo: operaciones críticas (reserva de stock → consumo → facturación) deben ejecutarse con garantías de atomicidad o proveer mecanismos de compensación explícitos.

NFR-05: Seguridad
- Objetivo: autenticación segura (tokens), autorización por roles/perm, encriptación de datos sensibles en tránsito (TLS) y en reposo cuando aplique.

NFR-06: Auditabilidad y trazabilidad
- Objetivo: registro inmutable/append-only de eventos críticos; capacidad de exportar logs para auditoría.

NFR-07: Integridad y recuperación
- Objetivo: backups regulares (diarios), estrategia de restore y pruebas periódicas de restauración.

NFR-08: Observabilidad
- Objetivo: métricas (latencia, errores, throughput), logging estructurado y alertas para eventos críticos (stock crítico, fallos de facturación).

NFR-09: Usabilidad
- Objetivo: UI/UX pensada para minimizar pasos humanos en recepción y taller; formularios con validaciones y flujos guiados.

NFR-10: Mantenibilidad y testabilidad
- Objetivo: código modular, test coverage razonable para lógica de dominio; despliegues con pipelines y pruebas automatizadas.

NFR-11: Localización y cumplimiento fiscal
- Objetivo: soportar requisitos fiscales locales (ej. facturación electrónica) y formatos requeridos; parametrización por país/región.

---

## Criterios de aceptación globales
- Integridad: las operaciones que impactan inventario y ventas no deben dejar datos inconsistentes (reglas de rollback/compensación).
- Seguridad: accesos no autorizados son bloqueados y registrados.
- Resiliencia: workers deben reintentar tareas transaccionales y escalar errores si alcanzan límites.

---

## KPIs y métricas de verificación (sugeridas para QA)
- TAT medio por orden (ingreso → entrega).
- % órdenes con stock completo al inicio.
- % facturas sin corrección posterior.
- Latencia promedio de endpoints críticos.
- Tasa de errores transaccionales y recuperaciones automáticas.

---

## Supuestos y restricciones
- Supuesto: existe una base de datos relacional y servicios backend que permiten transacciones atómicas o compensaciones.
- Restricción: integración con sistemas externos (e-factura, bancos) sujeta a disponibilidad y latencias de terceros.

---

## Notas operativas / Recomendaciones
- Priorizar la implementación de validación temprana y reservas automáticas para reducir el impacto en TAT.
- Implementar idempotencia en workers y colas para evitar duplicidades.
- Mantener dashboards de operación para detectar desviaciones en KPIs.

