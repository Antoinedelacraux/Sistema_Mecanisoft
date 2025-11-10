# Módulo: Facturación / Comprobantes / Cotizaciones


Descripción del proceso (orientado a diagramas)

Resumen: emisión de comprobantes fiscales a partir de órdenes finalizadas, incluyendo validaciones fiscales, generación de comprobante/PDF y comunicación con servicios externos (e-factura) si procede.

Pasos del proceso (secuencia lógica)
1) Inicio: Orden lista para facturar.
2) Preparar comprobante: seleccionar tipo (factura/boleta), calcular totales e impuestos.
3) Validar datos fiscales: cliente, serie/número y reglas locales.
4) Emitir comprobante: persistir comprobante y asignar serie/número fiscal.
5) Generar artefactos: PDF y metadata (url, hash).
6) Notificar/Enviar: enviar al cliente y/o ente fiscal; registrar estado de envío.
7) Fin: comprobante registrado y disponible en historial.

Decisiones clave y excepciones
- ¿Validación fiscal OK?: si no, flujo de rechazo y corrección; si sí, continuar a emisión.
- ¿Respuesta ente fiscal (si aplica)?: si rechazado, registrar motivo y ruta de corrección.
- Error en generación de artefacto (PDF): reintentar generación.

Entidades y objetos de datos
- Comprobante (comprobanteId, tipo, serie, numero, estado)
- Orden (ordenId)
- Archivo/PDF (fileUrl, hash)

Mapeo a diagramas
- Caso de uso: actores = {Cajero, Cliente, ServicioFiscal}; caso = "Emitir Comprobante".
- Actividad/BPMN: tareas = [PrepararComprobante, ValidarFiscal, Emitir, GenerarPDF, Enviar]; gateways en validación y respuesta fiscal.
- Secuencia: lifelines = {Aplicacion, ServicioFiscal, Storage, Cliente}; mensajes = SolicitarEmision -> ValidarFiscal -> Respuesta -> ConfirmarEmision -> GuardarPDF -> Enviar.


