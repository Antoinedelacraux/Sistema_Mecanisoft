# Módulo Roles — Propuesta de diseño e implementación

## Objetivo
Crear un módulo independiente para administrar roles y permisos en el sistema MecaniSoft. Debe permitir crear/editar/eliminar roles, asignar permisos por módulo, y exponer estos roles para que otros formularios (por ejemplo, el módulo Trabajadores) puedan seleccionar roles existentes.

## Alcance
- Modelo de datos (Prisma): `rol`, `permiso`, `modulo`, `rol_permiso`.
- API: CRUD de roles, listado de permisos agrupados por módulo, endpoints para asignar/quitar permisos.
- Frontend: Lista de roles, creación/edición de role (incluye selector de módulos y permisos), integración en formulario de Trabajadores.
- Auditoría: Registrar en `bitacora` todas las acciones críticas (crear, actualizar, eliminar, asignar permisos).
- Tests: Unitarios para controladores y mocks de Prisma; E2E básicos para flujo de creación y asignación.

## Razón y prioridades
- Seguridad y control de accesos centralizados.
- Prevenir retrabajo: otros módulos deben leer roles desde una fuente única.
- Flexibilidad: permitir roles compuestos y granularidad por módulo.

## Modelo de datos sugerido (Prisma)

Modelo principal (esquema simplificado):

```prisma
model Rol {
  id_rol        Int      @id @default(autoincrement())
  nombre_rol    String   @unique
  descripcion   String?
  fecha_creacion DateTime @default(now())
  activo        Boolean  @default(true)
  permisos      RolPermiso[]
}

model Modulo {
  id_modulo     Int    @id @default(autoincrement())
  clave         String @unique // ej: 'trabajadores', 'inventario', 'ventas'
  nombre        String
  descripcion   String?
  permisos      Permiso[]
}

model Permiso {
  id_permiso    Int     @id @default(autoincrement())
  clave         String  @unique // ej: 'trabajadores.ver', 'trabajadores.editar'
  nombre        String
  moduloId      Int
  modulo        Modulo  @relation(fields: [moduloId], references: [id_modulo])
  rolPermisos   RolPermiso[]
}

model RolPermiso {
  id_rol_permiso Int   @id @default(autoincrement())
  rolId          Int
  permisoId      Int
  rol            Rol    @relation(fields: [rolId], references: [id_rol])
  permiso        Permiso @relation(fields: [permisoId], references: [id_permiso])
  fecha_asignado DateTime @default(now())
  @@unique([rolId, permisoId])
}
```

Notas:
- `Permiso.clave` debe usarse como identificador estable en código.
- `Modulo.clave` sirve para agrupar permisos en la UI.

## Permisos recomendados por módulo (ejemplos)
- trabajadores: trabajadores.ver, trabajadores.crear, trabajadores.editar, trabajadores.eliminar, trabajadores.asignar_roles
- inventario: inventario.ver, inventario.crear, inventario.editar, inventario.eliminar, inventario.transferir
- ventas: ventas.ver, ventas.crear, ventas.facturar, ventas.reversar
- usuarios: usuarios.ver, usuarios.crear, usuarios.editar, usuarios.eliminar, usuarios.asignar_roles
- reportes: reportes.ver, reportes.generar, reportes.descargar
- dashboard: dashboard.ver
- auditoria: auditoria.ver

Podemos pre-popular la tabla `modulo` y la tabla `permiso` durante la migración/seed inicial.

## API — Endpoints sugeridos
Todos los endpoints deben protegerse con los guards de NextAuth y el helper `asegurarPermiso(session, 'roles.administrar')` cuando se requiera.

- GET /api/roles — listar roles (filtros: activo/inactivo, búsqueda)
- POST /api/roles — crear rol
- GET /api/roles/:id — detalle rol (incluye permisos)
- PUT /api/roles/:id — actualizar rol (nombre, descripción, activo)
- DELETE /api/roles/:id — baja lógica / eliminar
- GET /api/roles/permisos — listar permisos agrupados por módulo (para UI)
- POST /api/roles/:id/permisos — asignar permisos (body: permisoIds[])
- DELETE /api/roles/:id/permisos/:permisoId — quitar permiso

