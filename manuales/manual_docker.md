# Manual de Uso con Docker

Este documento explica cómo levantar y administrar el sistema **MecaniSoft** utilizando contenedores Docker. Está pensado para personas sin experiencia previa; se asume que ya tienes el código fuente del proyecto.

## 1. Requisitos

1. **Docker Desktop** instalado y en ejecución.
   - Descarga: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
   - En Windows y macOS sigue el asistente de instalación y reinicia si te lo solicita.
2. **Terminal** (PowerShell en Windows, Terminal en macOS/Linux).
3. Espacio en disco suficiente (aprox. 2 GB) para imágenes y datos persistentes de PostgreSQL.

## 2. Archivos relevantes

- `Dockerfile`: define la imagen de la aplicación Next.js.
- `.dockerignore`: evita que archivos innecesarios se copien a la imagen.
- `docker-compose.yml`: orquesta los servicios `web` (app) y `db` (PostgreSQL).

Todos estos archivos se encuentran en la raíz del proyecto.

## 3. Variables y credenciales por defecto

`docker-compose.yml` expone las siguientes configuraciones:

- **Base de datos**
  - Usuario: `mecanisoft`
  - Contraseña: `mecanisoft123`
  - Base de datos: `taller_mecanico`
  - Puerto: `5432`
- **Aplicación**
  - `NEXTAUTH_URL`: `http://localhost:3000`
  - `NEXTAUTH_SECRET`: `change-me` (cámbiala antes de producción)
  - `DATABASE_URL`: apunta al contenedor `db` usando las credenciales anteriores.

Puedes modificar estos valores directamente en `docker-compose.yml` antes de construir.

## 4. Primer arranque

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:
   ```powershell
   docker compose up --build
   ```
   - `--build` fuerza la construcción de la imagen cada vez que cambian las dependencias o el código.
   - El proceso tarda unos minutos la primera vez (descarga Node.js, PostgreSQL y compila la app).
3. Cuando veas los mensajes "Listening on port 3000" (o similares), la app estará lista en `http://localhost:3000`.

El contenedor `web` ejecuta automáticamente:
1. `npx prisma migrate deploy`
2. `npm run seed`
3. `npm run start`

Para cargar datos de demostración adicionales, ejecuta en otra terminal:
```powershell
docker compose exec web npx tsx scripts/seed-sample-data.ts
```

## 5. Comandos útiles

| Acción                                   | Comando                                                                 |
|------------------------------------------|-------------------------------------------------------------------------|
| Arrancar en segundo plano                | `docker compose up -d`                                                  |
| Ver logs de ambos servicios              | `docker compose logs -f`                                                |
| Ver logs solo de la app                  | `docker compose logs -f web`                                            |
| Ejecutar migraciones manualmente         | `docker compose exec web npx prisma migrate deploy`                     |
| Abrir una shell dentro del contenedor    | `docker compose exec web sh`                                            |
| Detener los contenedores                 | `docker compose down`                                                   |
| Detener y borrar volúmenes (datos DB)    | `docker compose down -v`                                                |
| Reconstruir la imagen sin usar cache     | `docker compose build --no-cache`                                       |

## 6. Persistencia de datos

- El servicio `db` monta un volumen llamado `postgres-data` para guardar los datos de PostgreSQL fuera del contenedor. De este modo, los datos se conservan aunque detengas `docker compose`.
- Para limpiar todo (incluido el contenido del volumen), usa `docker compose down -v`.

## 7. Personalizaciones comunes

1. **Cambiar puertos**
   - Edita `docker-compose.yml` y reemplaza `3000:3000` o `5432:5432` por los puertos deseados (`HOST:CONTENEDOR`).
2. **Cambiar credenciales**
   - Modifica las variables `POSTGRES_USER`, `POSTGRES_PASSWORD` y actualiza la `DATABASE_URL` para coincidir.
3. **Salto de `npm run seed`**
   - Si quieres arrancar con una base vacía, elimina `npm run seed` del comando del servicio `web` y ejecuta manualmente `docker compose exec web npx prisma migrate deploy` o el script que prefieras.

## 8. Actualización de la aplicación

1. Detén los contenedores: `docker compose down`.
2. Actualiza el código fuente (copiando archivos o usando Git).
3. Reconstruye y levanta nuevamente: `docker compose up --build`.

## 9. Resolución de problemas

- **La app no inicia y se apaga el contenedor `web`**: revisa los logs con `docker compose logs web` para ver el error exacto. Las causas comunes son migraciones fallidas o credenciales de DB incorrectas.
- **Puerto ocupado**: otro proceso está usando el puerto (3000 o 5432). Modifica el puerto host en `docker-compose.yml` o libera el puerto ocupado.
- **Fallo de compilación al construir**: asegúrate de que el directorio contenga `package-lock.json` actualizado. Si cambiaste dependencias, corre `npm install` localmente antes de construir.
- **Necesitas reiniciar solo PostgreSQL**: `docker compose restart db`.

## 10. Limpieza

Si ya no necesitas la infraestructura Docker:
```powershell
docker compose down -v
docker image prune -f
```
Esto elimina contenedores, volúmenes y limpia imágenes sin usar.

Con estos pasos puedes administrar MecaniSoft mediante Docker sin depender de instalaciones locales adicionales.
