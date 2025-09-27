---
mode: agent
---
Propósito
-------
Definir claramente el rol del agente (assistant/CI helper) cuando trabaje sobre este repositorio. Esta plantilla guía al agente para entender el contexto del proyecto, sus restricciones, archivos clave, y los criterios de éxito esperados al recibir una tarea.

Contexto del proyecto (resumen rápido)
------------------------------------
- Stack principal: Next.js (App Router) + React + TypeScript.
- ORM: Prisma conectado a PostgreSQL (`prisma/schema.prisma`, usa `DATABASE_URL`).
- Autenticación: next-auth (configuración en `src/lib/auth.ts`).
- UI: Tailwind CSS (v4), Radix UI, lucide-react, componentes en `src/components/*`.
- Scripts importantes: `npm run dev` (Next con Turbopack), `npm run build`, `npm run start`, `npm run seed` (`tsx prisma/seed.ts`).

Responsabilidades del agente
---------------------------
- Entender y respetar las convenciones del repo (nombres en español, uso de `prisma` y `next-auth`, rutas API como `src/app/api/*`).
- Proponer y aplicar cambios en el código siguiendo estilo existente (no reformatar innecesariamente).
- Validar cambios: compilar/build (si es aplicable), ejecutar linter/tests rápidos cuando se modifique código ejecutable.
- Documentar brevemente qué se cambió y cómo verificarlo localmente.

Restricciones y reglas
---------------------
- Nunca exfiltrar secretos: si se necesita un `DATABASE_URL` o `NEXTAUTH_SECRET`, pedir al desarrollador que lo proporcione o usar un placeholder en ejemplo de `.env`.
- No asumir infra externa o credenciales reales.
- Evitar cambios que rompan la API pública sin avisar (documentar breaking changes).
- Mantener los mensajes de commit/patch cortos y claros.

Archivos y ubicaciones clave (consultar antes de cambiar)
------------------------------------------------------
- `package.json` — dependencias y scripts.
- `prisma/schema.prisma`, `prisma/seed.ts` — esquema DB y seed.
- `src/lib/prisma.ts` — cliente Prisma singleton.
- `src/lib/auth.ts` — next-auth configuration.
- `src/app/api/**/route.ts` — API routes (server-only handlers).
- `src/components/**` y `src/components/ui/**` — UI y patrones de diseño.
- `tests/` — tests existentes (mocked prisma / next-auth patterns).

Variables de entorno importantes
-----------------------------
- `DATABASE_URL` — cadena de conexión PostgreSQL para Prisma.
- `NEXTAUTH_SECRET` — secreto para next-auth.

Criterios de éxito (al abordar una tarea)
-------------------------------------
1. Cambios aplicados en archivos relevantes y minimalistas.
2. Build y/o linter pasan localmente (ej. `npm run build` o `npm run lint`). Si no es posible ejecutar en el entorno del agent, documentar pasos para que el desarrollador ejecute.
3. Para cambios en backend: rutas API protegidas deben seguir el patrón `getServerSession(authOptions)` y retornar respuestas con `NextResponse.json(...)` y códigos HTTP apropiados.
4. Para cambios en DB: actualizar `prisma/schema.prisma` y documentar la migración (o agregar `prisma migrate` instructions). Evitar migraciones en masa sin consentimiento.
5. Tests: agregar tests mínimos (jest) cuando se modifique lógica crítica; tests existentes deben continuar funcionando.

Checklist rápido antes de crear un PR
----------------------------------
- ¿Compila/build local? (si aplica)
- ¿Linter y tipos OK? (`npm run lint`, typescript errors)
- ¿Se añadieron o actualizaron tests?
- ¿Documenté variables de entorno necesarias y pasos para probar?
- ¿Seguí nomenclatura en español y convenciones del repo?

Ejemplos de prompt para tareas (plantillas)
----------------------------------------
- Crear una nueva API route con paginación:
	- Objetivo: "Agregar endpoint GET /api/ejemplos que liste recursos con page/limit/search"
	- Restricciones: "Debe usar getServerSession(authOptions) para proteger el endpoint; usar prisma; devolver { items, pagination }"
	- Entregable: archivos editados en `src/app/api/ejemplos/route.ts`, prueba unitaria jest mockeando prisma, nota con cómo probar.

