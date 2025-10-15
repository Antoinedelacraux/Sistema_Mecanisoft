# Propuesta simplificada y práctica para el módulo de Inventario

Objetivo breve
- Entregar un módulo de inventario sencillo, seguro y útil: gestionar proveedores, registrar entradas (compras), registrar salidas (consumos/órdenes), y mantener un historial de movimientos por producto. Aprovechar el módulo existente `producto` para seleccionar ítems.

Principios
- Minimalista: cubrir lo esencial primero (proveedores, compras, inventario por producto y movimientos), luego ampliar (almacenes/ubicaciones, transferencias).
- Seguro: todas las mutaciones en transacciones Prisma y registro de movimientos (historial/auditoría).
- Pragmático: tipos y endpoints claros; UI mínima que permita operar sin fricción.

1) Modelo de datos (mínimo recomendado, Prisma)
```prisma
model Proveedor {
  id_proveedor    Int      @id @default(autoincrement())
  nombre          String
  ruc             String?  @unique
  contacto        String?
  telefono        String?
  correo          String?
  creado_en       DateTime @default(now())
  actualizado_en  DateTime @updatedAt
}

model Compra {
  id_compra       Int      @id @default(autoincrement())
  id_proveedor    Int
  fecha           DateTime @default(now())
  total           Decimal  @default(0)
  estado          CompraEstado @default(RECIBIDO)
  creado_por      Int
  detalles        CompraDetalle[]
  proveedor       Proveedor @relation(fields: [id_proveedor], references: [id_proveedor])
  creado_en       DateTime @default(now())
  actualizado_en  DateTime @updatedAt
}

model CompraDetalle {
  id_compra_detalle Int    @id @default(autoincrement())
  id_compra         Int
  id_producto       Int
  cantidad          Decimal
  precio_unitario   Decimal
  subtotal          Decimal
  compra            Compra @relation(fields: [id_compra], references: [id_compra])
}

model Inventario {
  id_inventario     Int     @id @default(autoincrement())
  id_producto       Int     @unique
  stock_disponible  Decimal @default(0)
  stock_comprometido Decimal @default(0)
  costo_promedio    Decimal @default(0)
  actualizado_en    DateTime @updatedAt
}

model Movimiento {
  id_movimiento     Int     @id @default(autoincrement())
  tipo              MovimientoTipo
  id_producto       Int
  cantidad          Decimal
  costo_unitario    Decimal?
  referencia        String? // e.g. "compra:12" o "orden:45"
  id_usuario        Int
  creado_en         DateTime @default(now())
}

enum MovimientoTipo {
  INGRESO
  SALIDA
  AJUSTE
}

enum CompraEstado { PENDIENTE RECIBIDO ANULADO }
```

Notas:
- `Inventario` es 1 registro por producto (si en el futuro se quiere multi-almacén, cambiar a composite key: product+almacen).
- `costo_promedio` es opcional; actualizarlo en cada compra cuando se requiera.

2) Servicios backend (contratos y reglas)
- Todos los servicios deben ejecutarse en una transacción Prisma.

a) registrarCompra({ id_proveedor, lineas, creado_por })
- lineas: Array<{ id_producto, cantidad, precio_unitario }>
- Pasos:
  1. Crear `Compra` y `CompraDetalle`.
  2. Para cada línea: actualizar/crear `Inventario` (sumar `stock_disponible`) y recalcular `costo_promedio` opcionalmente.
  3. Crear `Movimiento` tipo INGRESO por línea con `referencia = 'compra:<id>'`.
  4. Retornar { compraId, total }.

b) registrarSalida({ id_producto, cantidad, referencia, id_usuario })
- Pasos:
  1. Leer `Inventario` y comprobar stock disponible.
  2. Restar `cantidad` de `stock_disponible` (o fallar con 409 si insuficiente, según política).
  3. Crear `Movimiento` tipo SALIDA.

