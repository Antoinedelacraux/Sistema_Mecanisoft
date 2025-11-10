# Módulo: Roles, Permisos y Usuarios

Descripción del proceso (orientado a diagramas)

Resumen: gestión de identidades, asignación de roles y permisos, y validación de autorización en tiempo de ejecución. El proceso central es: crear/editar roles, asignarlos a usuarios y validar permisos cuando se solicitan acciones protegidas.

Pasos del proceso (secuencia lógica)
1) Inicio: administrador crea o edita un rol/usuario.
2) Definición de permisos: para cada rol, se definen permisos por módulo/acción.
3) Asignación: asignar rol(s) a un usuario.
4) Validación en ejecución: al intentar realizar una acción, el guard de permisos consulta el conjunto de permisos y decide permitir o denegar.
5) Registro: cambios en roles/usuarios y eventos de acceso quedan registrados en bitácora.
6) Fin: acción permitida/denegada con logging.

Decisiones clave y excepciones
- ¿Usuario tiene permiso?: gateway principal; si no → denegar y registrar motivo.
- ¿Cambio en roles impacta sesiones activas?: definir política (aplicar en caliente o exigir re-login).

Entidades y objetos de datos
- Usuario (userId, username, roles[])
- Rol (roleId, permisos[])
- Permiso (module, action)
- Evento de auditoría (cambios y accesos)

Mapeo a diagramas
- Caso de uso: actores = {Administrador, Usuario}; casos = "Crear Usuario", "Asignar Rol", "Ejecutar Acción Protegida".
- Actividad/BPMN: tareas = [CrearRol/Usuario, AsignarPermisos, ValidarPermiso, RegistrarAcceso]; gateway en validación de permiso.
- Secuencia: lifelines = {Admin UI, AuthService, PermissionGuard, Bitacora}; mensajes: CrearUsuario -> AsignarRol -> IntentarAccion -> Validar -> Respuesta.


