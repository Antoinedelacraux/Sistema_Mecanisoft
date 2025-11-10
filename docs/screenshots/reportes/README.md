# Módulo: Reportes e Indicadores

Propósito
- Generar reportes y métricas (indicadores), programar exportes y gestionar jobs en background.

Proceso (pasos principales)
1. Usuario selecciona reporte y parámetros (rango, filtros, formato).
2. Se envía job a la cola de reportes (background worker).
3. Worker procesa datos, genera CSV/PDF y guarda archivo en storage/export.
4. Usuario descarga el archivo o recibe notificación/email con enlace.

Qué diagramar
- Caso de uso: Ejecutar Reporte, Programar Reporte, Descargar Resultado.
- Actividad: Configurar -> Encolar -> Ejecutar -> Guardar -> Notificar.
- Secuencia: Usuario -> scheduler -> worker -> storage -> notificación.

Capturas necesarias
- `reportes_list.png` — catálogo de reportes y acciones disponibles.
- `reportes_configurar.png` — configuración de parámetros del reporte.
- `reportes_generando.png` — estado del job en background / progress.
- `reportes_resultado_csv.png` — vista del archivo generado y enlace de descarga.

Notas
- Capturar un job largo (si existe) para mostrar la cola y logs del worker.

Actores
- Usuario (solicita reporte)
- Scheduler / Worker (procesa en background)

Precondiciones
- Datos en DB preparados; worker y cola operativos.

Postcondiciones
- Archivo del reporte generado en storage; registro de job completado y notificación enviada.

Datos (entrada/salida)
- Entrada: { reporteId, parametros { fechaInicio, fechaFin, filtros }, formato }
- Salida: { jobId, estado, fileUrl }

Descripción del proceso (orientado a diagramas)

Resumen: generar reportes que pueden ejecutarse en background mediante un scheduler y workers; relevante modelar eventos de encolado, ejecución y entrega de artefactos.

Pasos del proceso (secuencia lógica)
1) Inicio: usuario solicita/ configura reporte con parámetros.
2) Encolar job: frontend crea job y lo envía al scheduler/cola.
3) Ejecución: worker toma job, ejecuta consulta/ agregación y genera archivo (CSV/PDF).
4) Almacenar: guardar archivo en storage y registrar metadata.
5) Notificar: notificar al usuario (UI o email) que el archivo está disponible.
6) Fin: job marcado como completado o failed.

Decisiones clave y excepciones
- Job demasiado grande: dividir en subjobs o ejecutar en modo asíncrono; manejar timeout/memory.
- Error en ejecución: reintentos según política, notificar fallo al solicitante.

Entidades y objetos de datos
- Job (jobId, tipo, parametros, estado)
- File (fileUrl, tamaño, formato)

Mapeo a diagramas
- Caso de uso: actores = {Usuario, Scheduler}; casos = "GenerarReporte", "ProgramarReporte".
- Actividad/BPMN: tareas = [CrearJob, Encolar, EjecutarJob, GuardarArchivo, Notificar]; eventos intermedios para encolado y completado.
- Secuencia: lifelines = {Usuario, Scheduler/Queue, Worker, Storage}; mensajes: CrearJob -> Encolar -> Ejecutar -> Guardar -> Notificar.

