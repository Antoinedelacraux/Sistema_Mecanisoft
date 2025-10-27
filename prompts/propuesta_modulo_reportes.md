

# Propuesta: Módulo de Reportes

## Resumen ejecutivo
Crear un módulo de Reportes profesional y completo para Sistema_Mecanisoft que permita a usuarios con permisos generar, filtrar, visualizar y exportar reportes operativos, financieros y de indicadores. Debe soportar vistas interactivas (tablas + gráficos), filtros ad-hoc, export a PDF/Excel/CSV, programación de envíos por correo y auditoría de accesos.

Objetivos principales:
- Entregar reportes listos para gestión (ventas, órdenes, inventario, indicadores, bitácora).
- Permitir personalización de filtros, columnas y formatos de export.
- Programar reportes periódicos con envío por email (PDF/Excel).
- Registrar auditoría y trazabilidad de generación/descargas.

Usuarios objetivo:
- Administradores y analistas (reportes financieros y de operación).
- Jefes de taller (reportes de órdenes, tiempos y productividad).
- Contabilidad (exportable a Excel, detallado por movimiento).

---

## Alcance funcional (MVP)
- Página principal de Reportes: lista de plantillas/ reportes disponibles.
- Reporte dinámico por: Ventas, Órdenes, Inventario, Indicadores, Bitácora.
- Filtros comunes: rango de fechas, sucursal/almacén, trabajador/cliente, estado, categoría, producto.
- Visualización: Tabla (paginada) + gráficos (línea/barra/pastel) con posibilidad de agrupar por campo.
- Export: PDF (formato profesional), Excel (.xlsx) y CSV.
- Programación: crear job que genere y envíe reportes por correo en horario/cron.
- Permisos: control por rol/permiso (ver, exportar, programar, eliminar programaciones).
- Auditoría: registrar generación/descarga y parámetros usados en `bitacora` o `reportes_audit`.

Alcance fuera del MVP:
- Designer visual WYSIWYG para crear plantillas (posible Fase 2).
- Data warehouse / OLAP—solo optimizaciones y agregaciones en DB actual.

---

## Requisitos no funcionales
- Exportes en PDF con estilo corporativo y paginación adecuada (cabecera/pie con logo/usuario/fecha).
- Rendimiento: consultas paginadas y con índices para filtros comunes; timeout para consultas pesadas.
- Seguridad: permisos por rol, validación server-side de parámetros, sanitización.
- Escalabilidad: jobs de export se encolan (Redis/Bull o Agenda) y se ejecutan en workers para no bloquear la app.
- Testabilidad: endpoints con cobertura y tests de integración para exportes y programación.

---

## Diseño de datos (sugerencias Prisma)
- Nota: elegir nombres consistentes con convención ya usada (Usuario/Persona/Orden/Producto). Propuesta de tabla para plantillas y programaciones:

```prisma
model ReportTemplate {
  id             Int      @id @default(autoincrement())
  name           String
  description    String?
  key            String   @unique // e.g. "ventas_resumen"
  defaultParams  Json?    // filtros por defecto
  createdAt      DateTime @default(now())
  createdById    Int
  createdBy      Usuario  @relation(fields: [createdById], references: [id_usuario])
}

model ReportSchedule {
  id             Int      @id @default(autoincrement())
  templateId     Int
  template       ReportTemplate @relation(fields: [templateId], references: [id])
  name           String
  cron           String   // cron expression or interval
  recipients     String   // comma-separated emails (o JSON)
  lastRunAt      DateTime?
  nextRunAt      DateTime?
  active         Boolean  @default(true)
  params         Json?    // params used for schedule
  createdAt      DateTime @default(now())
  createdById    Int
}

model ReportAudit {
  id           Int      @id @default(autoincrement())
  usuarioId    Int
  usuario      Usuario  @relation(fields: [usuarioId], references: [id_usuario])
  action       String   // GENERAR, DESCARGA, PROGRAMAR
  templateKey  String?
  params       Json?
  ip           String?
  userAgent    String?
  createdAt    DateTime @default(now())
}
```

Notas:
- Para reportes ad-hoc podemos almacenar `params` en `ReportAudit` para reproducibilidad.
- Si se requiere historial de archivos generados, guardar metadatos en `ReportFiles` (s3 path, size, mime).

---

## Endpoints (API)
- GET /api/reportes/templates — lista de plantillas disponibles (con permisos)
- GET /api/reportes/template/:key — metadata y filtros disponibles
- POST /api/reportes/generate — generar un reporte ad-hoc
  - Body: { key, params, format: 'pdf'|'xlsx'|'csv', preview: boolean }
  - Si preview=true devuelve JSON + datos y gráficos (limitados)
  - Si format y preview=false, encola job de generación o devuelve archivo directo si rápido
- GET /api/reportes/download/:fileId — descarga de archivo generado
- POST /api/reportes/schedules — crear programación (cron)
- GET /api/reportes/schedules — listar programaciones
- PATCH /api/reportes/schedules/:id — actualizar
- DELETE /api/reportes/schedules/:id — eliminar
- GET /api/reportes/audit — historial de generación/descarga (filtrable)

Seguridad:
- Validar `key` contra plantillas autorizadas y parámetros permitidos.
- Todos los endpoints loguean a `ReportAudit`.

---

## UI / UX (propuesta)
1. Página "Reportes" (index)
   - Lista de plantillas/tiles con: nombre, descripción, último envío, botón `Abrir` y `Programar`.
