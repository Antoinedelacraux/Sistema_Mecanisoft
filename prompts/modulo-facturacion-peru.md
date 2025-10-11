---
mode: agent
---

# Módulo de facturación – Propuesta integral (Q4 2025)
Sistema: Taller Mecánico

## 1. Objetivo
Construir un módulo de facturación que convierta cotizaciones y órdenes de trabajo en comprobantes electrónicos (boletas y facturas), integrándose con el módulo de clientes recientemente actualizado y respetando las reglas de negocio actuales de cotizaciones y órdenes. El módulo debe generar PDFs, mantener correlativos y reflejar el estatus tributario de cada operación, dejando la puerta abierta a integraciones externas cuando el negocio lo requiera.

---

## 2. Dependencias y punto de partida

| Dominio | Qué aporta | Qué exige de facturación |
| --- | --- | --- |
| Clientes (`persona`, `empresa_persona`, `cliente`) | Datos saneados de identificación, nombre comercial, RUC, clasificación por tipo de documento. | Determinar si corresponde boleta o factura, reutilizar datos de contacto, ofrecer selección entre persona vs empresa asociada. |
| Cotizaciones (`modo_cotizacion`) | Tres flujos: solo productos, solo servicios, mixto. Aprobaciones generan payload “listo para facturación” solo cuando son **solo productos**. | Recibir cotizaciones aprobadas sin servicios y generar borrador de comprobante directo. |
| Órdenes de trabajo (`transaccion`) | Derivan de cotizaciones con servicios o mixtas. Solo órdenes completadas, activas y sin comprobante previo se pueden facturar. | Leer totales, ítems (productos/servicios) y metadatos para crear comprobantes. |

**Entrada al módulo**
1. `POST /api/facturacion/cotizaciones`: cotizaciones aprobadas **solo productos** → comprobante borrador inmediato.
2. `POST /api/facturacion/ordenes`: órdenes completadas (generadas desde cotizaciones con servicios o mixtas) → comprobante borrador.

En ambos casos la respuesta es “modo preparación”, y facturación decide si crea borrador, genera PDF, asigna correlativo y marca la orden/cotización como facturada.

---

## 3. Flujo de negocio completo

1. **Preparación**
  - El usuario abre cotización u orden y solicita “Enviar a facturación”.
  - Endpoint correspondiente valida estado y devuelve payload normalizado.
2. **Borrador de comprobante** (UI facturación)
  - Se muestra formulario con: datos del cliente, empresa asociada (si existe), lista de ítems, totales, impuestos.
  - Usuario elige si factura a persona o empresa, define forma de pago, ajusta serie.
  - Sistema determina tipo sugerido (boleta/factura) según reglas (ver sección 4) pero permite override con alertas de cumplimiento.
3. **Emisión**
  - Al confirmar, se guarda en BD, se genera correlativo y se produce PDF.
  - Estado pasa a `emitido`. Se marca la orden como `estado_pago = pendiente` y se vincula `comprobante_id`.
4. **Post-emisión**
  - Registro de evento en bitácora.
  - Se puede enviar por correo/SMS, descargar PDF o anular.
5. **Pagos** (extensión)
  - Registrar pagos parciales o totales asociados al comprobante.
  - Integrar con caja/tesorería futura.

---

## 4. Reglas de boleta vs factura

1. **Determinación automática**
  - Documento del receptor:
    - Longitud 11 (RUC) → `FACTURA`.
    - Otro (`DNI`, `CE`, `PASAPORTE`) → `BOLETA`.
  - Si el usuario selecciona empresa asociada (`empresa_persona`) → `FACTURA` obligatoria.
  - Si la `persona` tiene `tipo_documento = RUC`, se permite emitir factura a su nombre sin empresa asociada.
2. **Override manual**
  - El usuario puede forzar el otro tipo solo tras confirmar un modal con advertencia tributaria.
  - Se registra `override_tipo_comprobante` y `motivo_override` en bitácora.
3. **Validaciones**
  - Factura requiere: RUC válido, razón social y dirección fiscal.
  - Boleta requiere: nombre completo y documento no vacío.
  - Siempre se respeta la edad ≥ 18 años validada en clientes (no se revalida aquí).

---

## 5. Modelo de datos propuesto

### Tabla `facturacion_config`
Configuración global del taller (IGV, series por defecto, rutas de almacenamiento, parámetros fiscales). Un solo registro editable desde UI admin.

