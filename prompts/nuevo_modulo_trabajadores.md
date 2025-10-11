# Documentación del Sistema de Taller Mecánico

## Descripción General
* El **Módulo de Trabajadores** tiene como fin registrar, gestionar y visualizar toda la información del personal del taller, manteniendo un control de roles, datos personales y estado laboral.
---

## 2. Módulo de Trabajadores

### 2.1. Objetivo

Registrar y administrar la información del personal del taller para mantener una base de datos actualizada que facilite la gestión interna y la asignación de roles.

### 2.2. Funcionalidades Principales

* Registrar nuevos trabajadores.
* Editar y actualizar información personal.
* Cambiar estado laboral (activo/inactivo).
* Consultar lista de trabajadores con filtros por cargo o estado.
* Eliminar (o dar de **baja lógica**) trabajadores del sistema.

### 2.3. Datos del Formulario de Registro

#### Datos Personales:

* Nombres completos
* Apellidos
* Tipo de documento (DNI, RUC, Pasaporte)
* Número de documento
* Fecha de nacimiento
* Teléfono
* Correo electrónico
* Dirección

#### Datos Laborales:

* Cargo o puesto (Mecánico, Recepcionista, Administrador, Jefe de Taller, etc.)
* Fecha de ingreso
* Sueldo mensual
* Estado (Activo / Inactivo)

#### Acciones del Formulario:

* **Botón Guardar:** Para nuevo registro o actualización.
* **Botón Cancelar:** Para volver a la lista.

### Acciones por Registro (En la Lista/Tabla de Registros)

Cada fila en la lista de trabajadores tendrá un conjunto de acciones:

1.  **Editar** 📝
    * Permite modificar la información personal o laboral del trabajador.
    * Solo disponible si el trabajador está **“Activo”**.
2.  **Ver Detalle** 👁️
    * Abre una vista con toda la información (datos personales + laborales) para consulta.
    * Útil para evitar abrir el formulario de edición solo para consulta.
3.  **Asignar Usuario** 🔐
    * Enlaza directamente al módulo de “Usuarios” para crear o vincular credenciales.
    * Si el trabajador ya tiene usuario, muestra opción para **“Ver Usuario”**.
4.  **Cambiar Estado** 🔄
    * Permite activar o inactivar a un trabajador.
    * Ejemplo: Activo → Inactivo (baja temporal o renuncia), Inactivo → Activo (reincorporación).
5.  **Eliminar (Baja Lógica)** 🗑️
    * Marca al trabajador como “eliminado” (baja lógica) sin borrarlo físicamente.
    * Esto es crucial para evitar romper relaciones con órdenes de trabajo o usuarios.
    * Disponible cuando el trabajador esté **"Inactivo"**.
---

### Filtros de Búsqueda:

* Nombres y Apellidos (Input de texto)
* Rol
* Estado (Inactivo o Activo)

### 2.4. Relación con Otros Módulos

* **Usuarios:** Cada trabajador podrá estar vinculado a un usuario con sus credenciales de acceso.
* **Órdenes de Trabajo:** Los trabajadores (solamente mecánicos) se podrán asignar a órdenes específicas.
* **Permisos:** En el futuro, los permisos se podrán asignar según el rol definido.