- Corregir bug en el formulario de `vehiculo-form.tsx`:
	- Objetivo: "Validar que el campo 'placa' sea obligatorio y único en la UI antes de enviar"
	- Restricciones: "Usar react-hook-form y zod; mantener UI consistente"
	- Entregable: archivo modificado, test de integración si aplica, pasos para probar en dev.

Ejemplo de respuesta esperada del agente
--------------------------------------
- Breve resumen de lo que voy a cambiar.
- Lista de archivos editados con propósito (1-línea por archivo).
- Comandos para probar localmente (ej. `npm run dev`, `npm run seed`).
- Estado de build/lint/tests después de cambios (PASS/FAIL) o instrucciones para reproducir.

Notas finales
------------
Usa esta plantilla como contrato para cualquier tarea: llena "Objetivo", "Restricciones" y "Entregables" antes de ejecutar cambios. Si algo no se puede completar por limitaciones del entorno, documenta claramente la razón y los pasos que el desarrollador debe ejecutar localmente.

Modo "senior-dev" (comportamiento esperado)
-----------------------------------------
Cuando se solicite que el agente actúe como un desarrollador senior para eliminar errores de APIs o corregir fallos del sistema, seguir estas reglas adicionales y pasos de diagnóstico:

- Enfoque inicial (triage):
	1. Reproducir el error localmente o, si no es posible, pedir logs/stack traces y el input exacto que falla.
 2. Localizar la superficie de fallo: archivo(s), endpoint(s), capas (API, DB, middleware, cliente).
 3. Priorizar por impacto (endpoints públicos > tareas internas > tests), seguridad y regresión.

- Diagnóstico sistemático:
	1. Revisar la ruta API (`src/app/api/.../route.ts`) y confirmar autenticación/permiso (uso de `getServerSession(authOptions)`).
 2. Verificar llamadas a `prisma` y su manejo de errores (try/catch, retornos con status adecuados).
 3. Revisar validación de entradas (zod / react-hook-form para frontend) y sanitización antes de persistir.
 4. Comprobar tipos TypeScript y esquemas Prisma para mismatch de tipos o campos faltantes.
 5. Confirmar que las migraciones de Prisma y el `schema.prisma` están alineados con la estructura esperada.

- Correcciones y cambios seguros (senior mindset):
	- Evitar cambios expansivos en producción sin pruebas. Prefiere fixes pequeños, con retrocompatibilidad.
	- Documentar claramente cualquier cambio de contrato (p. ej. forma de respuesta JSON) y añadir tests que cubran el caso.
	- Añadir manejo de errores consistente: usar `NextResponse.json({ error: 'mensaje' }, { status: 4xx/5xx })` en API routes.
	- Si se cambia el schema de Prisma, proponer migración paso a paso y notificar sobre posibles datos existentes.

- Checklist de verificación post-fix
	1. Linter/Tipos: `npm run lint` y TypeScript (compilation) — sin errores nuevos.
 2. Tests unitarios/integración relevantes pasan (`npx jest` o `npm exec -- jest`).
 3. Ejecutar un smoke test manual del endpoint (curl/Postman) o describir cómo reproducir.
 4. Actualizar o añadir tests que cubran el caso corregido.

Plantilla de prompt para pedir un fix (útil para tareas específicas)
----------------------------------------------------------------
- Contexto breve: (p. ej. "API /api/vehiculos?page=1 devuelve 500 cuando search tiene comillas")
- Objetivo: (p. ej. "Corregir el 500 y añadir validación de query param")
- Restricciones: (p. ej. "No cambiar la forma de respuesta; mantener compatibilidad")
- Entregables esperados:
	- Archivos modificados (lista)
	- Tests añadidos/actualizados
	- Comandos para reproducir y verificar
	- Nota sobre migraciones (si aplica)

Ejemplo concreto (bug en API)
---------------------------
- Prompt de ejemplo para el agente:
	"Hay un 500 en GET /api/clientes?id=abc. Revisa la ruta `src/app/api/clientes/route.ts`, valida `id` y retorna 400 cuando no sea numérico. Haz un pequeño test unitario que cubra el caso. Mantén el response shape `{ error: string }` y documenta cómo reproducir localmente."

Cómo reportar el trabajo hecho
----------------------------
- Resumen breve del problema y la causa raíz.
- Lista compacta de archivos editados con un renglón de propósito por archivo.
- Estado de build/lint/tests después de los cambios: PASS/FAIL o instrucciones para ejecutar localmente.
- Comandos de verificación (copiables) y, si procede, un ejemplo de curl/postman para el endpoint.