### Tabla `comprobante`
| Campo | Descripción |
| --- | --- |
| `id_comprobante` (PK) | Identificador. |
| `origen_tipo` (`cotizacion` \| `orden`) + `origen_id` | Referencia a la entidad originaria. |
| `tipo_comprobante` (`BOLETA`/`FACTURA`) | Determinado por reglas anteriores. |
| `serie`/`numero` | Serie dinámica + correlativo incremental por tipo. |
| `id_persona` | Persona base.
| `id_empresa_persona` | Empresa asociada (nullable).
| `receptor_nombre`, `receptor_documento`, `receptor_direccion` | Snapshot usado para el comprobante (permite overrides temporales).
| `subtotal`, `igv`, `total`, `incluye_igv` | Totales calculados.
| `moneda` (`PEN` por defecto, preparado para USD).
| `estado` (`borrador`, `emitido`, `anulado`, `observado`).
| `pdf_url`, `xml_url` | Rutas de archivos generados.
| `created_by`, `updated_by`, timestamps. |

### Tabla `comprobante_detalle`
| Campo | Descripción |
| --- | --- |
| `id_detalle` (PK) |
| `id_comprobante` (FK) |
| `tipo_item` (`producto`/`servicio`) | Informa cómo se contabiliza.
| `descripcion`, `cantidad`, `unidad_medida` |
| `precio_unitario`, `descuento`, `subtotal`, `igv`, `total` |
| `id_producto` / `id_servicio` opcionales para trazabilidad |

### Tabla `comprobante_pago` (opcional primera iteración)
Permite ligar comprobante con pagos parciales (monto, fecha, método). Si no se implementa aún, se deja `estado_pago` dentro de `comprobante`.

### Tabla `comprobante_bitacora`
Log de cambios: emisión, anulación, envío, override de tipo, reintentos de envío.

> **Nota**: se mantiene integridad con `transaccion` (orden). Si se elimina orden, el comprobante pasa a estado `anulado` automáticamente o se bloquea la eliminación.

---

## 6. Integración con cotizaciones y órdenes

### Cotizaciones solo productos
1. `POST /api/facturacion/cotizaciones` verifica estado `aprobada` y que todos los ítems sean productos (lo actual ya lo hace).
2. Respuesta contiene `tipo_comprobante_sugerido`, ítems y totales.
3. El módulo de facturación crea un comprobante en estado `borrador`, enlazado a la cotización.
4. Al emitir:
  - Se marca la cotización como `facturada` (nuevo campo boolean) para evitar duplicidad.
  - Se puede cerrar el ciclo de aprobación.

### Órdenes de trabajo (servicios o mixto)
1. `POST /api/facturacion/ordenes` ya valida que la orden esté `completado`, `estatus = activo`, `estado_pago ≠ pagado` y sin comprobante previo.
2. La emisión del comprobante actualiza la orden: `estado_pago = pendiente`, `tipo_comprobante =` tipo emitido, `numero_comprobante =` correlativo generado.
3. Si la orden se anula, el comprobante debe pasar a `anulado`, quedando registro en bitácora.

---

## 7. API propuesta del módulo

| Endpoint | Método | Rol |
| --- | --- | --- |
| `/api/facturacion/comprobantes` | `GET` | Listado con filtros por estado, tipo, periodo, cliente, orden origen. |
| `/api/facturacion/comprobantes` | `POST` | Crear comprobante desde payload preparado (cotización/orden). Opcionalmente crear en `borrador` o emitir directo según flag `emitir`. |
| `/api/facturacion/comprobantes/[id]` | `GET` | Detalle completo (encabezado + ítems + bitácora + archivos). |
| `/api/facturacion/comprobantes/[id]` | `PUT` | Actualizar datos antes de emitir (serie, receptor temporal, ítems). Solo si estado = `borrador`. |
| `/api/facturacion/comprobantes/[id]/emitir` | `POST` | Asigna correlativo, calcula totales definitivos, genera PDF/XML, cambia a `emitido`. |
| `/api/facturacion/comprobantes/[id]/anular` | `POST` | Marca como `anulado`, revierte impacto en orden. Requiere motivo. |
| `/api/facturacion/comprobantes/[id]/enviar` | `POST` | Enviar por correo; registra en bitácora. |
| `/api/facturacion/comprobantes/[id]/descargar` | `GET` | Devuelve PDF (stream). |
| `/api/facturacion/series` | `GET/POST` | Administrar series por tipo de comprobante. |
| `/api/facturacion/config` | `GET/PUT` | Gestionar `facturacion_config` (IGV, rutas, credenciales). |

Todos los endpoints requieren sesión (`getServerSession`) y registran acciones en bitácora.

---

## 8. Cálculo de montos e IGV

1. **Configuración**: `facturacion_config.afecta_igv` y `igv_porcentaje` (default 18%).
2. **Precios incluyen IGV**: El usuario puede indicar `precios_incluyen_igv` por comprobante; el backend:
  - Si incluyen IGV → `subtotal = total / (1 + igv%)`, `igv = total - subtotal`.
  - Si no incluyen → `igv = subtotal * igv%`, `total = subtotal + igv`.
