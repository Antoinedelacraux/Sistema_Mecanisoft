# Propuesta de proceso optimizado — Sistema Taller (versión para presentación)

## Resumen ejecutivo
Objetivo: proponer un proceso operativo más eficiente que reduzca tiempos de servicio, minimice faltantes de stock, disminuya el retrabajo en facturación y mejore la experiencia del cliente. La propuesta reordena actividades, automatiza verificaciones críticas, paraleliza tareas seguras y añade compensaciones explícitas para preservar consistencia.

Beneficios esperados (estimaciones conservadoras):
- Reducción de TAT (ingreso → entrega): 25–40%
- Reducción de stockouts en órdenes críticas: 40–60%
- Menos retrabajo por errores fiscales: 60–80%
- Menor carga administrativa: 30–50%

---

## Principios de diseño
- Validación temprana: checks de datos cliente/fiscales al agendar o ingreso.
- Paralelización controlada: diagnóstico y verificación de partes corren en paralelo cuando sea seguro.
- Automatización de inventario: reservas automáticas, reorder rules y safety stock dinámico.
- Facturación optimizada: pre-validación fiscal y emisión rápida de comprobantes.
- Registro móvil: técnicos y almacén usan app para registrar consumos por escaneo.
- Comunicación basada en eventos: colas/ event-bus para tareas asíncronas con idempotencia.
- Transacciones con compensaciones: definir claramente cómo revertir acciones en fallos.

---

## Flujo optimizado (alto nivel) — para modelar en un único BPMN
1. Cliente solicita servicio o agenda cita.
2. Pre-check automático (validación de cliente/fiscal y chequeo de alertas de vehículo). Si hay error, solicitar corrección inmediatamente.
3. Tras el pre-check, lanzan en paralelo:
   - Diagnóstico por técnico (humano).
   - Verificación automática de stock por Inventario; si falta, auto-generar PO y marcar líneas pendientes.
4. Presupuesto enviado al cliente con opción de aprobación digital; al aprobar, confirmar reservas o priorizar compra urgente.
5. Preparación y ejecución: reservar piezas disponibles y asignar técnico; permitir ejecución parcial donde aplique.
6. Registro de consumos en móvil por técnico (scan) → actualización inmediata de Inventario.
7. Al cierre técnico, disparar facturación automática: usar pre-validación fiscal; si falla, abrir corrección sin bloquear otros procesos.
8. Cobro y conciliación automática; en caso de pago parcial, programar follow-up (timer) y bloquear estados necesarios.
9. Notificación automática y entrega; generación de reportes en background y registro de auditoría.

---

## Cambios concretos por módulo (qué implementar y valor)
- Recepción / Agenda
  - Implementar pre-check web/form al reservar y en kiosco de recepción.
  - Valor: evita bloqueos en facturación y reduce idas/venidas.

- Diagnóstico / Taller
  - Lanza diagnóstico inmediatamente y usa checklist digital; permite iniciar trabajo no dependiente de piezas faltantes.
  - Valor: reduce tiempos muertos.

- Inventario / Almacén
  - Reserva automática al aprobar presupuesto; reglas de reorder automático; safety stock dinámico.
  - Valor: menos stockouts y menos POs urgentes.

- Compras / Proveedores
  - Auto-PO para necesidades críticas, recepción por escaneo y notificaciones automáticas.
  - Valor: visibilidad y menos gestión manual.

- Facturación / Caja
  - Pre-validación fiscal en ingreso; emisión automática al cierre técnico si todo está OK; flujos de corrección en paralelo si hay errores.
  - Valor: menos re-trabajo y emisión más rápida.

- Pagos y Conciliación
  - Enlace de pago automático, conciliación por matcher y reglas de tolerancia.
  - Valor: reduce conciliación manual y errores.

- Reportes e Indicadores
  - KPIs near-real-time y alertas operativas (stock crítico, órdenes retrasadas).

- Notificaciones & Auditoría
  - Mensajería transaccional y registro append-only no bloqueante.

---

## Arquitectura BPMN sugerida (cambios respecto al actual)
- Después de "Aprobación presupuesto" abrir dos ramas paralelas (AND):
  - Ramo A: Diagnóstico / Preparación del trabajo (humano, tareas que puedan avanzarse sin piezas faltantes).
  - Ramo B: Verificación/Reserva en Inventario + Auto-PO (automático).
- Unir las ramas en un join condicional antes de "Programar trabajo"; permitir continuar si las tareas esenciales están cumplidas.
- Subprocess "Trabajo parcial": permite completar actividades que no dependan de piezas pendientes.
- Transaction Subprocess para "Reservar + Ejecutar + Facturar" con compensación definida.
- Event-based gateway para esperar recepción de proveedor sin bloquear otras tareas.

---

## Nuevas reglas de negocio y excepciones
- Auto-PO: generar PO si stock < reorder_threshold y existe orden con prioridad.
- Prioridad de reserva: órdenes taller > ventas mostrador.
- Política JIT moderada para piezas con lead_time corto.
- Modo offline para e-factura: encolar comprobantes si servicio externo cae.

---

## Métricas (qué medir y objetivos)
- TAT (ingreso→entrega): meta reducción 25% primer año.
- % órdenes con stock completo en primer intento: +50%.
- % facturas sin corrección: > 90%.
- % conciliación automática: > 90%.

---

## Roadmap de implementación (fases)
- Fase 0 — Preparación (2–4 semanas): mapear, KPIs baseline, priorizar SKU.
- Fase 1 — MVP (6–10 semanas): pre-check, reserva automática, app móvil básica, facturación mínima.
- Fase 2 — Automatización avanzada (8–12 semanas): auto-PO, conciliación bancaria, notificaciones completas.
- Fase 3 — Optimización y forecasting (12+ semanas): forecasting simple y optimización safety stock.

---

## Recursos, riesgos y mitigaciones
- Recursos sugeridos: PM, analista procesos, 2 devs backend, 1 frontend, integrador pagos, QA, técnico datos.
- Riesgos: integraciones externas, resistencia al cambio, datos insuficientes para forecasting.
- Mitigaciones: pilotos, capacitación, empezar con reglas simples.

---

## Artefactos para la propuesta
- Diagrama BPMN optimizado (.bpmn).
- Comparativa Antes / Después (diagrama + tabla de impactos).
- Plan piloto con métricas y responsables.
- Mockups app móvil (registro de consumos) y formulario de aprobación digital.

---

## Siguientes pasos (elige una)
1. Genero el archivo BPMN optimizado (.bpmn) y lo guardo en `docs/` (recomendado para demo). 
2. Preparo la comparativa visual "Antes vs Después" en Markdown con un PNG/SVG del diagrama (requiere render del BPMN).
3. Entrego la lista con IDs y nombres exactos de las nuevas tareas/gateways para pegar en un modelador.
4. Elaboro plan piloto detallado con cronograma y checklist de QA.

Indica la opción que prefieres y la genero.
