# Propuesta: Modulos Bitacora (Auditoria) y Configuracion de usuario

Objetivo: definir un plan realista para (1) exponer una bitacora centralizada reutilizando la instrumentacion existente y (2) habilitar que cualquier usuario pueda editar su perfil y subir un avatar sin romper los flujos actuales.

## Estado verificado de los modulos implicados

### Bitacora (situacion actual)
- Base de datos: ya existe la tabla `Bitacora` (ver `prisma/schema.prisma`, relacionada con `Usuario`). Hay un modelo separado `BitacoraInventario` para inventario.
- Instrumentacion: casi todos los servicios criticos ya llaman `prisma.bitacora.create` dentro de transacciones (`src/lib/ordenes/*.ts`, `src/lib/permisos/service.ts`, `src/lib/roles/service.ts`, `src/app/api/*`). Las pruebas unitarias (`tests/lib/**`) mockean directamente `prisma.bitacora.create`.
- Falencias: no hay capa de dominio dedicada ni API de lectura (`src/app/api/bitacora/route.ts` esta vacio) y el hook `src/lib/hooks/use-bitacora.ts` accede directo a Prisma (solo usable en server).
- Riesgos a contener: cualquier refactor que cambie el nombre de la tabla o la firma de `prisma.bitacora.create` romperia transacciones existentes y tests. El modulo nuevo debe envolver la tabla actual o crear una vista compatible.

### Configuracion / perfil (situacion actual)
- Base de datos: el modelo `Usuario` incluye `imagen_usuario`, flags de seguridad y referencia unica a `Persona` (donde viven nombre, apellidos, telefono y correo).
- API existente: `/api/usuarios/[id]` permite que administradores editen usuarios, y `/api/usuarios/me/password` ya implementa el cambio de clave para el propio usuario. El endpoint `/api/usuarios/me/route.ts` esta vacio.
- Experiencia de usuario: no hay pagina de perfil (`src/app/configuracion` no existe) ni endpoint para actualizar datos propios. El endpoint `/api/upload` solo maneja imagenes de productos (`/uploads/productos`).
- Riesgos a contener: actualizar `Usuario` debe respetar reglas de bloqueo/desbloqueo, triggers de bitacora y normalizacion de nombres; actualizar `Persona` requiere mantener unicidad de documento/correo. Cambiar la ubicacion de archivos podria romper componentes que leen `/uploads/productos`.

## Roadmap modulo Bitacora
1. **Analisis y normalizacion**
  - Catalogar acciones actuales (`LOGIN`, `CREATE_ROLE`, etc.) y definir taxonomia + metadata extra (tabla, ip, detalle JSON).
  - Crear un adaptador `src/lib/bitacora/log-event.ts` que acepte `{ tx?, usuarioId, accion, descripcion, tabla, detalles, ip }` y delegue en `tx?.bitacora` o `prisma.bitacora` para no romper transacciones.
  - Ajustar las pruebas para mockear el adaptador en vez de `prisma.bitacora.create`.
2. **API y permisos**
  - Implementar `GET /api/bitacora` con filtros (usuario, rango, accion, tabla) y paginacion; proteger con permiso nuevo `bitacora.ver` usando `asegurarPermiso`.
  - (Opcional) exponer `POST /api/bitacora/test` solo en entorno local para registrar eventos manuales.
  - Actualizar `prisma/seed.ts` para crear el permiso y asignarlo al rol admin/gerencia.
3. **UI y DX**
  - Crear `src/app/bitacora/page.tsx` (Server Component) que llame al API y use un client component con filtros + tabla (puede reusar la tabla de `src/components/ui/data-table`).
  - Añadir export CSV y detalle expandible (mostrar JSON `detalles`).
4. **Observabilidad y limpieza**
  - Documentar politicas de retencion (script en `scripts/cleanup-audit.ts`).
  - Añadir pruebas: `tests/lib/bitacora/log-event.test.ts`, `tests/api/bitacora.test.ts`, `tests/ui/bitacoraPage.test.tsx`.

## Roadmap modulo Configuracion (perfil)
1. **Modelo y almacenamiento de avatar**
  - Decidir si se reutiliza `Usuario.imagen_usuario` (recomendado) y añadir helper para componer URLs (`/uploads/avatars`).
  - Crear carpeta `public/uploads/avatars` y endpoint `POST /api/usuarios/me/avatar` (multipart) reutilizando validaciones de `/api/upload` pero con limite 2MB y resizing opcional (Sharp).
2. **API de datos personales**
  - Implementar `GET /api/usuarios/me` para devolver `Usuario` + `Persona` del usuario autenticado.
  - Implementar `PATCH /api/usuarios/me` con esquema Zod que permita actualizar `displayName`, telefono, correo, nombre/apellidos; validar unicidad y reflejar cambios en `Persona`.
  - Registrar en bitacora con nueva accion `UPDATE_PERFIL_PROPIO` reutilizando el adaptador del roadmap anterior.
3. **UI**
  - Crear pagina `src/app/configuracion/page.tsx` (Server Component) que obtenga datos y renderice un formulario cliente con `react-hook-form` y `zodResolver`.
  - Componente `AvatarUploader` que maneje preview, estados de carga y usa el endpoint de avatar.
  - Mostrar toasts (`sonner`) y forzar refresco de sesion (`next-auth` `update` o re-fetch) para reflejar la imagen.
4. **Pruebas y regresion**
  - `tests/api/usuarios-me.test.ts` para GET/PATCH/avatar.
  - `tests/ui/configuracionPerfil.test.tsx` para validar formulario y subida mockeada.
  - Ejecutar `npm run verify` y, en caso de usar Sharp, añadir mock en `jest.setup.ts`.

## Orden recomendado de implementacion
- **Primero: modulo Configuracion.** Motivos: cambios acotados (nuevos endpoints y pagina) que no afectan transacciones globales; depende de la bitacora solo para registrar la accion, lo cual puede usar el adaptador existente sin esperar al UI de bitacora. Entregar antes mejora UX inmediata y desbloquea validacion real.
- **Despues: modulo Bitacora.** Requiere coordinar numerosas dependencias (servicios, pruebas, seeds) y cualquier error puede bloquear procesos criticos (ordenes, roles, permisos). Abordarlo tras consolidar el adaptador reduce riesgo y permite incluir eventos del nuevo perfil.

## Riesgos y mitigaciones identificadas
- Cambiar la tabla `Bitacora` sin un wrapper romperia `await tx.bitacora.create` en transacciones (ordenes, permisos). Mantener compatibilidad mediante el adaptador y evitar renombrar columnas en la primera iteracion.
- El endpoint de avatar debe escribir en una carpeta distinta a productos (`/uploads/productos`) para no interferir con galeria existente. Controlar permisos de filesystem y sanitizar nombre de archivo.
- Actualizar `Persona` puede impactar reportes que asumen campos obligatorios; validar datos y reutilizar normalizadores existentes en `src/app/api/usuarios/controllers/helpers.ts`.
- Actualizar `session.user.image` requiere volver a iniciar sesion o llamar a `next-auth` `update`. Documentar comportamiento para soporte.

## Siguientes pasos ofrecidos
- Puedo crear el adaptador `log-event`, preparar la migracion de permisos y esqueleto de endpoints (`/api/bitacora`, `/api/usuarios/me`) en commits separados.
- Tambien puedo montar los test scaffolds mencionados para facilitar TDD.

Indica que ajuste adicional necesitas o si quieres que comencemos con el scaffold del modulo que elijas.
