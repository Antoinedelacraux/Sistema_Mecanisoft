## Purpose

Quick ramp-up notes for AI assistants working on this Next.js + Prisma workshop app. Focus on domain-specific flows (clientes, inventario, órdenes) and the guardrails that keep data consistent.

## Core workflows
- Tests use Jest; no package script. Run `npx jest` or scope (e.g., `npx jest tests/lib/ordenes`). UI specs require the default jsdom env declared inside the test files.
- Clean fixtures after integration suites with `tsx prisma/clean-test-data.ts` to reset inventario/orden tables.
- Optional SMTP block (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) powers `src/lib/mailer.ts`. Code throws a descriptive error if host is missing.

- Shared types live in `src/types`, including large DTOs like `InventarioResumenResponse`; UI components consume them directly for prop typing.

- Frontend components lean on shadcn UI primitives (`src/components/ui`) plus the `cn` helper. Respect client/server component boundaries—fetch in server components, mutate via API routes.


## Helpful references

Ping if any section needs more depth (e.g., órdenes flow, PDF facturación, inventario transfers) and we can expand it.
- Domain services and validations sit in `src/lib/**` (e.g., `clientes/validation.ts` normalises payloads, `inventario/reportes.ts` aggregates stock). Favor these helpers from routes/components instead of duplicating logic.
