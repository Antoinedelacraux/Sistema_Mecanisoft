# Cambios Recientes - Taller Mecánico

**Fecha de reporte:** 25 de noviembre de 2025  
**Período analizado:** Últimos 10 commits (desde 15 de octubre hasta 10 de noviembre de 2025)

## Resumen General

Se han realizado cambios significativos en la aplicación enfocados en:
- **Mejoras de diseño UI/UX**
- **Módulo de Reportes y Auditoría**
- **Indicadores (KPIs) y Métricas**
- **Dashboard mejorado**
- **Gestión de Roles y Permisos**
- **Infraestructura y Docker**

---

## Commits Principales

### 1. **Ajustes finales - Diseño nuevo (correcciones)** `2d0d71b`
- **Fecha:** 10 de noviembre de 2025
- Correcciones finales al nuevo diseño de la interfaz

### 2. **Ajustes finales - Diseño nuevo** `7ac5d2c`
- **Fecha:** 10 de noviembre de 2025
- Implementación del nuevo diseño UI/UX

### 3. **Ajustes finales - Auditoría y Vista** `414f983`
- **Fecha:** 10 de noviembre de 2025
- Finalización del módulo de auditoría y vistas relacionadas

### 4. **Documentación** `b435c07`
- **Fecha:** 26 de octubre de 2025
- Actualización de documentación general

### 5. **Desarrollo módulo de configuración y bitácora** `501c855`
- **Fecha:** 24 de octubre de 2025
- Implementación completa del módulo de bitácora y configuración

### 6. **Middleware debug logs para token** `c37a49d`
- **Fecha:** 16 de octubre de 2025
- Logs de depuración para presencia de token

### 7. **Documentación** `a58d041`
- **Fecha:** 16 de octubre de 2025
- Actualización de documentación

### 8. **Métricas, KPIs, Indicadores** `b0e74de`
- **Fecha:** 16 de octubre de 2025
- Implementación completa del módulo de indicadores

### 9. **Desarrollo de Dashboard - Panel** `47dbfc5`
- **Fecha:** 16 de octubre de 2025
- Dashboard principal mejorado

### 10. **Fin de módulo Roles** `c0c8709`
- **Fecha:** 15 de octubre de 2025
- Finalización del módulo de gestión de roles

---

## Estadísticas de Cambios

**Total de archivos modificados:** 373 archivos  
**Líneas añadidas:** ~32,710  
**Líneas eliminadas:** ~3,015

### Distribución de cambios por categoría:

| Categoría | Cambios | Descripción |
|-----------|---------|-------------|
| **Dependencias** | ~3,736 líneas | Actualización de `package-lock.json` |
| **Nuevas características** | ~5,000+ líneas | Módulo de reportes, indicadores, roles |
| **Infraestructura** | ~400 líneas | Docker, CI/CD, migrations |
| **Documentación** | ~2,500 líneas | Docs, manuales, prompts |
| **UI/UX** | ~3,000+ líneas | Componentes, estilos, páginas |
| **Base de datos** | ~1,500 líneas | Migrations, schema, seeds |

---

## Cambios Principales por Módulo

### 📊 Módulo de Indicadores (KPIs)
- ✅ Creación de `/src/lib/indicadores/mantenimientos.ts` (965 líneas)
- ✅ Sistema de caché de indicadores (`/src/lib/indicadores/cache.ts`)
- ✅ Endpoints de API para cada KPI:
  - `/api/indicadores/avg-time-per-job`
  - `/api/indicadores/coverage`
  - `/api/indicadores/csat`
  - `/api/indicadores/on-schedule`
  - `/api/indicadores/on-time-close`
  - `/api/indicadores/rework-rate`
  - `/api/indicadores/technician-utilization`
  - `/api/indicadores/stock-critical`
  - `/api/indicadores/reschedule`
  - `/api/indicadores/recalcular`
- ✅ Página de indicadores mejorada (`/src/app/dashboard/indicadores/page.tsx`)
- ✅ Componentes de visualización: gráficos lineales, donut, heatmap, KPI cards

### 📋 Módulo de Reportes
- ✅ Sistema completo de reportes (`/src/lib/reportes/`)
- ✅ Generador de reportes con templates
- ✅ Programación de reportes (schedules)
- ✅ Procesamiento de reportes con Workers
- ✅ Exportación CSV (Ventas Resumen)
- ✅ Endpoints:
  - `/api/reportes/generate` - Generación de reportes
  - `/api/reportes/templates` - Gestión de templates
  - `/api/reportes/schedules` - Programación de reportes
  - `/api/reportes/files/[id]/download` - Descarga de archivos
  - `/api/reportes/purge` - Limpieza de archivos antiguos
