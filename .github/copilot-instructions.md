## Purpose

Quick ramp-up notes for AI assistants working on this Next.js + Prisma workshop app. Focus on domain-specific flows (clientes, inventario, órdenes) and the guardrails that keep data consistent.

## Core workflows
- Dev: `npm run dev` (Turbopack, React 19). Build: `npm run build`. Start: `npm run start`. Lint: `npm run lint`. Seed demo data with `npm run seed` (tsx runner).
- Tests use Jest; no package script. Run `npx jest` or scope (e.g., `npx jest tests/lib/ordenes`). UI specs require the default jsdom env declared inside the test files.
- Clean fixtures after integration suites with `tsx prisma/clean-test-data.ts` to reset inventario/orden tables.

## Environment & integrations
- `DATABASE_URL` for PostgreSQL (see `prisma/schema.prisma`).
- `NEXTAUTH_SECRET` enables JWT sessions; login lives at `src/lib/auth.ts`.
- Optional SMTP block (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) powers `src/lib/mailer.ts`. Code throws a descriptive error if host is missing.

## Architecture snapshot
- App Router (`src/app/**`) with authenticated dashboards under `/dashboard/*`; middleware redirects `/` to `/dashboard` and allows `/login` unauthenticated.
- API routes are grouped by domain (`src/app/api/{clientes, inventario, ordenes,...}`) and always gate with `getServerSession(authOptions)`. Write endpoints wrap changes in Prisma `$transaction` and log to `prisma.bitacora` (see `clientes/route.ts`, `upload/route.ts`).
- Domain services and validations sit in `src/lib/**` (e.g., `clientes/validation.ts` normalises payloads, `inventario/reportes.ts` aggregates stock). Favor these helpers from routes/components instead of duplicating logic.
- Shared types live in `src/types`, including large DTOs like `InventarioResumenResponse`; UI components consume them directly for prop typing.

## Coding patterns to follow
- Spanish domain names everywhere (DB columns, props, UI labels). Keep new identifiers consistent (`numero_documento`, `fecha_registro`, etc.).
- Use Prisma includes to hydrate nested relations exactly like existing handlers (`cliente.persona`, `modelo.marca`, etc.) so tables render without extra fetches.
- Whenever a write changes business data, append a bitácora entry using the session `user.id`. Many routes also capture human-readable `descripcion` strings; reuse that style.
- Validation happens before persistence: prefer the existing Zod or custom validators (`validateClientePayload`, `ordenes/crear.ts`). Return meaningful `{ error: '...' }` payloads instead of throwing.
- Frontend components lean on shadcn UI primitives (`src/components/ui`) plus the `cn` helper. Respect client/server component boundaries—fetch in server components, mutate via API routes.

## Testing guidance
- API tests stub both NextAuth and Prisma. Mirror `tests/api/clientesIdApi.test.ts`: `jest.mock('@/lib/prisma', () => ({ prisma: { ... } }))` and supply every method the handler touches.
- UI tests rely on `@testing-library/react` with mocked `global.fetch`. Utilities like `buildAlmacen` in `tests/ui/almacenesManager.test.tsx` show how to craft Spanish-domain fixtures.

## Helpful references
- `prisma/schema.prisma` documents the full domain (cotizaciones, inventario, bitácora, órdenes). Use it to map foreign keys and enum names.
- `src/app/api/inventario/alertas/cron/route.ts` demonstrates dynamic routes plus auth-protected cron-style jobs.
- `src/app/api/upload/route.ts` pairs file-system writes under `public/uploads/productos` with bitácora logging and content-type/size checks.
- `src/lib/ordenes-utils.ts` contains formatting helpers (`formatDurationRange`, `formatPrice`) expected by dashboard widgets.

Ping if any section needs more depth (e.g., órdenes flow, PDF facturación, inventario transfers) and we can expand it.
