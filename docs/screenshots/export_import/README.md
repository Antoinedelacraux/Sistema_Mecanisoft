
# Módulo: Export / Import

Descripción del proceso (orientado a diagramas)

Resumen: importar y exportar datos en formatos CSV/Excel. El proceso de import valida esquema, transforma filas opcionales, aplica inserciones/actualizaciones por lotes y produce un log de errores por fila. Export genera artefactos filtrados y los deja disponibles para descarga o envío.

Pasos del proceso (secuencia lógica)
1) Inicio: usuario selecciona acción (Importar o Exportar) y define parámetros (tipo, mapeo de columnas, opciones de actualización).
2) Validación previa (Import): analizar esquema y mostrar preview; si el preview detecta errores críticos, detener y pedir corrección.
3) Encolado/Ejecución: si procede, crear ImportJob/ExportJob y encolar para procesamiento por lotes en worker.
4) Procesamiento por lotes (Import): transformar filas, validar por fila, aplicar inserciones/actualizaciones; registrar RowError por fila inválida según política (continuar o detener).
5) Generación de artefacto (Export) / Resultado (Import): almacenar archivo exportado o registrar métricas de import (importados, actualizados, fallidos) y generar log de errores.
6) Notificación y entrega: notificar al usuario y poner a disposición el artefacto o el log.
7) Fin: operación completada con resumen y link de descarga si aplica.

Decisiones clave y excepciones
- ¿Esquema válido en preview?: NO → informar y detener (no aplica cambios).
- ¿Modo estricto?: si sí → detener ante la primera fila inválida; si no → registrar error y continuar.
- ¿Tamaño del export supera umbral?: si sí → procesar como job asíncrono y notificar cuando esté listo.

Entidades y objetos de datos
- ImportJob (jobId, tipo, mapping, modoStrict, estado)
- RowError (filaIndex, motivo, data)
- ExportFile (fileId, filtros, url, estado)

Mapeo a diagramas
- Caso de uso: actores = {Usuario, Sistema/Worker}; casos = "Importar Datos", "Exportar Datos".
- Actividad/BPMN: tareas = [Upload/Preview, ValidarEsquema, EncolarJob, ProcesarLote, RegistrarErrores, GenerarResumen/Export]. Gateways en ValidarEsquema y en política de manejo de errores.
- Secuencia: lifelines = {UserUI, AppServer, Worker, DB, Storage}; mensajes típicos: SubmitImport -> PreviewValidate -> EnqueueJob -> ExecuteBatch -> PersistResults -> NotifyUser/ProvideDownload.


