# Módulo: Compras y Proveedores


Descripción del proceso (orientado a diagramas)

Resumen: creación y gestión del ciclo de órdenes de compra (PO) incluyendo envío al proveedor y la recepción que impacta inventario. Importante modelar subflujos de recepción parcial y reclamo.

Pasos del proceso (secuencia lógica)
1) Inicio: necesidad de compra detectada (inventario o manual).
2) Crear PO: seleccionar proveedor, líneas y condiciones.
3) Enviar PO: notificar proveedor vía email/integración.
4) Recepción: al recibir mercancía registrar cantidades (parcial/total) y actualizar stock.
5) Discrepancia: si hay diferencia, abrir reclamo y registrar ajuste.
6) Cierre: PO cerrado cuando todas las líneas se han recibido y conciliado.

Decisiones clave y excepciones
- Recepción completa? → si no, flujo de recepción parcial y espera de saldo.
- Discrepancia en cantidades/calidad → abrir reclamo y posible devolución.

Entidades y objetos de datos
- PO (poId, proveedorId, lineas)
- Recepción (recepcionId, poId, cantidadesRecibidas)
- Reclamo (reclamoId)

Mapeo a diagramas
- Caso de uso: actores = {Compras, Proveedor, Almacén}; casos: CrearPO, EnviarPO, RegistrarRecepcion, AbrirReclamo.
- Actividad/BPMN: tareas = [CrearPO, EnviarPO, RegistrarRecepcion, GestionarReclamo]; gateways en recepción completa y reclamo necesario.
- Secuencia: lifelines = {ComprasApp, Proveedor, Almacén, InventarioService}; mensajes: CrearPO -> Enviar -> Recepción -> ActualizarStock -> NotificarCierre.


