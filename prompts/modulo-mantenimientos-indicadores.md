# Propuesta: Indicadores para Módulo de Mantenimientos

Contexto
--------
Trabajas el sistema organizando los flujos en tres dimensiones: Planificación de mantenimientos, Asignación de recursos y Seguimiento de mantenimientos. Cada dimensión requiere tres indicadores claros, accionables y medibles. Este documento propone 3 indicadores por dimensión, su definición, fuente de datos (tablas/campos), fórmula de cálculo, frecuencia recomendada y cómo mostrarlos en la UI (widget/alerta/report).

Resumen ejecutivo
-----------------
- Objetivo: proporcionar una lista priorizada de KPIs para apoyar decisiones operativas y tácticas en talleres y centros de servicio.
- Enfoque: métricas que midan cobertura/programación, eficiencia en uso de recursos y efectividad del seguimiento (cumplimiento / calidad / tiempos).

Dimensiones e indicadores
-------------------------

## 1) Planificación de mantenimientos
Indicador: Programación y cobertura de mantenimientos planificados.
1.1. Tasa de cobertura de mantenimientos programados (Coverage %)
- Qué mide: porcentaje de activos/vehículos que tienen un mantenimiento programado dentro del horizonte operativo (p.ej. próximos 30 días).
- Fórmula: (Activos con mantenimiento programado en H / Total activos relevantes) * 100
- Fuente de datos: tabla `mantenimientos` (campo `fecha_programada`, `id_activo`), tabla `activos` o `vehiculos`.
- Frecuencia: diaria; actualizar en background cada noche.
- Visualización: KPI con número + barra de objetivo (objetivo ejemplo: 80%). Alerta si < 60%.

1.2. Cumplimiento de planificación (On-schedule %)
- Qué mide: % de mantenimientos que se realizaron dentro de la ventana programada (p.ej. ±2 días).
- Fórmula: (Mantenimientos realizados dentro de ventana / Total mantenimientos completados en periodo) * 100
- Fuente: `mantenimientos` (campos `fecha_programada`, `fecha_realizada`, `estado`).
- Frecuencia: semanal; mostrar evolución 4 semanas.
- Visualización: línea temporal y KPI. Alertas si tendencia decreciente > 10%.

1.3. Tasa de reprogramación (Reschedule %)
- Qué mide: % de mantenimientos planificados que fueron reprogramados al menos una vez.
- Fórmula: (Mantenimientos con reprogramaciones / Total mantenimientos programados en periodo) * 100
- Fuente: `mantenimientos` + `mantenimiento_historial` o `auditorias` si existe (campo `reprogramado` o registros de cambio de `fecha_programada`).
- Frecuencia: diaria/semanal.
- Visualización: KPI + tabla de causas top (razones de reprogramación). Alertas si > 15%.

## 2) Asignación de recursos
Indicador: Uso y eficiencia de técnicos, repuestos y bays.
2.1. Utilización de técnicos (% Utilization)
- Qué mide: porcentaje del tiempo disponible que los técnicos estuvieron asignados a trabajos productivos durante el periodo.
- Fórmula: (Horas productivas asignadas / Horas disponibles) * 100
- Fuente: `trabajos`/`ordenes` (campos `id_trabajador`, `hora_inicio`, `hora_fin`, `estado`), `trabajadores` (horas contratadas/jornada).
- Frecuencia: diario y acumulado mensual.
- Visualización: heatmap por día/técnico + KPI promedio. Alertas si > 90% (riesgo sobrecarga) o < 50% (subutilización).

2.2. Tiempo medio por tarea (Avg Time per Job)
- Qué mide: tiempo promedio desde inicio a finalización por tipo de servicio.
- Fórmula: AVG(fecha_fin - fecha_inicio) agrupado por `tipo_servicio`.
- Fuente: `ordenes`/`tareas` (campos `fecha_inicio`, `fecha_fin`, `servicio_id`).
- Frecuencia: semanal.
- Visualización: tabla con top 10 servicios por tiempo + distribución (boxplot). Alertas cuando una categoría sube > 20% vs baseline.

