# Guía de Instalación del Sistema de Taller Mecánico

¡Hola! Esta guía te ayudará a instalar el sistema de taller mecánico de manera fácil y sencilla. Es un proyecto universitario que gestiona clientes, inventario, órdenes de trabajo y más. 

Tienes dos formas de obtener el sistema:
1. **Descargar un archivo comprimido (RAR)**: Te lo enviaré listo para usar.
2. **Descargar desde GitHub**: Un sitio web donde está guardado el código.

Elige la opción que prefieras. Al final, tendrás el sistema funcionando en tu computadora.

## Opción 1: Descargar el Archivo RAR

Si te envío un archivo RAR (como un paquete comprimido), sigue estos pasos:

1. **Descarga el archivo**: Busca el email o mensaje donde te lo envié y descárgalo a tu computadora (por ejemplo, en la carpeta "Descargas").

2. **Descomprime el archivo**: Haz clic derecho en el archivo RAR y selecciona "Extraer aquí" o "Extraer archivos". Esto creará una carpeta llamada "taller-mecanico" con todos los archivos del sistema.

3. **Abre la carpeta**: Entra en la carpeta "taller-mecanico" que acabas de crear.

¡Listo! Ahora salta a la sección "Prerrequisitos" más abajo para continuar.

## Opción 2: Descargar desde GitHub

GitHub es como una biblioteca en línea para proyectos. Sigue estos pasos:

1. **Ve al enlace**: Abre tu navegador web y ve a https://github.com/Antoinedelacraux/Sistema_Mecanisoft

2. **Descarga el código**: En la página, busca un botón verde que dice "Code" o "Código". Haz clic en él y selecciona "Download ZIP". Esto descargará un archivo ZIP con todo el proyecto.

3. **Descomprime el archivo**: Una vez descargado, haz clic derecho en el archivo ZIP y selecciona "Extraer todo" o similar. Se creará una carpeta llamada "Sistema_Mecanisoft-main" (o similar). Renómbrala a "taller-mecanico" si quieres.

4. **Abre la carpeta**: Entra en la carpeta descomprimida.

¡Perfecto! Ahora continúa con los siguientes pasos.

## Prerrequisitos (Lo que Necesitas Antes de Empezar)

Antes de instalar el sistema, necesitas algunas herramientas básicas en tu computadora. Son gratis y fáciles de instalar:

1. **Node.js**: Es como el motor que hace funcionar el sistema. Ve a https://nodejs.org/, descarga la versión "LTS" (la recomendada) e instálala siguiendo las instrucciones. Es como instalar cualquier programa.

2. **PostgreSQL**: Es la base de datos, donde se guardan todos los datos (clientes, productos, etc.). Ve a https://www.postgresql.org/download/ y descarga la versión para tu sistema operativo (Windows, Mac o Linux). Durante la instalación, crea una contraseña para el usuario "postgres" (recuérdala, la necesitarás).

3. **Git (opcional, solo para la opción 2)**: Si elegiste GitHub, instala Git desde https://git-scm.com/. Es útil para descargar código, pero si descargaste el ZIP, no lo necesitas.

Si tienes problemas instalando algo, busca tutoriales en YouTube con el nombre de la herramienta + "instalar" + tu sistema operativo.

## Paso 1: Instalar las Dependencias

Una vez que tengas la carpeta del proyecto abierta:

1. **Abre la terminal o línea de comandos**: En Windows, busca "cmd" o "PowerShell" y ábrelo. En Mac, abre "Terminal". En Linux, también "Terminal".

2. **Ve a la carpeta del proyecto**: Escribe `cd` seguido de la ruta de la carpeta (por ejemplo, `cd Descargas\taller-mecanico`) y presiona Enter.

3. **Instala las dependencias**: Escribe `npm install` y presiona Enter. Esto descargará y configura todas las partes necesarias del sistema. Puede tardar unos minutos; espera a que termine.

