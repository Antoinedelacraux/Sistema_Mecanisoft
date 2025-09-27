## Purpose

This file helps AI coding assistants get productive quickly in this repository. It highlights the app architecture, common patterns, important files, environment requirements, and concrete examples you can follow.

## Quick start (commands discovered in package.json)
- Dev server: `npm run dev` (runs `next dev --turbopack`).
- Build: `npm run build` (runs `next build --turbopack`).
- Start: `npm run start` (runs `next start`).
- Lint: `npm run lint` (runs `eslint`).
- DB seed: `npm run seed` (runs `tsx prisma/seed.ts`).

Note: there is no `test` script in package.json; run tests with `npx jest` or `npm exec -- jest`.

## Environment variables (required/important)
- `DATABASE_URL` — PostgreSQL connection for Prisma (see `prisma/schema.prisma`).
- `NEXTAUTH_SECRET` — next-auth JWT secret used by `src/lib/auth.ts`.

## Big picture / architecture
- Next.js App Router under `src/app` (server and client components). API routes live as `route.ts` files under `src/app/api/*` (e.g., `src/app/api/vehiculos/route.ts`).
- Prisma for DB access; Prisma client wrapper at `src/lib/prisma.ts` uses a `globalForPrisma` pattern to avoid multiple clients in dev.
- Authentication: next-auth with CredentialsProvider in `src/lib/auth.ts`. API routes commonly call `getServerSession(authOptions)` to protect endpoints.
- Types: extended Prisma types live in `src/types/index.ts` (e.g., `VehiculoCompleto`, `ClienteCompleto`). Use these in frontend props and API responses.
- UI: shadcn-style components under `src/components/ui/*` and feature components under `src/components/{clientes,vehiculos,...}`. Icons come from `lucide-react`.

## Key files and what they show
- `src/app/api/vehiculos/route.ts` — canonical example of API routes: pagination (query params `page`, `limit`, `search`, `cliente_id`), returns `{ vehiculos, pagination: { total, pages, current, limit } }`, and uses `getServerSession` + `prisma` + bitácora audit.
- `src/lib/prisma.ts` — Prisma client singleton pattern. Important to import `prisma` from here in server code and tests.
- `src/lib/auth.ts` — next-auth configuration (CredentialsProvider), JWT session callbacks and `session.user.id` set to `token.sub`.
- `src/types/index.ts` — extended types used across components and API responses (useful for generating mocks/tests).
- `src/components/vehiculos/vehiculos-table.tsx` and `vehiculo-form.tsx` — examples of client components consuming API shapes and using `VehiculoCompleto`.
- `prisma/schema.prisma` — canonical DB schema; field names are Spanish (e.g., `año`).

## Conventions & notable project patterns
- Language: variable/DB names and UX are Spanish; mimic naming when adding fields or tests (e.g., `placa`, `año`, `numero_documento`).
- API responses: prefer `NextResponse.json(data, { status })` and return helpful error messages like `{ error: 'No autorizado' }`.
- Auth guard: always call `getServerSession(authOptions)` at the top of API handlers and return 401 if missing.
- Audit: many write operations create a `bitacora` record (see `bitacora.create` in several API routes). Mirror this when adding new write endpoints.
- Prisma usage: use `include` to eager-load relations in API responses (see `vehiculo` endpoint includes `cliente.persona` and `modelo.marca`).
- Pagination: use `page` and `limit` query params, compute `skip = (page-1)*limit`, and return pagination object with `total` and `pages`.

## Testing patterns
- Tests live in `tests/` and mock Prisma and next-auth. Example: `tests/api/clientesIdApi.test.ts` uses `jest.mock('@/lib/prisma', ...)` and mocks `getServerSession`.
- When writing tests, mock `prisma` shape (e.g., `prisma.cliente.findUnique = jest.fn()`) and set return values for each mocked call.

## Common pitfalls and gotchas
- Prisma schema and TypeScript types use Spanish field names including `año` — be careful with encoding and string operations.
- The app uses Next.js App Router; API handlers are server-only and cannot import client-only browser APIs.
- Prisma client singleton must be used to avoid connection storms in dev (see `src/lib/prisma.ts`).

## Small examples
- Fetch list of vehicles (frontend): `GET /api/vehiculos?page=1&limit=10&search=ABC` returns:

  {
    "vehiculos": [ /* VehiculoCompleto[] */ ],
    "pagination": { "total": 42, "pages": 5, "current": 1, "limit": 10 }
  }

- Protected POST (create vehicle): API routes call `getServerSession(authOptions)` and then `prisma.vehiculo.create(...)` followed by `prisma.bitacora.create(...)`.

## When editing the codebase
- Update or reuse types from `src/types/index.ts` for any API response or component prop.
- For new API routes follow the pattern in `src/app/api/*/route.ts`: auth guard, validate inputs, perform prisma operations, return `NextResponse.json(...)`.

If anything here is unclear or you want me to expand a section (tests, db seeding, or a specific feature area), tell me which part to iterate on.