Contratos (ejemplo):
- POST /api/roles body:
```json
{ "nombre_rol": "Supervisor", "descripcion": "Supervisa taller" }
```
- POST /api/roles/:id/permisos body:
```json
{ "permisos": ["trabajadores.ver", "trabajadores.editar"] }
```

Respuesta estándar: `{ role: {...}, permisos: [...] }` o `{ error: '...' }`.

## Frontend — UX propuesta
Pantallas:
- Lista de Roles: tabla con nombre, descripción, permisos contados, estado, acciones (ver, editar, asignar permisos, eliminar)
- Formulario Crear/Editar Rol: nombre, descripción, activo, asignación rápida de permisos.
- Selector de permisos: panel con módulos como secciones (accordion) y checkboxes por permiso; botón "Seleccionar todo módulo".
- Integración con Trabajadores: al abrir el `TrabajadorForm`, el select de roles obtiene `GET /api/roles` y muestra `nombre_rol` (añadir opción AUTO para inferir por cargo). Cambios en roles deben reflejarse inmediatamente en el select (refetch tras crear/editar).

Accesibilidad y UX:
- Mostrar badges para permisos clave (ej. 'admin', 'auditor').
- Confirmaciones al eliminar y mensajes en toast al asignar permisos.

## Bitácora / Auditoría
Registrar acciones en `prisma.bitacora` con:
- id_usuario: quien realiza la acción
- accion: CREATE_ROLE, UPDATE_ROLE, DELETE_ROLE, ASSIGN_PERMISSION, REVOKE_PERMISSION
- descripcion: texto humano legible (ej. "Asignado permiso trabajadores.editar al rol Supervisor")
- tabla: 'rol' o 'permiso'

La UI de Auditoría podrá filtrar por tabla/acción/usuario, rango de fechas y módulo.

## Tests
- Unit: mocks para controladores de `createRole`, `assignPermissions`, validar que se llama a `bitacora` y que no existan duplicados.
- Integration: endpoints protegidos con NextAuth mock; escenarios happy path y errores (permiso duplicado, rol inexistente).

## Migraciones y seed
- Añadir migración que crea tablas `rol`, `modulo`, `permiso`, `rol_permiso`.
- Seed: popular `modulo` y `permiso` con las claves sugeridas; crear roles base: 'Administrador', 'Supervisor', 'Mecánico', 'Recepcionista' con permisos iniciales.

## Impacto en otros módulos
- `TrabajadorForm`: cambiar el fetch de roles para llamar a `GET /api/roles` (actualmente consume `roles` de algún lugar). Asegurarse que el valor `rol_usuario` coincida con `nombre_rol` o `id_rol` según preferencia (recomiendo usar `nombre_rol` como valor legible y `id_rol` internamente).
- `Permisos/guards`: adaptar `asegurarPermiso` para validar `permiso.clave` existente y mapear roles a permisos actuales via join en Prisma.
- Documentar nuevas migraciones para despliegue.

## Criterios de aceptación
- CRUD roles implementado y cubierto por tests mínimos.
- UI permite asignar permisos por módulo y ver permisos asociados a cada rol.
- TrabajadorForm muestra roles actualizados en su selector sin recargar la app.
- Bitácora registra todas las acciones críticas.

## Roadmap de implementación (tareas sugeridas)
1. Modelar tablas en Prisma + migración + seed (modulos/permisos base)
2. Implementar helpers de permisos y guards (`asegurarPermiso` updates)
3. Crear endpoints API (list, CRUD, assign/revoke)
4. Frontend: lista, create/edit modal, selector de permisos
5. Integrar roles en `TrabajadorForm` y en otros formularios que creen usuarios
6. Tests + QA
7. Documentación de uso y despliegue
