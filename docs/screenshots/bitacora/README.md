# Módulo: Bitácora / Auditoría

Descripción del proceso (orientado a diagramas)

Resumen: registrar de forma inmutable eventos relevantes del sistema para trazabilidad (creaciones, modificaciones, eliminaciones y errores). El proceso es simple pero crítico para auditoría y se debe modelar como un flujo que intercepta acciones y persiste eventos.

Pasos del proceso (secuencia lógica)
1) Inicio: acción crítica ejecutada por un actor (crear/editar/eliminar/ajustar).
2) Generación del evento: el componente que procesa la acción construye el payload con metadata (usuario, timestamp, entidad, before/after).
3) Persistencia: enviar evento al servicio de bitácora (sync o async) y guardar en almacenamiento (DB/append log).
4) Indexado/consulta: el evento queda disponible para consultas por filtros (usuario, entidad, fecha) y para export.
5) Fin: confirmar persistencia o fallar con reintento/alerta.

Decisiones clave y excepciones
- ¿Persistencia exitosa?: si no → reintento o fallback (cola) y notificar a operaciones; si sí → confirmar.
- ¿Evento sensible (datos personales)?: aplicar redacción/mascarado antes de persistir.

Entidades y objetos de datos
- Evento (eventoId, entidad, accion, usuarioId, before, after, timestamp, metadata)

Mapeo a diagramas
- Caso de uso: actores = {Usuario, Auditor}; caso = "Registrar Evento" / "Consultar Bitácora".
- Actividad/BPMN: tareas = [InterceptarAccion, ConstruirEvento, PersistirEvento, Indexar/Notificar]; gateway en persistencia OK/FAIL.
- Secuencia: lifelines = {Actor, Aplicacion, BitacoraService, Storage}; mensajes: EjecutarAccion -> CrearEvento -> Persistir -> Confirmación.


