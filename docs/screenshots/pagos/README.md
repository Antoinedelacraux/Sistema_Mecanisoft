# Módulo: Pagos y Conciliación


Descripción del proceso (orientado a diagramas)

Resumen: registro y conciliación de pagos, con posibilidad de conciliación automática contra extractos bancarios o conciliación manual por parte de tesorería.

Pasos del proceso (secuencia lógica)
1) Inicio: registro de pago asociado a factura/comprobante.
2) Aplicación: sistema aplica monto a factura (parcial o total) y actualiza estado.
3) Conciliación automática: matcher compara extracto bancario con pagos registrados.
4) Conciliación manual: operaciones no reconocidas se revisan y se asignan manualmente.
5) Resultado: factura marcada como pagada y generar recibo/documento de pago.

Decisiones clave y excepciones
- ¿Encontrado en extracto? → si sí, conciliar automáticamente; si no → enviar a revisión manual.
- Pago duplicado o referencia ambigua → marcar para revisión humana.

Entidades y objetos de datos
- Pago (pagoId, facturaId, monto, metodo, referencia)
- Conciliación (matchId, estado)

Mapeo a diagramas
- Caso de uso: actores = {Cliente, Tesorería, Banco}; caso = "Registrar y Conciliar Pago".
- Actividad/BPMN: tareas = [RegistrarPago, AplicarAFactura, ConciliarAutomático, ConciliarManual, GenerarRecibo]; gateways en match automático/no.
- Secuencia: lifelines = {Aplicacion, BancoService, Tesoreria}; mensajes: RegistrarPago -> BuscarMatch -> MatchFound/NoMatch -> Conciliar/EnviarRevision -> ConfirmarConciliacion.