3. **Detalle**: cada línea guarda `subtotal_linea`, `igv_linea` y `total_linea` para cuadrar con los libros contables.
4. **Descuentos**: soportar porcentaje o monto según defina el payload. Se reflejan tanto en línea como en totales.

---

## 9. Generación y almacenamiento de PDFs/XML

1. Motor sugerido: `pdfmake` o `@react-pdf/renderer` para PDF server-side (Next.js API route). Template reutiliza branding del taller.
2. Directorio de salida: `public/uploads/comprobantes/{año}/{mes}/`. Guardar PDF y, cuando se integre con un proveedor externo, XML.
3. Guardar hash del archivo para detectar cambios.
4. Endpoint de descarga usa `createReadStream` protegido por sesión.
5. Enviar correo con PDF como adjunto usando provider existente (nodemailer) y plantillas.

---

## 10. UI/UX

### Vista general
- Tabla de comprobantes con filtros (rango fechas, estado, tipo, cliente, serie). Mostrar badges de `boleta`/`factura` y estado actual.
- Botón “Nuevo comprobante” que permite pegar código de cotización/orden o seleccionar desde listado de pendientes.

### Detalle de comprobante
- Tabs: Encabezado, Detalle, Pagos, Bitácora.
- Card para seleccionar receptor (persona vs empresa) y mostrar datos de contacto.
- Resumen de totales con switch “Precios incluyen IGV”.
- Botones: Emitir, Descargar PDF, Enviar correo, Anular.

### Integración con otros módulos
- Cotizaciones: botón “Facturar” visible solo en cotizaciones aprobadas `solo_productos`. Abre modal que redirige a facturación con borrador creado.
- Órdenes: botón “Generar comprobante” en detalle cuando `estado_orden = completado` y sin comprobante.

---

## 11. Validaciones y reglas adicionales

1. No permitir emitir dos comprobantes distintos para la misma orden/cotización (constraint único `unique(origen_tipo, origen_id)` en `comprobante`).
2. Anular requiere:
  - Motivo.
  - Si el comprobante ya se encuentra contabilizado externamente, derivar a nota de crédito (futuro flujo) en lugar de simple anulación.
3. Si el comprobante está en `borrador`, se puede editar libremente. Una vez `emitido`, solo se permiten cambios mínimos (p. ej., correo de envío).
4. Series: mantener tabla `facturacion_serie` con `serie`, `tipo_comprobante`, `correlativo_actual`, `activo`.
5. Auditoría: todas las transiciones guardan usuario, fecha y detalle en `comprobante_bitacora`.

---

## 12. Pruebas y aseguramiento de calidad

1. **Unitarias**
  - Servicios de cálculo de IGV.
  - Determinación de tipo de comprobante.
  - Validación de reglas (cotización solo productos, orden completada, etc.).
2. **Integración (Jest)**
  - `/api/facturacion/comprobantes` con payload de cotización y orden.
  - Emisión → verifica correlativo, estado y vinculación a orden.
3. **E2E (Playwright)**
  - Flujo completo: crear cotización, aprobar, facturar, descargar PDF.
  - Orden con servicio + producto → completar → facturar.
4. **Performance**
  - Generación de PDF < 2s en ambiente local.

---

## 13. Observabilidad y operaciones

1. Logs estructurados por endpoint (`console.error` + metadata) y bitácora funcional.
2. Health checks en `/api/facturacion/health` para validar acceso a storage y base.
3. Métricas básicas: cantidad de comprobantes emitidos por día, total facturado.
4. Alertas cuando haya fallas al generar PDF o enviar correo.

---

## 14. Roadmap sugerido

1. **Iteración 1**
  - Modelo de datos + endpoints CRUD + generación PDF.
  - Integración con cotizaciones/órdenes.
  - UI básica para emitir y anular.
2. **Iteración 2**
  - Gestión avanzada de series visibles en UI.
  - Registro de pagos, conciliación con caja.
3. **Iteración 3**
  - Automatización de envíos por correo y recordatorios.
  - Preparar capa de integración con proveedores tributarios externos cuando se requiera.

---

## 15. Checklist previo a despliegue

- [ ] Migraciones aplicadas (`comprobante`, `comprobante_detalle`, `facturacion_config`, `facturacion_serie`, bitácora).
- [ ] Reindexar datos de clientes para asegurar RUC y razones sociales disponibles.
- [ ] Actualizar seeds para incluir comprobantes de ejemplo.
- [ ] Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm exec -- jest`.
- [ ] Validar manualmente ambos flujos (cotización directa y orden completada).
*** End Patch
