# Módulo: Órdenes de Trabajo


Descripción del proceso (orientado a diagramas)

Resumen: ciclo de vida de una orden de trabajo que coordina múltiples participantes (recepción, diagnóstico, inventario, cliente, ejecución, facturación). El flujo incluye reservas, aprobaciones y potenciales subprocesos (compras cuando faltan piezas).

Pasos del proceso (secuencia lógica)
1) Inicio: Recepción crea la orden con cliente y vehículo.
2) Diagnóstico: técnico agrega líneas de servicio y repuestos requeridos.
3) Verificación de stock: el sistema consulta inventario y realiza reserva o marca faltantes.
4) Presupuesto: se compila presupuesto y se envía al cliente.
5) Aprobación: cliente acepta o rechaza el presupuesto.
6) Ejecución: si aprobado, técnicos realizan trabajo, registran horas y consumos; movimientos de inventario se confirman.
7) Facturación: al completar, se genera comprobante y se factura la orden.
8) Cierre: orden marcada como cerrada y registro en bitácora.

Decisiones clave y excepciones (para activity/gateways)
- ¿Stock disponible?: sí → reservar y continuar; no → crear PO (subproceso) y notificar al cliente si se retrasa.
- ¿Cliente aprueba presupuesto?: sí → ejecutar; no → cerrar flujo con rechazo o replanificación.
- Errores en ejecución (falta de piezas en taller, técnico no disponible): ramas de replanificación.

Entidades y objetos de datos
- Orden (ordenId, estado, clienteId, vehiculoId)
- LineaServicio (descripcion, cantidad, precio, skuId)
- ReservaInventario / PO
- Presupuesto (presupuestoId, estado)

Mapeo a diagramas
- Caso de uso: actores = {Recepción, Técnico, Almacén, Cliente, Facturación}; casos: Crear Orden, Generar Presupuesto, Aprobar, Ejecutar Trabajo, Facturar.
- Actividad/BPMN: modelar tareas principales y subprocesos (ReservarStock → CrearPO → RecepciónCompra); gateways en stock/aprobación.
- Secuencia: lifelines = {Recepción, Inventario, Técnico, Cliente, Facturación}; mensajes: CrearOrden -> SolicitarReserva -> ReservaConfirmada -> EnviarPresupuesto -> Aprobación -> EjecutarTrabajo -> GenerarFactura.


