# Módulo: Inventario y Repuestos


Descripción del proceso (orientado a diagramas)

Resumen: gestión del ciclo de vida del inventario en respuesta a solicitudes de consumo (órdenes), recepciones de compra y ajustes. Clave para diagramas son los puntos donde inventario interactúa con ordenes y compras (reservas y recepciones).

Pasos del proceso (secuencia lógica)
1) Inicio: solicitud de reserva por una Orden o petición manual.
2) Comprobar disponibilidad: consultar stock por SKU/ubicación.
3) Reservar o bloquear: si hay stock suficiente, reservar la cantidad; si no, señalizar la falta y generar PO (subproceso).
4) Confirmar salida: cuando el material se consuma, registrar movimiento de salida con referencia a la orden.
5) Recepción: al recibir compras, registrar cantidades (parcial/total) y actualizar stock.
6) Ajustes: registrar ajustes por discrepancias, con motivo y responsable.
7) Fin: actualizar inventario y generar eventos/log.

Decisiones clave y excepciones
- ¿Stock suficiente?: si no → crear PO (subproceso) y notificar al solicitante.
- Recepción parcial: flujo de actualización parcial y posible espera de saldo restante.
- Ajustes (inventario negativo o diferencias): flujo de corrección y auditoría.

Entidades y objetos de datos
- SKU / Producto (skuId, ubicaciones, stockDisponible)
- Reserva (ordenId, cantidadReservada)
- Movimiento (tipo, cantidad, referencia)
- PO (poId) cuando aplica

Mapeo a diagramas
- Caso de uso: actores = {Taller/Recepción, Almacén, Compras}; casos: ReservarStock, RegistrarSalida, RegistrarRecepcion.
- Actividad/BPMN: tareas = [ComprobarStock, Reservar, CrearPO, RegistrarSalida, RegistrarRecepcion, AjustarInventario]; gateways en stock suficiente y recepción completa/parcial.
- Secuencia: lifelines = {Orden, InventarioService, ComprasService}; mensajes: SolicitarReserva -> RespuestaStock -> Reservar/CrearPO -> ConfirmarSalida -> ActualizarStock.


