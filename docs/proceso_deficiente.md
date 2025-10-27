# Proceso deficiente (legacy) — descripción para comparación

Este documento describe el proceso operativo antiguo/deficiente que sirve como línea base para comparar la propuesta optimizada. Está pensado para evidenciar cuellos de botella, fallos frecuentes y métricas actuales que justifican la mejora.

---

## Resumen ejecutivo
El proceso legacy sigue un flujo altamente secuencial, con validaciones tardías, fuerte dependencia de tareas manuales y poca o nula automatización. Esto provoca demoras, errores recurrentes en inventario y facturación, y elevada carga administrativa.

Problemas observados:
- Validaciones fiscales y de cliente realizadas al final del proceso (bloqueos en facturación).
- Verificación de stock manual y secuencial (diagnóstico → inventario → compra), lo que genera esperas largas.
- POs gestionadas manualmente y recepciones con registro en papel o entrada tardía.
- Registro de consumo por parte de técnicos en papel o en hojas de cálculo (errores de registro y demora en actualización de stock).
- Facturación manual o semi-manual tras cierre técnico (alta tasa de correcciones por datos inválidos).
- Notificaciones y reportes ejecutados manualmente, sin alertas proactivas.

Impacto típico:
- Alto TAT (ingreso → entrega) por esperas secuenciales.
- Alto porcentaje de órdenes con piezas faltantes al iniciar el trabajo.
- Alto retrabajo en facturación (correcciones y reemisiones).

---

## Flujo paso a paso (legacy)
1. Cliente llega o agenda cita.
2. Recepción crea la orden manualmente y registra datos del cliente/vehículo.
3. Orden enviada a taller; técnico diagnostica y arma presupuesto.
4. Recepción/Taller llama o reenvía el presupuesto al cliente (telefónicamente o en papel).
5. Cliente aprueba (a veces en persona; muchas veces vuelve luego para aprobar).
6. Solo después de la aprobación, alguien (manual) consulta Inventario para verificar piezas.
   - Si hay stock: se asignan las piezas manualmente y se prepara la orden.
   - Si no hay: Compras es notificada manualmente; PO se crea y envía por email/WhatsApp; se espera la llegada física.
7. Recepción/Almacén registra la llegada de mercancía en tazas (tardío), ajusta stock manualmente.
8. Trabajo se programa manualmente y se ejecuta cuando todo está listo; técnicos anotan consumos en papel.
9. Al finalizar, recepcionista o administrativo consolida hojas y genera la factura.
10. Se intentan validar los datos fiscales en forma manual; si hay errores, la factura no se puede emitir y se requiere corrección (cliente vuelve o se solicita documentación adicional).
11. Pago registrado manualmente; conciliación bancaria es manual y lenta.
12. Reportes y KPI se generan periódicamente (mensual o semanal) con extracción manual de datos.

---

## Problemas clave y cuellos de botella (detallados)
- Validación tardía de datos fiscales
  - Causa: verificación al final del ciclo.
  - Efecto: retrabajo y demora para entregar comprobante; posible necesidad de reemisión.

- Secuencialidad estricta entre diagnóstico e inventario
  - Causa: nadie verifica stock hasta aprobar presupuesto.
  - Efecto: tiempos de espera altos y múltiples regresos de clientes.

- Gestión manual de compras y recepciones
  - Causa: procesos sin automatización ni escaneo.
  - Efecto: retrasos en reabastecimiento, errores de cantidad, falta de visibilidad.

- Registro en papel de consumos
  - Causa: ausencia de app o escaneo en taller.
  - Efecto: discrepancias en stock, pérdidas de piezas, mayor tiempo administrativo.

- Facturación y conciliación manual
  - Causa: validaciones y conciliaciones no integradas.
  - Efecto: errores en facturas, tiempo de caja largo, problemas contables.

---

## Fallos operativos recurrentes (ejemplos reales)
- Orden esperó 3 días porque la pieza se pidió tarde (PO tardía) y recepción no la registró a tiempo.
- Factura rechazada por RUC/DNI inválido: cliente tuvo que volver y proceso se retrasó 2 días.
- Doble consumo de una pieza por falta de registro oportuno —inventario negativo hasta reconciliación.

---

## Métricas estimadas del proceso legacy (baseline)
- TAT medio (ingreso → entrega): 3.5–5 días (dependiendo de la necesidad de PO).
- % órdenes con falta de stock al iniciar trabajo: 35–60%.
- % facturas con correcciones posteriores: 20–35%.
- Tiempo promedio emisión de comprobante desde cierre técnico: 6–48 horas.
- % conciliación automática: < 30% (mayoría manual).

---

## Mapeo BPMN simplificado (para comparar con optimizado)
- Lanes: Cliente | Recepción | Taller | Inventario | Compras | Facturación | Pagos | Administración.
- Start Event: Ingreso cliente.
- Tasks principales:
  - Recepción: "Crear orden", "Registrar datos".
  - Taller: "Diagnosticar", "Preparar presupuesto".
  - Recepción: "Enviar presupuesto (manual)".
  - Cliente: "Aprobar (presencial/retorno)".
  - Inventario: "Verificar stock (manual)".
  - Compras: "Generar PO manual".
  - Almacén: "Registrar recepción (manual)".
  - Taller: "Ejecutar trabajo (consumo en papel)".
  - Administración: "Consolidar y facturar manualmente".
- Gateways: decisiones humanas dependientes de acciones fuera del sistema (p.ej. aprobación del cliente en persona).

---

## Por qué el proceso es útil como baseline para la propuesta
- Claramente muestra puntos de ineficiencia que la propuesta optimizada ataca: validación tardía, procesos secuenciales, ausencia de automatización de inventario, falta de movilidad para el registro de consumos y conciliación manual.
- Permite medir mejora (reducción TAT, menor % stockouts, reducción de re-trabajo fiscal) cuando se implemente el proceso optimizado.

---

## Recomendación para la presentación comparativa
- Mostrar lado a lado: diagrama BPMN legacy vs BPMN optimizado (.bpmn).
- Incluir tabla con métricas baseline vs metas post-optimización.
- Presentar 2–3 casos reales (anécdotas) que ejemplifiquen la diferencia en tiempos y re-trabajo.


