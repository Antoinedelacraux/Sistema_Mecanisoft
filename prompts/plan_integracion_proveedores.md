# Plan de Integración de Proveedores en el Módulo de Inventario

## Fecha
13 de octubre de 2025

## Objetivo
Integrar proveedores en el módulo de inventario para rastrear el origen de los productos y movimientos, permitiendo una mejor gestión de compras y suministro.

## Estado Actual (Asesado)
- El modelo `Proveedor` existe en `prisma/schema.prisma` pero no se utiliza en la UI ni APIs actuales.
- El módulo de inventario maneja ingresos, salidas, ajustes y transferencias usando `origen_tipo` (e.g., 'TRANSFERENCIA') y `referencia_origen` para rastrear orígenes.
- No hay integración actual con proveedores; los ingresos no están vinculados a proveedores específicos.
- Validaciones existentes aseguran que solo productos activos se usen en movimientos.

## Alcance Propuesto
### Características Mínimas
1. **Vincular Ingresos a Proveedores**: Permitir seleccionar un proveedor al registrar un ingreso de inventario.
2. **Rastreo de Origen**: Usar `referencia_origen` para almacenar el ID del proveedor en movimientos de tipo 'COMPRA' o similar.
3. **UI para Proveedores**: Agregar selección de proveedor en formularios de ingreso de inventario.
4. **Reportes Básicos**: Mostrar proveedores en reportes de inventario y movimientos.

### Impactos en el Modelo de Datos
- Extender `MovimientoInventario` para incluir `proveedor_id` opcional.
- Asegurar que `Proveedor` esté activo y relacionado con productos.
- Posible nueva tabla `Compra` para agrupar ingresos por proveedor (opcional para MVP).

## Pasos de Implementación
1. **Actualizar Modelo de Datos**:
   - Agregar campo `proveedor_id` a `MovimientoInventario` en `schema.prisma`.
   - Crear migración de Prisma.

2. **Actualizar Servicios de Inventario**:
   - Modificar `src/lib/inventario/services.ts` para aceptar y validar `proveedor_id` en ingresos.
   - Agregar validación de proveedor activo.

3. **Actualizar APIs**:
   - Modificar `src/app/api/inventario/movimientos/route.ts` para incluir proveedor en ingresos.
   - Agregar endpoint para listar proveedores activos si no existe.

4. **Actualizar UI**:
   - Modificar componentes de ingreso de inventario (e.g., `src/components/inventario/ingreso-form.tsx`) para incluir selector de proveedor.
   - Filtrar proveedores activos.

5. **Agregar Pruebas**:
   - Crear tests en `tests/api/inventarioMovimientosApi.test.ts` para ingresos con proveedores.
   - Agregar tests de UI para selección de proveedor.

6. **Documentación y Seed**:
   - Actualizar seed data para incluir proveedores de ejemplo.
   - Agregar a prompts si es necesario.

## Estimación de Esfuerzo
- **Complejidad**: Media-Alta (requiere cambios en modelo, servicios, APIs y UI).
- **Tiempo Estimado**: 2-3 días para MVP básico.
- **Riesgos**: Posibles conflictos con validaciones existentes; asegurar consistencia en transacciones.
- **Recomendación**: Proceder con implementación inmediata, comenzando por el modelo de datos y servicios.

## Próximos Pasos
- Revisar y aprobar este plan.
- Comenzar con la migración de Prisma.
- Implementar cambios en orden de servicios → APIs → UI → tests.
