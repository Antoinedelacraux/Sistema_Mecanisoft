# Módulo: Notificaciones / Mailer

Descripción del proceso (orientado a diagramas)

Resumen: gestión de plantillas y envío de notificaciones (email/SMS) disparadas por eventos de negocio; incluye encolado, procesamiento por workers y reporting de estado (éxito/error).

Pasos del proceso (secuencia lógica)
1) Inicio: evento de negocio (p. ej. factura emitida, cita agendada) dispara la creación de un mensaje.
2) Construcción del mensaje: seleccionar plantilla, rellenar variables y preparar payload.
3) Encolado: el mensaje se encola en la cola de notificaciones para envío asíncrono.
4) Envío por worker: worker extrae mensaje, llama al proveedor SMTP/API y registra la respuesta.
5) Manejo de errores: en caso de fallo, aplicar política de reintentos o registrar fallo y notificar al operador.
6) Fin: registrar estado final (enviado/failed) y almacenar log para auditoría.

Decisiones clave y excepciones
- ¿Proveedor responde OK?: si no, reintentar según política; si sigue fallando, marcar failed y notificar.
- ¿Faltan variables en plantilla?: bloquear envío y solicitar corrección.

Entidades y objetos de datos
- Mensaje (mensajeId, plantillaId, destinatario, variables, estado)
- Envío (envioId, proveedorResponse, intentos)

Mapeo a diagramas
- Caso de uso: actores = {Sistema, Operador}; casos = "Crear/Editar Plantilla", "Enviar Notificación".
- Actividad/BPMN: tareas = [GenerarMensaje, Encolar, ProcesarWorker, EnviarProveedor, RegistrarResultado]; gateways en respuesta proveedor y variables completas.
- Secuencia: lifelines = {Aplicacion, Queue, Worker, ProveedorSMTP}; mensajes: CrearMensaje -> Encolar -> WorkerProcess -> LlamarProveedor -> Respuesta.