c) registrarAjuste({ id_producto, cantidad, motivo, id_usuario })
- Aplicar el ajuste (positivo o negativo), crear `Movimiento` tipo AJUSTE y registrar motivo en `referencia`.

d) getStock(id_producto)
- Devuelve: stock_disponible, stock_comprometido, costo_promedio y últimos N movimientos.

3) Endpoints (App Router) — esquemas rápidos
- POST /api/inventario/compras -> registrarCompra
- GET /api/inventario/compras -> listado (filtros: proveedor, fecha)
- GET /api/inventario/compras/[id] -> detalle
- POST /api/inventario/movimientos -> crear movimiento manual (SALIDA/AJUSTE)
- GET /api/inventario/movimientos -> historial / filtros
- GET /api/inventario/stock/[id_producto] -> getStock
- GET/POST /api/inventario/proveedores -> gestionar proveedores

Seguridad: `getServerSession(authOptions)` + permisos (inventario_ver, inventario_editar, inventario_ajustar, inventario_compras).

3.1) Registro de proveedores — propuesta (inventory-only)

- Propósito: permitir crear proveedores ligeros exclusivamente para el flujo de inventario (p. ej. compras rápidas). Esta funcionalidad es intencionalmente minimal y no sincroniza con otras entidades del sistema (como `persona`) en esta fase.

- Restricciones clave:
  - Solo para uso interno del módulo de inventario (compras/entradas). No tocará ni reemplazará procesos de gestión de clientes/empleados en otras áreas.
  - No se crea/actualiza una entidad `persona` en esta iteración; si en el futuro se requiere integración, se hará en una iteración posterior.

- Endpoint (servidor)
  - POST /api/inventario/proveedores
  - Payload (JSON):
    - nombre: string (required) — razón social o nombre
    - ruc: string | null (optional) — validación básica (Perú: 8/11 dígitos)
    - contacto: string | null (optional)
    - telefono: string | null (optional)
    - correo: string | null (optional)
    - nombre_comercial: string | null (optional)

  - Respuestas:
    - 201 { proveedor: { id_proveedor, nombre, ruc, contacto, telefono, correo, nombre_comercial } }
    - 400 { error: '...' } (validación)
    - 401 / 403 para sesión/permiso
    - 500 para errores internos

  - Validaciones recomendadas (Zod):
    - nombre: z.string().trim().min(2)
    - ruc: z.string().regex(/^[0-9]{8,11}$/).optional().nullable()
    - correo: z.string().email().optional().nullable()

  - Flujo del servidor (sencillo):
    1. Comprobar sesión y permiso `inventario.editar`.
    2. Validar payload con Zod.
    3. Crear `proveedor` en la tabla de proveedores dentro de una transacción corta.
    4. (Opcional) Registrar un evento en `bitacora` con `user.id`.

- Contrato del servicio (esqueleto):
  - function registrarProveedor(tx: PrismaClient | TxClient, payload: CreateProveedorPayload, creado_por: number): Promise<ProveedorRecord>
  - errores esperados: VALIDATION_ERROR (400), DUPLICADO_RUC (409), PERMISO (403)

- Formulario UI (simple) — propuesta minimal y comportamiento con compras rápidas
  - Componente: `src/components/inventario/ProveedorForm.tsx` (client component)
  - Campos: `nombre` (input), `ruc` (input), `nombre_comercial` (input), `contacto` (input), `telefono` (input), `correo` (input)
  - Comportamiento:
    - Validación ligera en cliente (requerir `nombre`), deshabilitar botón mientras se envía.
    - POST a `/api/inventario/proveedores` con JSON y mostrar errores del servidor si los hubiera.
    - Al crear correctamente: devolver el proveedor creado al componente padre (p. ej. `CompraRapidaForm`) para que se seleccione automáticamente en el formulario de compra rápida y cerrar el drawer/modal.
  - UX mínimo: un botón 'Crear proveedor' junto al selector/Autocomplete en `CompraRapidaForm` que abre un drawer pequeño con `ProveedorForm`.

Ejemplo de payload que envía el frontend:

