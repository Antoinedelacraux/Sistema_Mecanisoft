# MecaniSoft - Manual de Instalación Rápida

**Autor:** CHUMBES ESPINOZA MARCO ANTONIO

Este documento acompaña el ZIP que se comparte. Siga los pasos en orden para levantar **MecaniSoft** desde cero. Todo lo que no se mencione es opcional.

## Guía exprés (copiar y pegar)

```powershell
# 1) Instalar dependencias del proyecto
npm install

# 2) Configurar la base de datos (crea DB, aplica migraciones y semillas)
npx prisma migrate reset --force
npm run seed
npx tsx scripts/create-admin-user.ts
npx tsx scripts/seed-sample-data.ts   # opcional: carga datos demo completos

# 3) Levantar el servidor de desarrollo
npm run dev
```

Luego abra `http://localhost:3000` e ingrese con `admin.pruebas` / `Admin123!`.

## 1. Requisitos previos

1. **Node.js 20 LTS** (incluye `npm`). Descárguelo de [nodejs.org](https://nodejs.org) e instale con las opciones por defecto.
2. **Git** (opcional). Solo se necesita si desea clonar; para el ZIP no es necesario.
3. **PostgreSQL 16** o compatible.
   - Descarga desde [postgresql.org/download](https://www.postgresql.org/download).
   - Durante la instalación tome nota de usuario (`postgres`), contraseña y puerto (`5432`).
   - Cree la base vacía `taller_mecanico` con pgAdmin o en consola:
     ```powershell
     createdb -U postgres -h localhost -p 5432 taller_mecanico
     ```
     Ajuste los parámetros si cambió usuario o puerto.
4. **Docker Desktop** solo es necesario si prefiere usar contenedores (ver sección 9).

## 2. Obtener el proyecto

1. Descomprima el archivo ZIP en cualquier carpeta (ej. `C:\MecaniSoft`).
2. Abra PowerShell y ejecute `cd C:\MecaniSoft` para ubicarse en la raíz del proyecto.

## 3. Instalar dependencias

Ejecute una sola vez:

```powershell
npm install
```

Nota: este comando también ejecuta `prisma generate` automáticamente gracias al `postinstall` del proyecto.

## 4. Configurar variables de entorno

1. Copie `.env.example` a `.env` (si el archivo de ejemplo no está, créelo a mano).
2. Actualice como mínimo estas claves:

```env
DATABASE_URL="postgresql://USUARIO:CONTRASENA@localhost:5432/taller_mecanico?schema=public"
NEXTAUTH_SECRET="clave-larga-aleatoria"
NEXTAUTH_URL="http://localhost:3000"
```

Reemplace `USUARIO` y `CONTRASENA` por los datos configurados en PostgreSQL.

## 5. Preparar la base de datos

En la misma terminal, ejecute en orden:

```powershell
npx prisma migrate reset --force   # limpia la base y aplica todas las migraciones
npm run seed                       # inserta catálogos, permisos y parámetros mínimos
npx tsx scripts/create-admin-user.ts
npx tsx scripts/seed-sample-data.ts # opcional: genera datos realistas para probar
```

Puede omitir el último comando si desea comenzar con una base limpia.

## 6. Levantar el servidor

```powershell
npm run dev
```

Abra `http://localhost:3000` en el navegador. El servidor queda activo hasta que cierre la terminal (Ctrl+C).

## 7. Credenciales sugeridas

Los scripts crean usuarios listos para probar:

| Rol                | Usuario           | Contraseña  |
|--------------------|-------------------|-------------|
| Administrador      | `admin.pruebas`   | `Admin123!` |
| Recepción          | `recepcion.lucia` | `Taller123!`|
| Mecánico senior    | `mecanico.jorge`  | `Taller123!`|
| Diagnóstico        | `mecanico.sofia`  | `Taller123!`|

Puede crear más usuarios desde el módulo de administración utilizando la misma interfaz.

## 8. Verificación y pruebas rápidas

1. Inicie sesión como `admin.pruebas`.
2. Revise el dashboard y abra los módulos de Órdenes, Inventario y Reportes para confirmar que los datos demo se cargaron.
3. Si algo luce desactualizado, vuelva a ejecutar `npx tsx scripts/seed-sample-data.ts`.

## 9. Problemas frecuentes

- **No conecta a PostgreSQL:** confirme que el servicio está iniciado, que la base `taller_mecanico` existe y que `DATABASE_URL` tiene usuario/contraseña correctos.
- **Puerto 3000 ocupado:** cierre la aplicación que use ese puerto o ejecute `setx PORT 4000` antes de `npm run dev` y luego ingrese a `http://localhost:4000`.
- **Migraciones fallidas:** ejecute de nuevo `npx prisma migrate reset --force`. Si la DB quedó en un estado incorrecto, elimínela y créela otra vez.
- **Dependencias nativas no compilan:** asegúrese de estar en Node.js 20 LTS, reinstale (`npm install --force`) y vuelva a probar.

## 10. Alternativa con Docker

Para evitar instalar Node.js y PostgreSQL localmente:

1. Instale Docker Desktop y asegúrese de que esté activo.
2. Desde la carpeta del proyecto ejecute:
   ```powershell
   docker compose up --build
   ```
3. Esto levanta dos contenedores (`web` y `db`). La aplicación queda disponible en `http://localhost:3000` una vez que `npm run start` comience a servir.
4. Inicialice la base por única vez (solo la primera vez que levanta los contenedores):
   ```powershell
   docker compose exec web npm run seed
   docker compose exec web npx tsx scripts/create-admin-user.ts
   ```
5. Opcional: cargue datos demo completos dentro del contenedor `web` con:
   ```powershell
   docker compose exec web npx tsx scripts/seed-sample-data.ts
   ```
6. Detenga todo con `docker compose down`. Use `docker compose down -v` si desea borrar la base persistida.

Las credenciales y la `DATABASE_URL` usadas por Docker están definidas en `docker-compose.yml`; modifíquelas si migrará a un entorno público.

### Redis opcional

El proyecto incluye `docker-compose.redis.yml` para lanzar un Redis 7 usado por tareas de cola/cache. Si necesita probar esas funcionalidades, ejecútelo aparte:

```powershell
docker compose -f docker-compose.redis.yml up -d
```

Puede detenerlo con `docker compose -f docker-compose.redis.yml down` cuando termine.
