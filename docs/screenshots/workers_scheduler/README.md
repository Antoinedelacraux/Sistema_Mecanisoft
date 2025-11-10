# Módulo: Workers / Scheduler

Descripción del proceso (orientado a diagramas)

Resumen: orquestación de jobs programados y trabajadores que procesan tareas en background. Se modela el ciclo de encolado, ejecución, manejo de errores y reintentos.

Pasos del proceso (secuencia lógica)
1) Inicio: usuario o sistema programa/unjob (cron o job único).
2) Encolado: scheduler inserta ejecución en la cola con parámetros y scheduleTime.
3) Ejecución: worker toma el job, procesa la lógica (consulta DB, genera artefactos), y registra resultado/logs.
4) Error handling: si falla, aplicar reintentos basados en política; si excede reintentos, marcar failed y notificar operaciones.
5) Fin: job marcado como completed o failed y resultado accesible.

Decisiones clave y excepciones
- ¿Job completado OK?: si no → reintentar o fallback; si sí → persistir resultado.
- ¿Política de reintentos alcanzada?: si sí → alertar a operador y registrar incidente.

Entidades y objetos de datos
- Job (jobId, tipo, parametros, scheduleTime, estado)
- Execution (executionId, jobId, estado, logs)

Mapeo a diagramas
- Caso de uso: actores = {Usuario/Administrador, Sistema}; casos = "Programar Job", "Ver Ejecución".
- Actividad/BPMN: tareas = [Programar, Encolar, Ejecutar, Reintentar, Notificar]; eventos: Timer, Message.
- Secuencia: lifelines = {Scheduler, Queue, Worker, Storage}; mensajes: ScheduleJob -> PushQueue -> WorkerConsume -> Execute -> PersistResult.