- ✅ Página de reportes completa (`/src/app/dashboard/reportes/`)

### 🔐 Módulo de Roles y Permisos
- ✅ Servicio de roles refactorizado (`/src/lib/roles/service.ts` - 313 líneas)
- ✅ Controladores para operaciones CRUD:
  - Crear rol
  - Actualizar rol
  - Eliminar rol
  - Listar roles
  - Asignar permisos
- ✅ Interfaz mejorada para gestión de roles
- ✅ Validación con Zod schemas

### 📔 Módulo de Bitácora
- ✅ Sistema de auditoría (`/src/lib/bitacora/log-event.ts`)
- ✅ Endpoint de bitácora (`/api/bitacora`)
- ✅ Panel de bitácora (`/src/components/bitacora/BitacoraPanel.tsx`)
- ✅ Página de bitácora (`/src/app/dashboard/bitacora/page.tsx`)

### 👤 Mejoras en Usuarios
- ✅ Gestor de avatares con cropper:
  - Subida de avatares
  - Recorte de imagen
  - Historial de versiones
  - Revertir a versión anterior
- ✅ Perfil de usuario mejorado (`ProfileConfig.tsx`)
- ✅ Búsqueda de usuarios (`/api/usuarios/buscar`)
- ✅ Endpoints:
  - `/api/usuarios/me/avatar` - Gestión de avatar
  - `/api/usuarios/me/avatar/versions` - Historial de versiones
  - `/api/usuarios/me/avatar/revert` - Revertir avatar
  - `/api/usuarios/me/username` - Cambiar nombre de usuario

### 🎛️ Dashboard Mejorado
- ✅ Nuevo dashboard principal (`/src/app/dashboard/page.tsx` - 538 líneas)
- ✅ Filtros dinámicos
- ✅ Gráficos de ventas por método
- ✅ Series de tiempo
- ✅ Top productos
- ✅ Botón de exportación CSV
- ✅ Recálculo forzado de indicadores

### 🚗 Módulo de Vehículos
- ✅ Servicio refactorizado (`/src/lib/vehiculos/service.ts` - 194 líneas)
- ✅ Manejo mejorado de errores

### 📦 Módulo de Servicios
- ✅ Servicio refactorizado (`/src/lib/servicios/service.ts` - 219 líneas)
- ✅ API actualizada

### 🏗️ Infraestructura y DevOps

#### Docker
- ✅ Dockerfile actualizado
- ✅ docker-compose.yml configurado
- ✅ docker-compose.redis.yml para Redis
- ✅ .dockerignore

#### Automatización (Scripts)
- ✅ `warm-indicadores-cache.ts` - Precalentar caché de indicadores
- ✅ `seed-sample-data.ts` - Datos de prueba (1,166 líneas)
- ✅ `seed-historical-activity.ts` - Historial de actividad (466 líneas)
- ✅ `report-scheduler.ts` - Planificador de reportes
- ✅ `report-worker.ts` - Worker de reportes
- ✅ `ordenes-tareas-scheduler.ts` - Planificador de tareas de órdenes
- ✅ `inventario-scheduler.ts` - Planificador de inventario
- ✅ Scripts de verificación y limpieza

#### CI/CD
- ✅ GitHub Actions workflows:
  - `ci.yml` - Pipeline de integración continua
  - `reportes-e2e.yml` - Tests E2E de reportes

### 🔧 Base de Datos (Prisma)

#### Migrations Nuevas
- ✅ `20251024_add_reportes_module` - Módulo de reportes
- ✅ `20251108164305_ola2_correlativos` - Correlativos (83 líneas)
- ✅ Otras migraciones para roles, bitácora y módulos

#### Schema Actualizado
- ✅ Modelo `ReportTemplate` - Templates de reportes
- ✅ Modelo `ReportSchedule` - Programación de reportes
- ✅ Modelo `ReportFile` - Archivos de reportes
- ✅ Modelo `Bitacora` - Auditoría
- ✅ Modelo `IndicadorCache` - Caché de indicadores
- ✅ Ampliación de permisos y roles