```json
{
  "nombre": "Taller Demo SAC",
  "ruc": "20601234567",
  "nombre_comercial": "Taller Demo",
  "contacto": "Juan Perez",
  "telefono": "+51912345678",
  "correo": "contacto@taller.com"
}
```

Notas operativas y prioridades:
  - Diseñar esto para no bloquear el flujo de compras rápidas: endpoint y formulario deben ser lo más livianos posible.
  - Si se requiere más integración (vincular con `persona` u otras entidades), hacerlo en una iteración futura y migrar datos con cuidado.
  - Añadir tests API (happy path + validación) cuando se implemente el endpoint.


4) UI mínima (prioridad)
- Dashboard inventario: KPIs (productos bajo stock, valoración rápida), buscador de producto.
- Proveedores: lista y crear.
- Registrar compra: formulario con autocomplete de productos (usar endpoint de productos), líneas, preview total.
- Movimientos: tabla (filtro por tipo/fecha/producto) y formulario rápido para salidas/ajustes.
- Drawer "Ver stock" en la ficha de `producto` que muestra stock y últimos movimientos.

5) Migración y seed
- Crear migración Prisma con los modelos propuestos.
- Seed opcional:
  - Crear proveedor de prueba y crear entradas iniciales para productos críticos.

6) Tests y calidad
- Unit tests para servicios (jest, mock de Prisma).
- API tests para endpoints clave (validaciones y errores 401/409).
- Añadir `npx tsc --noEmit` y `npm run lint` en el pipeline.

7) Plan incremental de entrega
- Iteración 0: crear modelos + migración + seed mínimo.
- Iteración 1: implementar `registrarCompra`, `getStock`, endpoints básicos y tests unitarios.
- Iteración 2: UI de Registrar Compra + Drawer de stock + pruebas de integración.
- Iteración 3: Reservas (`stock_comprometido`) e integración con órdenes.

8) Consideraciones operativas
- Concurrency: usar transacciones Prisma para evitar condiciones de carrera; documentar políticas de stock insuficiente.
- Decimal handling: convertir `Prisma.Decimal` a number antes de enviar JSON.
- Anulación de compras: implementar creando movimientos inversos o marca ANULADO según política.

¿Quieres que implemente la Iteración 0 (modelos + migración + seed) ahora en el repo? Puedo crear la migración y un seed minimal, o si prefieres comienzo por los servicios/endpoints (Iteración 1).

---

Archivo de referencia: `src/components/productos` debe seguir enlazando al nuevo drawer de stock (botón "Ver stock").

Si confirmas, empiezo a generar los archivos Prisma y los servicios iniciales.

---

## Decisión: migración incremental (no rompiente) — plan recomendado

Vamos a seguir la opción recomendada: implementar el nuevo modelo y los servicios de forma incremental y no rompiente. El objetivo es que el sistema siga funcionando mientras añadimos la nueva capa y migramos datos gradualmente.

Ventajas de este enfoque
- Cero o mínimo downtime en producción.
- Posibilidad de validar con datos reales y revertir cambios si hace falta.
- Permite tener adaptadores que mantengan compatibilidad con endpoints antiguos mientras el frontend se actualiza.

Paso a paso (Iteración 0 — entrega segura)
1) Añadir modelos Prisma propuestos al `prisma/schema.prisma` (nuevas tablas: Proveedor, Compra, CompraDetalle, Inventario, Movimiento, enums).
2) Generar migración local: `npx prisma migrate dev --name inventario_init` y `npx prisma generate`.
3) Crear un seed mínimo (`prisma/seed.ts`) que inserte un `Proveedor` de ejemplo y, opcionalmente, algunos registros iniciales de `Inventario` para productos críticos.
4) Implementar servicios básicos en `src/lib/inventario/`:
  - `getStock(prisma, id_producto)` — consulta el inventario y devuelve movimientos recientes.
  - `registrarCompra(prisma, payload)` — crea compra, actualiza inventario y crea movimientos (esqueleto con transacción).
