# Documentación del Sistema de Taller Mecánico

## Descripción General

* El **Módulo de Usuarios** está orientado a la gestión de credenciales y permisos de acceso, permitiendo asignar usuarios, contraseñas y definir roles.

## Vinculación con Módulo de Trabajadores
**Vinculación:** Existe un vínculo esencial entre ambos: cada trabajador podrá tener asociado un usuario del sistema con un rol específico, lo que garantiza la seguridad y facilita la administración de accesos.

---

# 3. Módulo de Usuarios

## 3.1. Objetivo

Gestionar el acceso seguro al sistema mediante la creación de cuentas de usuario, la asignación de roles y el control de permisos.

## 3.2. Funcionalidades Principales

* Crear nuevos usuarios asociados a trabajadores registrados.
* Asignar roles según las funciones laborales (Administrador, Mecánico, Recepcionista, Supervisor, etc.).
* Establecer y cambiar contraseñas.
* Bloquear o desbloquear usuarios para controlar el acceso.
* Restablecer credenciales.
* Controlar el acceso mediante *login* seguro.

## 3.3. Datos del Formulario de Registro

### Datos de Vinculación y Cuenta:

* **Seleccionar Trabajador:** El usuario se vincula a un registro existente de la lista de trabajadores activos.
* **Nombre de usuario**
* **Correo personal** (Opcional, usado para notificaciones).

### Datos de Acceso:

* **Contraseña**
* **Confirmar contraseña**
* **Rol:** Se autocompleta inicialmente al elegir al trabajador, pero es editable.
* **Estado:** Activo / Inactivo

### Acciones del Formulario:

* **Botón Guardar usuario**
* **Botón Cancelar:** Regresar a la lista de usuarios.

## 3.4. Envío Automático de Credenciales por Correo

Al registrar un nuevo usuario, el sistema permitirá enviar un correo electrónico automático al trabajador con sus credenciales de acceso.

### Información incluida en el correo:

* Nombre del trabajador
* Usuario asignado
* Contraseña temporal
* Rol asignado

**Ejemplo del Mensaje:**
> Estimado(a) [Nombre del trabajador],
> Se ha creado una cuenta para usted en el sistema del Taller Mecánico.
> Usuario: [usuario]
> Contraseña temporal: [contraseña]
> Rol: [rol]
> Por favor, cambie su contraseña después del primer inicio de sesión.

El sistema mostrará un mensaje de éxito indicando que el correo ha sido enviado.

## Acciones por Registro (En la Lista de Usuarios)

Cada registro de usuario tendrá las siguientes opciones de gestión:

1.  **Editar Usuario** ⚙️
    * Permite cambiar el correo, el rol o el estado del usuario.
    * También se puede restablecer la contraseña manualmente.
2.  **Ver Detalle** 👁️
    * Muestra la información del usuario, su rol y el trabajador asociado.
    * Útil para los administradores del sistema.
3.  **Restablecer Contraseña** 🔁
    * Genera una nueva contraseña temporal.
    * Envía automáticamente un correo al trabajador con las nuevas credenciales, lo que aumenta la seguridad.
4.  **Cambiar Estado** 🔒 / 🔓
    * Bloquear o desbloquear el acceso del usuario al sistema.
    * Ejemplo: Si está **Activo**, la opción es "Bloquear usuario". Si está **Bloqueado**, la opción es "Desbloquear usuario".
5.  **Eliminar Usuario** 🗑️
    * Desactiva definitivamente el acceso (**baja lógica**).
    * Mantiene la relación con el trabajador para fines de trazabilidad.

## 3.5. Filtros de Búsqueda

La lista de usuarios podrá filtrarse por:

* Correo electrónico (Input de texto)
* Rol del usuario
* Estado (Inactivo o Activo)
* Rango de fechas (para creación o actividad)

## 3.6. Relación con Otros Módulos

* **Trabajadores:** Cada usuario estará directamente asociado a un registro de trabajador.
* **Permisos:** Este módulo es la base para gestionar y aplicar los permisos de acceso a los diferentes módulos del sistema.