2.3. Disponibilidad de repuestos críticos (Stock Critical %)
- Qué mide: % de repuestos críticos con stock >= mínimo.
- Fórmula: (Repuestos críticos con stock >= min / Total repuestos críticos) * 100
- Fuente: `inventario_producto` (campos `id_producto`, `stock_disponible`, `stock_minimo`, `es_critico`).
- Frecuencia: diaria.
- Visualización: KPI + listado de repuestos críticos en rojo. Alertas automáticas por e-mail/API cuando stock < mínimo.

## 3) Seguimiento de mantenimientos
Indicador: cumplimiento, calidad y retroalimentación post-servicio.
3.1. Tasa de cierre en tiempo (On-time Close %)
- Qué mide: % de órdenes cerradas dentro del SLA definido (p.ej. 48 horas para trabajos menores).
- Fórmula: (Órdenes cerradas dentro de SLA / Total órdenes cerradas) * 100
- Fuente: `ordenes` (campos `fecha_creacion`, `fecha_cierre`, `prioridad` o `sla`).
- Frecuencia: diaria/semanal.
- Visualización: KPI + segmentación por prioridad. Alertas si cae por debajo del objetivo.

3.2. Re-trabajo / Reapertura rate
- Qué mide: % de órdenes reabiertas o con trabajos adicionales por problemas detectados tras cierre.
- Fórmula: (Órdenes reabiertas / Total órdenes cerradas) * 100
- Fuente: `ordenes` + `orden_historial` o flag `reabierta`.
- Frecuencia: mensual.
- Visualización: KPI + lista de órdenes reabiertas con causas.

3.3. Satisfacción del cliente (CSAT) o feedback post-servicio
- Qué mide: índice promedio de satisfacción recogido tras finalizar trabajo (encuesta simple 1-5 o NPS).
- Fórmula: AVG(score) o % promotores según NPS.
- Fuente: `encuestas`/`feedback` (campos `id_orden`, `score`, `comentario`).
- Frecuencia: en tiempo real (cada envío) agregada semanalmente.
- Visualización: KPI con histórico, wordcloud de comentarios y segmentación por técnico/servicio. Alertas si CSAT < target.

Implementación técnica y origen de datos
---------------------------------------
- Tablas sugeridas donde leer datos:
  - `mantenimientos`, `ordenes`, `tareas`, `trabajos`, `trabajadores`, `inventario_producto`, `producto`, `encuestas`, `mantenimiento_historial`.
- Recomendaciones:
  - Reutilizar y ampliar los servicios/funciones ya presentes en `src/lib/dashboard.ts` como modelos para agregaciones (`getVentasSeries` -> `getMantenimientosSeries`, `getTopProductos` -> `getTopServicios`).
  - Crear endpoints API dedicados bajo `/api/mantenimientos` que devuelvan JSON para los widgets. Asegurar permisos (`mantenimientos.ver`).
  - Cálculos de ventana temporal: usar utilidades de fecha existentes (date-fns) para truncar/normalizar rangos y granularidad.

Visualización y alertas
-----------------------
- Widgets recomendados:
  - KPI small cards (valor + delta vs periodo anterior).
  - Line charts para series temporales (fecha vs volumen/tiempo).
  - Heatmap por técnico/día para utilización.
  - Donut/bar para stock crítico y distribución de causas de reprogramación.
- Alertas:
  - Umbrales configurables (por ejemplo cobertura < 60%, reprogramación > 15%).
  - Alertas push: visual en dashboard + notificación por correo/Slack/endpoint.

Métricas de calidad y validación
--------------------------------
- Validar contra muestras reales de datos antes del despliegue.
- Build small test fixtures (prisma seed) para cada indicador y agregar tests Jest en `tests/lib/mantenimientos.test.ts`.

Prioridad de entrega (MVP)
--------------------------
1. KPI coverage, On-schedule %, Técnico utilization, On-time close %.
2. Reprogramación %, Avg time per task, Re-trabajo rate.
3. Stock crítico %, CSAT, y reports/exports.

Próximos pasos sugeridos
------------------------
- Acordar SLAs y objetivos objetivos por dimensión (valores objetivo).
- Implementar endpoints y un par de widgets server-side que consuman los datos.
- Crear pruebas unitarias de las agregaciones y plantillas de datos (seed) para CI.

---
Document prepared for review. If you want, I can now scaffold the API endpoints and the first widgets for the MVP indicators (coverage, on-schedule, technician utilization, on-time close).