5) Crear endpoints read-only iniciales para exponer `GET /api/inventario/stock/[id_producto]` y `GET /api/inventario/proveedores`.
6) Añadir tests básicos y `npx tsc --noEmit` para validar tipado.
7) (Opcional) Crear `scripts/backfill-inventario.ts` para mapear datos existentes al nuevo esquema.

Cómo haremos la transición en la práctica
- Primero desplegamos la migración y los endpoints de consulta (sin cambiar comportamiento actual).
- Llenamos `Inventario` con backfill y/o seed en un entorno de staging.
- Implementamos los servicios de escritura (`registrarCompra` y `registrarSalida`) y los endpoints POST pero mantenemos los endpoints antiguos (si existen) hasta que el frontend esté listo.
- Actualizamos la UI gradualmente: primero el drawer `Ver stock`, luego el formulario de compra; al final cambiamos los consumers principales y eliminamos compatibilidad previa.

Comandos útiles (PowerShell)
```powershell
npx prisma migrate dev --name inventario_init
npx prisma generate
# Ejecutar seed (si se añade):
tsx prisma/seed.ts
```

¿Confirmas que proceda con Iteración 0 (añadir modelos + migración + seed + servicios esqueleto)? Si confirmas, empezaré aplicando los cambios en el repo y ejecutaré `npx prisma migrate dev` y `npx tsc --noEmit` aquí para validar.

## Estado Iteración 0 — 14/10/2025
- ✅ Modelos Prisma creados (`Inventario`, `Compra`, `CompraDetalle`, `Movimiento`, enums nuevos) más relaciones inversas.
- ✅ Migración aplicada (`20251014120217_inventario_basico_init`) y cliente Prisma regenerado.
- ✅ Seed actualizado con proveedor demo e inventario base para 3 productos activos.
- ✅ Servicios iniciales en `src/lib/inventario/basico` (`registrarCompra`, `getStock`) con controladores pequeños y transacciones.
- ✅ Endpoints de consulta: `GET /api/inventario/stock/[id_producto]` y `GET /api/inventario/proveedores` con guardas de sesión/permisos.
- ✅ Verificación de tipos (`npx tsc --noEmit`).
- 🔜 Preparar pruebas unitarias y endpoints de escritura adicionales (Iteración 1).

## Estado Iteración 1 — 14/10/2025
- ✅ Servicios adicionales en `src/lib/inventario/basico`: `registrarSalida` y `registrarAjuste` con bitácora y validaciones de stock.
- ✅ Endpoints protegidos:
  - `POST /api/inventario/compras` + `GET /api/inventario/compras` y `GET /api/inventario/compras/[id]`.
  - `POST /api/inventario/movimientos/basico` + `GET /api/inventario/movimientos/basico`.
- ✅ Tipos y errores centralizados (`common.ts`, `types.ts`) para reutilizar validaciones de productos/proveedores.
- ✅ Pruebas unitarias (`tests/lib/inventario/basico/*.test.ts`) cubriendo compras, salidas, ajustes y consultas de stock.
- ✅ Typecheck y suites Jest (`npx tsc --noEmit`, `npx jest tests/lib/inventario/basico`).
- 🔜 Conectar formularios/UI y preparar dashboard simplificado (Iteración 2).

## Iteración 2 en curso — 14/10/2025
- ✅ Dashboard simplificado en `src/app/dashboard/inventario/page.tsx` con KPIs, tablas recientes y refresh en vivo.
- ✅ Formularios cliente:
  - `MovimientoQuickForm` (salidas/ajustes) enlazado a `/api/inventario/movimientos/basico`.
  - `CompraRapidaForm` enlazado a `/api/inventario/compras` con soporte para múltiples líneas.
- ✅ Drawer "Ver stock" (`ProductoStockDrawer`) integrado en la tabla de productos para consultar `GET /api/inventario/stock/[id_producto]`.
- 🔜 Mejorar selectors/autocomplete de productos y proveedores, estilizar tablas y preparar pruebas E2E/UI.
