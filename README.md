This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Ordenes de trabajo

- Los servicios de orden (`src/lib/ordenes/crear.ts` y `src/lib/ordenes/actualizar.ts`) utilizan validaciones con [Zod](https://zod.dev). El esquema `actualizarOrdenSchema` asegura que cualquier actualización incluya identificadores válidos, estados permitidos y montos positivos.
- Las pruebas unitarias de estos servicios viven en `tests/lib/ordenes/crearOrden.test.ts` y `tests/lib/ordenes/actualizarOrden.test.ts`, donde se mockean las dependencias de Prisma e inventario.
- Para ejecutar únicamente esta batería puedes usar:

```powershell
npx jest tests/lib/ordenes
```

## Permisos y verificación rápida

- El seed (`npm run seed`) ahora crea también los permisos `servicios.*`, `cotizaciones.*`, `tareas.*` y `reportes.ver`. Después de reseed recuerda volver a iniciar sesión para que la sesión consuma los permisos actualizados.
- Agregamos un set de pruebas enfocadas en los guardas de permisos:
	- API servicios: `tests/api/serviciosApi.test.ts` y `tests/api/serviciosIdApi.test.ts`
	- API reportes de inventario: `tests/api/inventarioReportesApi.test.ts`
	- UI `ServiciosTable`: `tests/ui/serviciosTable.test.tsx`

Para ejecutar todas ellas en bloque:

```powershell
npx jest tests/api/serviciosApi.test.ts tests/api/serviciosIdApi.test.ts tests/api/inventarioReportesApi.test.ts tests/ui/serviciosTable.test.tsx
```

## Problema común en Windows: bloqueo de Prisma

En sistemas Windows es posible que `npx prisma generate` falle con un error EPERM al renombrar archivos temporales del cliente Prisma (`query_engine-windows.dll.node.tmp`). Para mitigarlo hemos añadido un script de ayuda:

```powershell
$env:DATABASE_URL = 'postgresql://user:pass@localhost:5432/tu_bd'
npm run prisma:fix-locks
```

El script eliminará archivos `*.tmp` en `node_modules/.prisma/client` y volverá a ejecutar `npx prisma generate`. Si el problema persiste, cierra procesos `node`/VSCode y ejecuta `takeown` / `icacls` como sugiere el script.


## Script DX `npm run verify`

Se añadió un script de verificación básica que encadena linting, chequeo de tipos y el paquete de pruebas anteriores:

```powershell
npm run verify
```

Internamente ejecuta:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:critical`

⚠️ El chequeo de tipos (`tsc --noEmit`) expone deuda técnica previa (principalmente sesiones opcionales) y hoy rompe la cadena. Mantuvimos ese comportamiento para visibilizar los pendientes; corrige los errores reportados antes de abrir PRs.

## Módulo de indicadores (MVP)

- Al ejecutar `npm run seed:indicadores` se genera un dataset sintético (~100 registros) con órdenes demo, mantenimientos reprogramados, técnicos y repuestos críticos para validar los KPIs.
- Los indicadores viven en `src/lib/indicadores/mantenimientos.ts`; hay endpoints REST bajo `/api/indicadores/*` protegidos por los permisos `indicadores.ver` o `mantenimientos.ver`.
- La vista `/dashboard/indicadores` consume directamente esos servicios en el servidor e incluye cards KPI, donut por prioridad y heatmap de utilización.
- Pruebas unitarias en `tests/lib/indicadores/mantenimientos.test.ts` cubren cálculos principales (coverage, on-schedule, utilización y cierre en SLA).
- Puedes precargar el cache de KPIs con `npm run indicadores:warm-cache`. Acepta flags opcionales (`--from`, `--to`, `--window-days`, `--ttl-hours`, `--indicators`, `--sla`) y, por defecto, recalcula los últimos 30 días con `force=true`.
