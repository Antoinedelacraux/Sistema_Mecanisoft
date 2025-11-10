# Módulo: Vehículos


Descripción del proceso (orientado a diagramas)

Resumen: alta y asociación de vehículos a clientes, con flujos simples de validación y asociación al historial de órdenes/servicios.

Pasos del proceso (secuencia lógica)
1) Inicio: actor solicita "Registrar Vehículo".
2) Recolección de datos: placa, marca, modelo, año, km, clienteId.
3) Validación: comprobar formato de placa y existencia previa (duplicados).
4) Asociar a cliente: si cliente no existe → crear cliente (subflujo), si existe → vincular.
5) Persistencia: guardar vehículo y generar evento en bitácora.
6) Fin: resultado OK/ERROR.

Puntos de decisión y excepciones
- ¿Placa válida? → si no, error y terminar.
- ¿Placa ya registrada? → si sí, ofrecer enlace a registro existente o permitir actualización.

Entidades y objetos de datos a representar
- Vehículo (vehiculoId, placa, modelo, km)
- Cliente (clienteId)
- Evento/log

Mapeo a diagramas
- Caso de uso: actores = {Recepción, Administrador}; caso principal = "Registrar Vehículo".
- Actividad: tareas = [Recolección datos, Validar duplicado, Asociar cliente, Persistir, Notificar]; gateways en duplicado y cliente existente.
- Secuencia: lifelines = {Actor, ServicioValidacion, ServicioPersistencia}; mensajes para validar placa y persistir entidad.


