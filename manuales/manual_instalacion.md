# Manual de Puesta en Marcha

Este manual explica cómo levantar el sistema **MecaniSoft** en una máquina que no tiene las herramientas instaladas. Sigue cada sección en orden.

Acceso demo pública: https://sistema-mecanisoft-z2td.vercel.app/

## 1. Programas necesarios

1. **Node.js 20 LTS** (incluye `npm`). Descarga desde [https://nodejs.org](https://nodejs.org) e instala con las opciones por defecto.
2. **Git** (opcional pero recomendado para clonar repositorios). Disponible en [https://git-scm.com](https://git-scm.com).
3. **PostgreSQL 16** o compatible.
   - Descarga: [https://www.postgresql.org/download](https://www.postgresql.org/download)
   - Durante la instalación anota:
     - Usuario administrador (por defecto `postgres`).
     - Contraseña asignada al usuario `postgres`.
     - Puerto (por defecto `5432`).
   - Al finalizar, crea la base de datos vacía `taller_mecanico` usando **pgAdmin** o la línea de comandos:
     ```bash
     createdb -U postgres taller_mecanico
     ```
     Ajusta el usuario y puerto si utilizas otros valores.
4. **Docker Desktop** (opcional, solo si quieres levantar todo con contenedores). Descarga desde [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) e instala siguiendo el asistente.

## 2. Preparar el proyecto

1. **Descomprimir** el código fuente en la carpeta de tu preferencia.
2. Abrir una terminal (PowerShell en Windows) dentro de la carpeta del proyecto.
3. Instalar dependencias:
   ```powershell
   npm install
   ```

## 3. Configurar variables de entorno

1. Copiar el archivo de ejemplo `.env.example` (si existe) o crear `.env` en la raíz.
2. Asegúrate de definir la cadena de conexión de la base de datos:
   ```env
   DATABASE_URL="postgresql://USUARIO:CONTRASENA@localhost:5432/taller_mecanico?schema=public"
   NEXTAUTH_SECRET="clave-larga-aleatoria"
   NEXTAUTH_URL="http://localhost:3000"
   ```
   Sustituye `USUARIO` y `CONTRASENA` por los datos reales del servidor PostgreSQL.

## 4. Inicializar la base de datos

En la misma terminal, ejecuta los siguientes comandos en orden:

1. Crear esquemas y datos base:
   ```powershell
   npx prisma migrate reset --force
   npm run seed
   ```
2. Registrar usuario administrador estándar:
   ```powershell
   npx tsx scripts/create-admin-user.ts
   ```
3. Poblar datos de demostración coherentes para todos los módulos (clientes, trabajadores, inventario, órdenes, etc.):
   ```powershell
   npx tsx scripts/seed-sample-data.ts
   ```

> Si deseas una base vacía, omite el último comando.

## 5. Levantar el servidor de desarrollo

1. Ejecuta:
   ```powershell
   npm run dev
   ```
2. Abre [http://localhost:3000](http://localhost:3000) en un navegador.

## 6. Credenciales de acceso

Los scripts anteriores generan los siguientes usuarios de prueba:

| Rol                | Usuario           | Contraseña  |
|--------------------|-------------------|-------------|
| Administrador      | `admin.pruebas`   | `Admin123!` |
| Recepción          | `recepcion.lucia` | `Taller123!`|
| Mecánico senior    | `mecanico.jorge`  | `Taller123!`|
| Diagnóstico        | `mecanico.sofia`  | `Taller123!`|

El sistema obliga a cambiar la contraseña si una cuenta tiene clave temporal; estos usuarios ya tienen credenciales definitivas.

## 7. Verificación rápida

1. Inicia sesión como `admin.pruebas`.
2. Revisa el dashboard, el módulo de órdenes y el inventario para confirmar que los datos de prueba aparecen.
   - También puedes verificar la instancia desplegada en Vercel: https://sistema-mecanisoft-z2td.vercel.app/
3. Si necesitas recalcular datos, puedes relanzar el script de demo (`npx tsx scripts/seed-sample-data.ts`).

## 8. Problemas comunes

- **Error de conexión a la base de datos**: verifica la cadena `DATABASE_URL`, el puerto y que PostgreSQL esté en ejecución.
- **Puerto 3000 en uso**: cierra otras aplicaciones que lo utilicen o exporta `PORT=XXXX` antes de `npm run dev` para usar otro puerto.
- **Migraciones fallan**: asegúrate de que la base `taller_mecanico` esté vacía o ejecuta nuevamente `npx prisma migrate reset --force`.

## 9. Opción alternativa: levantar con Docker

Si prefieres evitar instalaciones locales, puedes usar los contenedores incluidos (`Dockerfile`, `.dockerignore` y `docker-compose.yml`).

1. Instala **Docker Desktop** (ver punto 1.4) y asegúrate de que esté en ejecución.
2. En la raíz del proyecto, ejecuta:
   ```powershell
   docker compose up --build
   ```
   Esto construirá la imagen de la aplicación, descargará PostgreSQL 16 y levantará ambos servicios.
3. El servicio `web` corre en `http://localhost:3000` y el servicio de base de datos en el puerto `5432` (expuesto solo para pruebas locales).
4. El `docker-compose.yml` ejecuta automáticamente `npx prisma migrate deploy`, `npm run seed` y `npm run start` dentro del contenedor web. Si deseas cargar también los datos de demostración, ejecuta:
   ```powershell
   docker compose exec web npx tsx scripts/seed-sample-data.ts
   ```
5. Para detener los contenedores, usa `docker compose down`. Si quieres borrar los datos persistidos de PostgreSQL, añade `-v` al comando (`docker compose down -v`).

> Nota: la cadena `DATABASE_URL` y las contraseñas por defecto están definidas en `docker-compose.yml`. Ajusta valores sensibles antes de desplegar en un entorno público.
