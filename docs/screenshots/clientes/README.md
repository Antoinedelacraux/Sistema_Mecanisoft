# Módulo: Clientes

Descripción del proceso (orientado a diagramas)

Resumen: gestionar el alta y modificación de clientes, con validación fiscal y asociación a otras entidades (vehículos, órdenes, facturas). Este proceso es atómico desde la perspectiva del flujo de negocio: entrada de datos → validación → persistencia → notificación/log.

Pasos del proceso (secuencia lógica)
1) Inicio: Actor solicita "Crear cliente".
2) Recolección de datos: el sistema obtiene campos obligatorios (tipoDoc, nroDoc, nombre, dirección, contacto).
3) Validación: validar formato, duplicados locales y, si existe integración, validar contra servicio fiscal externo.
4) Persistencia: si la validación es OK, persistir cliente y generar identificador.
5) Post-procesos: asociar vehículo(s) si se indicó; generar evento/entrada en bitácora; notificar al actor.
6) Fin: retorno con resultado (OK / ERROR con motivos).

Puntos de decisión y excepciones (para diagramas de actividad/gateways)
- ¿Documento válido?: si no → flujo de error (mostrar mensaje y terminar). Si sí → siguiente.
- ¿Registro duplicado?: si sí → flujo de resolución (enlazar con cliente existente o marcar duplicado). Si no → persistir.
- Error de servicio externo o DB: flujo de compensación / retry / notificación.

Entidades y objetos de datos a representar
- Cliente (clienteId, tipoDoc, nroDoc, nombre, contacto)
- Vehículo (si se asocia)
- Evento de bitácora (log)

Mapeo a diagramas
- Caso de uso: actores = {Recepción, Administrador}; caso principal = "Registrar/Editar Cliente"; incluir variantes: validación externa, duplicado.
- Diagrama de actividad / BPMN: modelar tareas (Recolección datos → Validar → Persistir → Notificar) y gateways para los puntos de decisión arriba.
- Diagrama de secuencia: lifelines = {Actor, ServicioValidacion, ServicioPersistencia, Bitácora}; mensajes = SolicitarCreacion -> Validar -> RespuestaValidacion -> Persistir -> Confirmación -> Notificar.


