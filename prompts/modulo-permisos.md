# Propuesta: Módulo de Permisos

## Objetivo
Garantizar que cada trabajador tenga acceso únicamente a las funcionalidades que le corresponden, reforzando la seguridad operativa del taller. El módulo permitirá asignar permisos predeterminados por rol y personalizarlos cuando sea necesario a nivel de usuario individual.

## Alcance funcional
1. **Catálogo de permisos**
   - Definir acciones granularmente (ver, registrar, editar, eliminar, exportar, aprobar, etc.) para cada dominio del sistema (clientes, inventario, órdenes, facturación, reportes, configuración, etc.).
   - Agrupar permisos por módulos para facilitar su administración.

2. **Roles preconfigurados**
   - Cada rol existente (ej. Administrador, Recepcionista, Jefe de Taller, Mecánico, Contador) tendrá una plantilla de permisos ante su creación/edición.
   - Los roles podrán activarse/desactivarse y actualizar sus permisos base sin impactar las personalizaciones individuales ya aplicadas.

3. **Asignación automática al registrar trabajadores**
   - Al vincular un usuario con un trabajador se asignarán los permisos base del rol elegido.
   - Permitir vista previa de los permisos que se otorgarán antes de confirmar el registro.

4. **Personalización por usuario**
   - Opción opcional para "Personalizar permisos" en cada usuario.
   - Posibilidad de añadir permisos adicionales o revocar permisos específicos heredados del rol.
   - Registro de cambios en bitácora indicando quién ajustó los permisos y cuándo.

5. **Control de acceso en tiempo real**
   - Middleware/guards que validen permisos en API y UI (botones, menús, rutas) antes de ejecutar acciones sensibles.
   - Mensajes claros cuando se bloquea una acción por falta de permisos.

6. **Auditoría y reportes**
   - Bitácora de actualizaciones de permisos por usuario.
   - Reporte consolidado por rol y usuario mostrando diferencias respecto a la plantilla original.

## Requisitos técnicos
- Base de datos
  - Tablas sugeridas:
    - `permiso`: catálogo maestro con código, nombre, descripción y módulo.
    - `rol_permiso`: relación muchos-a-muchos entre roles y permisos (plantillas base).
    - `usuario_permiso`: relación muchos-a-muchos para personalizaciones (se marca si el permiso fue agregado o revocado respecto a la plantilla).
  - Migraciones para actualizar prisma schema.

- Backend (Next.js / Prisma)
  - Servicios para listar permisos por rol/usuario, aplicar plantillas y personalizar.
  - Endpoints con validación y logging en bitácora.
  - Middlewares/helpers para validar permisos en APIs existentes.

- Frontend (App Router + shadcn/ui)
  - Vista de administración de roles con editor de permisos.
  - Vista de detalle de usuario con sección "Permisos personalizados".
  - Componentes reutilizables para checklists de permisos, chips de diferencia vs. rol base, y mensajes de restricción.

- Seguridad
  - Validar siempre sesión y rol del solicitante antes de permitir modificaciones.
  - Asegurar que los usuarios no puedan auto-elevar sus privilegios si no tienen permiso explícito.

## Roadmap sugerido
1. **Definición y migraciones**: catálogo inicial de permisos y relaciones rol/permiso.
2. **Servicios backend**: CRUD de permisos, plantillas de rol, personalizaciones de usuario, middleware de autorización.
3. **UI administrativa**: pantallas para roles y usuarios con edición de permisos.
4. **Integración transversal**: proteger rutas, botones y acciones existentes.
5. **Auditoría y reportes**: bitácora, reportes comparativos y alertas.
6. **QA & capacitación**: pruebas de seguridad, casos de uso críticos y documentación interna.

## Éxito esperado
- Mayor control sobre quién puede usar funciones críticas.
- Trazabilidad total de ajustes de permisos.
- Flexibilidad para cubrir escenarios específicos sin crear roles nuevos para cada excepción.