2. Página de plantilla (ej. Ventas - Resumen)
   - Panel izquierdo: filtros (fechas, sucursal, vendedor, producto, agrupar por...)
   - Panel derecho: preview (tabla + gráfico). Botones: "Generar PDF", "Exportar Excel", "Programar".
   - Opciones avanzadas: columnas a incluir, orden de columnas, agrupar/total.
3. Modal Programación
   - Nombre de la programación, cron/intervalo, emails, formato, parámetros por defecto.
4. Página de Programaciones
   - Lista con estado, próximo Run, editar/pausar/eliminar.
5. Página de Historial/Auditoría
   - Lista de eventos de generación/descarga, con detalles y parámetros.

Wireframes: usar los componentes shadcn ya presentes para consistencia visual (inputs, selects, datepickers, tablas paginadas).

---

## Export PDF: recomendaciones técnicas
- Usar un renderer del lado servidor (puppeteer/Playwright o una librería de generación PDF con plantillas HTML/CSS).
- Plantillas HTML con estilos CSS corporativos; incluir header/footer con logo, usuario y fecha.
- Paginación y tablas grandes: usar tablas que rompan por página o partir en secciones.
- Para Excel: usar `exceljs` o similar para generar archivos con formatos, estilos y totales.

---

## Jobs / Scheduling
- Arquitectura: usar una cola (Redis + BullMQ) y workers que ejecuten generación y envío por correo.
- Paso en worker:
  1. Cargar template + params
  2. Ejecutar query/agg en DB (optimizar con índices)
  3. Renderizar PDF/XLSX
  4. Guardar archivo (local `public/exports` o S3) y persistir metadatos
  5. Enviar correo con adjunto o link
  6. Registrar en `ReportAudit`

---

## Permisos y roles
- Permisos sugeridos:
  - reportes.view
  - reportes.export
  - reportes.schedule
  - reportes.manage_templates
  - reportes.view_audit
- Mapear estos permisos a roles existentes (Admin, Contabilidad, Jefes).

---

## Pruebas y calidad
- Unit tests: validación de parámetros, generación rápida (mock DB), endpoints.
- Integration: worker end-to-end en entorno de pruebas (genera archivo en disco y verifica metadatos).
- E2E: Playwright para generar una vista, exportar PDF y verificar contenido básico.
- Performance: pruebas de queries con datos voluminosos (simular meses de ventas).

---

## Migración y backfill
- No es necesario crear datos legacy inmediatamente; reportes usan consultas sobre modelos actuales.
- Si se necesita historial de archivos, añadir `ReportFiles` y backfill con archivos existentes (si aplica).

---

## Plan de implementación (fases y estimación)
Fase 0 — Diseño (1-2 días)
- Reunión con stakeholders, definir plantillas prioritarias (ej. Ventas resumen, Órdenes por estado, Inventario bajo stock).

Fase 1 — MVP (7-10 días)
- Endpoints básicos: templates, generate (preview + export CSV/XLSX simple), audit log.
- UI: listado de plantillas, página de plantilla con filtros y preview (tabla + 1 gráfico).
- Export CSV y Excel con `exceljs`.

Fase 2 — PDF + Programación (5-8 días)
- Renderer PDF (puppeteer/playwright) con plantillas HTML.
- Cola y workers para generación y envío.
- UI para programaciones y listado de envíos.

Fase 3 — Harden + Tests + Permisos (3-5 días)
- Tests, indices DB, validación, caching de queries, permisos y audit.

Total estimado MVP -> producción: 3-4 semanas (depende de revisión y datos reales).

---

## Criterios de aceptación (ejemplos)
- Usuario con permiso genera un reporte de "Ventas Resumen" para un mes y obtiene la descarga en PDF/Excel.
- Programación ejecutada una vez y archivo enviado a la lista de correos.
- Auditoría registra la generación con parámetros reproducibles.
- UI muestra preview paginado y gráfico correspondiente.

---

## Consideraciones operativas
- Evitar ejecutar consultas pesadas en request sync; usar preview limitado y encolar exports pesados.
- Control de tamaños: archivos > X MB deben subirse a storage y no transferirse inline.
- Elegir si los archivos se guardan localmente o en S3 según infra.

---

## Ejemplos rápidos (pseudo-queries)
- Ventas resumen por día:
```sql
SELECT date_trunc('day', v.fecha) as dia, sum(v.total) as total, count(*) as ventas
FROM ventas v
WHERE v.fecha BETWEEN $1 AND $2
GROUP BY dia
ORDER BY dia
```

- Órdenes por estado:
```sql
SELECT o.estado, count(*) as cantidad, sum(o.total) as total
FROM ordenes o
WHERE o.created_at BETWEEN $1 AND $2
GROUP BY o.estado
```

---

## Próximos pasos propuestos
1. Revisar con stakeholders y priorizar 3 plantillas iniciales.
2. Definir almacenamiento (local vs S3) y elegir librería PDF (puppeteer / Playwright).
3. Implementar Fase 1 (endpoints + UI preview + export CSV/XLSX).

---

Si quieres, creo ahora un `prompt` adicional dentro de `prompts/` para usar como descripción de PR (plantilla) o para usarlo como guía para diseñar la UI con componentes existentes. ¿Quieres que genere también los esquemas de endpoints y tests de ejemplo (Jest) como archivos separados?