### 📝 Testing
- ✅ Nuevos tests añadidos:
  - `bitacoraApi.test.ts` - Tests de bitácora (148 líneas)
  - `usuariosAvatarApi.test.ts` - Tests de avatar
  - `usuariosAvatarRevertApi.test.ts` - Tests de revertir avatar
  - `usuariosBuscarApi.test.ts` - Tests de búsqueda
  - `usuariosMeApi.test.ts` - Tests de perfil
  - `dashboard.test.ts` - Tests de dashboard (225 líneas)
  - `mantenimientos.test.ts` - Tests de indicadores (307 líneas)
  - `login-security.test.ts` - Tests de seguridad de login
  - `correlativos/service.test.ts` - Tests de correlativos
  - `reportes/**` - Tests de reportes
  - `servicios/service.test.ts` - Tests de servicios
  - `vehiculos/service.test.ts` - Tests de vehículos

### 📚 Documentación
- ✅ Actualización de README.md (172 líneas)
- ✅ Manuales en `/manuales/`:
  - `manual_docker.md`
  - `manual_instalacion.md`
- ✅ Documentación en `/docs/`:
  - `auditoria-modulos-2025-11-08.md`
  - `cron-jobs.md`
  - `diagrams_screenshots_plan.md`
  - `procesos_general_bpmn.md` y diagrama BPMN
  - `reportes.md`
  - `requisitos.md`
  - Screenshots de todos los módulos
- ✅ Prompts en `/prompts/` para generación de módulos

### 🎨 UI/UX Mejorada
- ✅ Nuevo componente `Headbar.tsx` (321 líneas)
- ✅ Sidebar refactorizado (425 líneas)
- ✅ Estilos CSS globales actualizados (190 líneas)
- ✅ Página de login redeseñada (173 líneas)
- ✅ Componentes de indicadores visuales
- ✅ Componente `AvatarCropper.tsx` para recorte de avatares
- ✅ Componente `ProfileConfig.tsx` para configuración de perfil

---

## Características Nuevas Destacadas

### 🆕 Indicadores (KPIs)
- Tiempo promedio por trabajo
- Cobertura de servicios
- CSAT (Customer Satisfaction)
- On-Schedule (puntualidad)
- On-Time Close (cierre a tiempo)
- Rework Rate (tasa de retrabajos)
- Utilización de técnicos
- Stock crítico
- Caché inteligente con invalidación por hash

### 🆕 Sistema de Reportes
- Generación programada de reportes
- Templates personalizables
- Exportación a múltiples formatos
- Worker asíncrono para procesamiento
- Limpieza automática de archivos antiguos
- Reporte de Ventas Resumen

### 🆕 Gestión de Roles
- CRUD completo de roles
- Asignación granular de permisos
- Interfaz visual mejorada
- Validación robusta

### 🆕 Auditoría (Bitácora)
- Registro de todas las acciones
- Panel de visualización
- Búsqueda y filtrado
- Trazabilidad completa

### 🆕 Gestión de Avatares
- Subida de avatares
- Cropper integrado
- Historial de versiones
- Revertir a versión anterior

---

## Dependencias Actualizadas

Se han actualizado múltiples dependencias en `package.json` y generado nuevo `package-lock.json`. Las actualizaciones incluyen:
- Dependencias de desarrollo
- Librerías de utilidad
- Herramientas de compilación

---

## Mejoras de Seguridad

- ✅ Login security mejorado (`/src/lib/auth/login-security.ts` - 215 líneas)
- ✅ Validación de credenciales
- ✅ Protección antivirus para uploads (`/src/lib/security/antivirus.ts`)
- ✅ Gestión segura de contraseñas

---

## Próximos Pasos Recomendados

1. **Ejecutar migrations:**
   ```bash
   npm run migrate
   ```

2. **Precargar caché de indicadores (opcional pero recomendado):**
   ```bash
   npm run indicadores:warm-cache
   ```

3. **Ejecutar tests:**
   ```bash
   npm run verify
   ```

4. **Revisar documentación:**
   - Consultar `/docs/` para diagramas y requisitos
   - Revisar `/manuales/` para instrucciones de instalación y Docker

---

## Notas Importantes

- Se han añadido muchas migraciones a Prisma. Asegurar que la base de datos esté actualizada.
- El módulo de reportes requiere configuración de workers/cron jobs.
- Los indicadores utilizan caché con TTL de 12 horas (configurable).
- Se recomienda revisar los nuevos roles y permisos en la base de datos.
- Los componentes de UI están actualizados con el nuevo diseño.

---

**Fin del reporte de cambios**
