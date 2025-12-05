# Arreglo: Error de Permisos en Módulo de Tareas

## 📋 Problema
El componente `TareasKanban` mostraba el error:
```
No cuentas con permisos para visualizar tareas
```

Esto ocurría porque el endpoint `/api/tareas` verificaba el permiso `tareas.ver`, pero ese permiso no estaba asignado a ningún rol en la base de datos.

## ✅ Solución Implementada

### 1. **Creación del Script de Asignación de Permisos**
Se creó un nuevo script: `scripts/grant-tareas-permissions.ts`

Este script:
- Asegura que los permisos `tareas.ver` y `tareas.gestionar` existan en la base de datos
- Asigna los permisos a los roles correspondientes:
  - **`tareas.ver`** → Administrador, Mecánico, Recepcionista
  - **`tareas.gestionar`** → Administrador, Mecánico

### 2. **Ejecución del Script**
```bash
npx tsx scripts/grant-tareas-permissions.ts
```

**Resultado:**
```
✅ Permiso asegurado: tareas.ver
   Asignado a roles: Administrador, Mecánico, Recepcionista
✅ Permiso asegurado: tareas.gestionar
   Asignado a roles: Administrador, Mecánico
✅ Permisos de tareas aplicados correctamente.
```

## 📝 Archivos Modificados/Creados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `scripts/grant-tareas-permissions.ts` | Creado | Script para asignar permisos de tareas |

## 🔐 Permisos Configurados

### `tareas.ver`
- **Nombre:** Ver tablero de tareas
- **Descripción:** Permite acceder al tablero general de tareas del taller
- **Módulo:** tareas
- **Asignado a:** Administrador, Mecánico, Recepcionista

### `tareas.gestionar`
- **Nombre:** Gestionar tareas
- **Descripción:** Autoriza actualizar estados y asignaciones de tareas
- **Módulo:** tareas
- **Asignado a:** Administrador, Mecánico

## 🧪 Verificación

El componente `TareasKanban` ahora debería:
1. ✅ Cargar el tablero de tareas sin errores de permiso
2. ✅ Mostrar las tareas agrupadas por estado (Por hacer, En Proceso, Pausado, Completado)
3. ✅ Permitir a usuarios con rol Mecánico o Administrador gestionar tareas

## 📚 Scripts Relacionados

Otros scripts de asignación de permisos disponibles:
- `scripts/grant-inventario-permissions.ts`
- `scripts/grant-reportes-permissions.ts`
- `scripts/grant-bitacora-configuracion-permissions.ts`
- `scripts/grant-all-permissions-to-roles.ts` - Otorga todos los permisos a los roles principales

## 💡 Próximos Pasos Recomendados

1. **Verificar acceso en UI:**
   - Acceder como usuario con rol "Mecánico" o "Recepcionista"
   - Navegar a la sección de Tareas
   - Verificar que el tablero Kanban se carga correctamente

2. **Verificar funcionalidad de gestión:**
   - Intentar cambiar el estado de una tarea (solo disponible para Mecánico/Admin)
   - Verificar que Recepcionista solo puede ver, no editar

3. **Ejecutar tests:**
   ```bash
   npx jest tests/api/tareasApi.test.ts
   ```