## Paso 2: Configurar la Base de Datos

El sistema necesita una base de datos para guardar la información.

1. **Crea una base de datos**: Abre PostgreSQL (busca "pgAdmin" en tu menú de inicio). Conecta con el usuario "postgres" y la contraseña que pusiste. Crea una nueva base de datos llamada "taller_mecanico" (o el nombre que quieras).

2. **Configura el archivo de entorno**: En la carpeta del proyecto, crea un archivo llamado `.env` (sin extensión, solo ".env"). Ábrelo con un editor de texto (como Bloc de notas) y escribe esto:

   ```
   DATABASE_URL="postgresql://postgres:tu_contraseña@localhost:5432/taller_mecanico"
   NEXTAUTH_SECRET="un_secreto_seguro_aqui"  # Pon cualquier palabra larga y complicada, como "miSecretoSuperSeguro123"
   NEXTAUTH_URL="http://localhost:3000"
   ```

   - Cambia `tu_contraseña` por la contraseña de PostgreSQL.
   - Para `NEXTAUTH_SECRET`, inventa algo único, como una frase con números.

3. **Prepara la base de datos**: En la terminal (desde la carpeta del proyecto), escribe `npx prisma migrate deploy` y presiona Enter. Esto crea las tablas en la base de datos.

4. **Genera el acceso a la base de datos**: Escribe `npx prisma generate` y presiona Enter.

(Opcional) Si quieres datos de prueba: Escribe `npm run seed` para agregar ejemplos de clientes y productos.

## Paso 3: Ejecutar el Sistema

¡Ya casi estamos!

1. **Inicia el sistema**: En la terminal, escribe `npm run dev` y presiona Enter. Verás mensajes en la pantalla; espera a que diga algo como "Ready" o "Listo".

2. **Abre en el navegador**: Ve a tu navegador web y escribe `http://localhost:3000`. Deberías ver la página de inicio de sesión del sistema.

3. **Inicia sesión**: Usa las credenciales de administrador que se crearon durante el seeding (si lo hiciste), o crea un usuario administrador con el script `create-admin-user.ts` (pregúntame si necesitas ayuda).

¡Felicidades! El sistema está funcionando. Explora las secciones de clientes, inventario, órdenes, etc.

## Comandos Útiles (Si Necesitas Hacer Algo Más)

- Para detener el sistema: Presiona Ctrl + C en la terminal.
- Para verificar errores: Si algo no funciona, revisa los mensajes en la terminal.
- Para limpiar datos de prueba: `tsx prisma/clean-test-data.ts`
- Para ejecutar pruebas: `npx jest` (opcional, para verificar que todo esté bien).

### Problema conocido en Windows: bloqueo de Prisma

En Windows puede ocurrir un error al generar el cliente de Prisma debido a archivos temporales bloqueados (EPERM al renombrar `query_engine-windows.dll.node.tmp`). Para ayudar con esto hemos añadido un script que limpia archivos temporales y vuelve a generar el cliente.

Uso:

```powershell
$env:DATABASE_URL = 'postgresql://user:pass@localhost:5432/tu_bd'
npm run prisma:fix-locks
```

Esto intentará eliminar archivos `*.tmp` en `node_modules/.prisma/client` y ejecutar `npx prisma generate`. Si el problema persiste, cierra procesos `node`/VSCode y ejecuta los comandos sugeridos por el script (`takeown` / `icacls`).

## ¿Problemas? ¡No te preocupes!

- Si no se conecta a la base de datos: Revisa la contraseña en `.env`.
- Si faltan herramientas: Vuelve a instalar Node.js o PostgreSQL.
- Si ves errores raros: Copia el error y busca en Google, o pregúntame.

Este sistema es para gestionar un taller mecánico: agregar clientes, manejar inventario, crear órdenes de trabajo, etc. ¡Espero que te sea útil para tu proyecto universitario! Si tienes dudas, estoy aquí para ayudar.