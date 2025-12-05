## Purpose

Short, targeted guidance for AI coding agents working in this repository. Focus: get productive quickly by understanding the app architecture, developer workflows, conventions, and where to find domain logic.

## Big-picture architecture (what matters)
- Next.js App Router app in `src/app` (server-first where possible). Prefer server components for data-fetching and use API routes for mutations.
- Prisma + PostgreSQL for persistence: schema in `prisma/schema.prisma`, migrations in `prisma/migrations/` and seeds in `prisma/seed.ts` and `prisma/seed-indicadores.ts`.
- Domain logic lives in `src/lib/*` (validation, services, report aggregators). UI primitives/components live under `src/components` and `src/components/ui` (shadcn).
- Shared TypeScript types are in `src/types` and are canonical for DTOs used by both server and client code.

## Developer workflows & useful commands
- Install: `npm install` (repo uses npm; `postinstall` runs `prisma generate`).
- Dev: `npm run dev` (Next dev with turbopack). Build/start: `npm run build` / `npm run start`.
- Tests: Jest is used. Run all or scope: `npx jest` or `npx jest tests/lib/ordenes`.
- Critical verification script: `npm run verify` (lint + typecheck + a set of critical tests).
- Seeds and scripts: `npm run seed`, `npm run seed:indicadores`, plus helpful scripts in `scripts/` (e.g., `scripts/create-admin-user.ts`, `scripts/seed-sample-data.ts`).
- Prisma helpers: `prisma/clean-test-data.ts` (tsx script used by tests); use `npx prisma migrate reset --force` for local resets when needed.

## Repo-specific conventions & patterns (concrete)
- Server vs Client components: fetch data in server components under `src/app` and call `src/lib/*` services; use API routes (or client actions) for mutations so server-side validation/permissions are centralized.
- Domain services are the single source of truth: prefer `src/lib/clientes/*`, `src/lib/inventario/*`, `src/lib/ordenes/*` rather than duplicating logic in routes/components.
- Permission/role model: seeds create granular permissions (see `prisma/seed.ts` and scripts that grant permissions). Tests often assert permission guards—use seed data for realistic scenarios.
- UI primitives: `src/components/ui` are shadcn-based; use the existing `cn` utility for consistent class composition.

## Integration points & important envs
- Database: `DATABASE_URL` (Postgres). Migrations and deploy scripts assume Prisma is used (`prisma migrate deploy`).
- Auth: NextAuth configured; `NEXTAUTH_SECRET`, `NEXTAUTH_URL` required for local dev.
- Mailer: `src/lib/mailer.ts` requires SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). If `SMTP_HOST` is missing the code throws a descriptive error—tests may mock mailer.

## Files & folders to check first when making changes
- `src/lib/*` — domain services, validations, report aggregators (use these when editing business logic).
- `src/types` — shared DTOs and TypeScript definitions.
- `src/app` — routing and page/server components (App Router).
- `prisma/schema.prisma` and `prisma/migrations/` — change DB model here and add migrations.
- `scripts/` — handy maintenance scripts (seed, backfill, grant permissions, fix prisma locks).
- `tests/` — examples of how domain code is mocked and tested (use patterns there when adding tests).

## Examples (copyable patterns)
- Run Jest for a focused suite:
	- `npx jest tests/api/serviciosApi.test.ts`
- Reset DB + seed (local dev):
	- `npx prisma migrate reset --force`
	- `npm run seed`
- Clean test fixtures after integration suites:
	- `npx tsx prisma/clean-test-data.ts`

## Error handling & validation patterns
- **Service-layer errors**: Use custom error classes (e.g., `OrdenServiceError`) with `(status: number, message: string, payload?: Record<string, unknown>)` signature for typed error handling.
- **Input validation**: Zod schemas in `src/lib/*/validators.ts` (e.g., `actualizarOrdenSchema`, `ordenItemSchema`); wrap ZodError with service error and include `issues` array in payload.
- **API routes**: Catch service errors in try/catch, respond with `NextResponse.json({ message, ... }, { status })` matching the error's status code. Use `asegurarPermiso` guard to throw `PermisoDenegadoError` or `SesionInvalidaError`.

## Inventory & stock management
- **Core flows**: `src/lib/inventario/services.ts` handles transfers, reserves, and movements. Reserves are transactional (`reservarStockEnTx`, `confirmarReservaEnTx`, `liberarReservaEnTx`) and attached to orders.
- **Alertas**: Stock alerts monitored via `src/lib/inventario/alertas.ts`; use `MovimientoOrigen` enum (purchase, transfer, order, adjustment) to track movement source.
- **Stock sync**: `sync-producto-stock.ts` reconciles computed stock with cached values after bulk movements.

## Indicators & caching strategy
- **Cached indicators**: Use `withIndicatorCache()` from `src/lib/indicadores/cache.ts` for expensive computations (default 12h TTL, forceable via `force: true` option).
- **Hash-based invalidation**: Indicators cached with MD5 hash of `{ indicador, from, to, parametros }`.
- **Warm-up script**: `npm run indicadores:warm-cache` pre-computes KPIs; use in deployment or high-traffic scenarios.

## Testing & mocking conventions
- **Mock auth**: Use `jest.mock('next-auth/next')` and override `getServerSession` to return mock session with `user: { id, email, ... }`.
- **Mock services**: Prisma methods, permisos guards, and mailer are pre-mocked in `jest.setup.ts`; override per test as needed using `(prisma.model.method as jest.Mock).mockResolvedValue(...)`.
- **Test cleanup**: After integration suites, run `npx tsx prisma/clean-test-data.ts` to reset test fixtures. Use `npx prisma migrate reset --force` for full DB reset locally.

## Quick notes for AI agents
- Prefer reading service files in `src/lib` to understand rules (e.g., orden creation/updates). The README includes many concrete references to `src/lib/ordenes/*` and indicator services.
- Use existing seeds and tests as canonical examples for valid data shapes and permissions.
- Keep edits minimal and follow ex

  isting style: TypeScript + Next.js App Router patterns, shadcn UI primitives, and Zod for validation.
- When adding API endpoints, place them in `src/app/api/{feature}/route.ts`, validate input with Zod, use service layer for logic, catch errors with proper HTTP status codes.

---
If anything here is unclear or you want more detail on a specific area (orders flow, inventory transfers, indicator caching, or test strategy), ask.
