## Actualización del módulo de clientes (Q4 2025)

Este documento resume el estado actual del módulo de clientes tras la refactorización completada en octubre de 2025. Incluye la arquitectura de datos, reglas de negocio, comportamiento del frontend, API disponibles, validaciones y pruebas.

---

## Panorama general

- **Tipos de cliente soportados**
   1. **Persona natural** (DNI, CE o Pasaporte) con opción de asociar una empresa (persona jurídica).
   2. **Persona natural con RUC** (emprendedor). Puede facturar directamente sin empresa asociada.
   3. **Persona jurídica** registrada como empresa vinculada a una persona natural representante.
- **Validaciones centralizadas** en `src/lib/clientes/validation.ts` usando Prisma y errores tipados (`ClienteValidationError`).
- **Auditoría**: todas las operaciones de creación/actualización se registran en bitácora (ver API de clientes).
- **Seeds**: `prisma/seed.ts` incluye clientes representativos para cada tipo.

---

## Modelo de datos

### `Persona`
- Campos principales: `nombre`, `apellido_paterno`, `apellido_materno`, `tipo_documento`, `numero_documento` (único), `fecha_nacimiento`, `sexo`, `telefono`, `correo`, `nombre_comercial` (solo personas con RUC), `registrar_empresa` y `estatus`.
- Nuevos atributos:
   - `nombre_comercial` (hasta 150 caracteres) para personas con tipo RUC.
   - `fecha_nacimiento` obligatoria, se valida mayoría de edad (≥ 18).
- Relaciones con `Cliente`, `Proveedor`, `Usuario` y `EmpresaPersona` con `onDelete: Cascade` para mantener consistencia referencial.

### `EmpresaPersona`
- Tabla exclusiva para empresas de clientes: `persona_id` único, `ruc` único, `razon_social`, `nombre_comercial`, `direccion_fiscal`.
- Solo se crea cuando `registrar_empresa` es verdadero y el documento base no es un RUC.

### `Cliente`
- Relaciona una persona con el dominio comercial del taller.
- Mantiene `estatus` y `fecha_registro` para integridad con otros módulos (cotizaciones, órdenes, facturación).

---

## Validaciones clave

Todas las reglas viven en `validateClientePayload`:

- **Documento:**
   - `DNI` → 8 dígitos numéricos.
   - `RUC` → 11 dígitos numéricos.
   - Unicidad global por persona, y chequeo cruzado con `empresa_persona`.
- **Edad mínima:** se calcula en el servidor; error si `< 18` años.
- **Empresa asociada:**
   - Solo permitida para documentos distintos a RUC.
   - Requiere RUC válido, razón social obligatoria, y unicidad de RUC.
   - Si el usuario intenta asociar empresa con tipo RUC se muestra mensaje: “Ya estás registrando una persona con RUC, no es necesario asociar una empresa adicional.”
- **Nombre comercial:**
   - Personas con RUC pueden guardar `nombre_comercial` (≤ 150 chars).
   - Empresas asociadas también admiten nombre comercial opcional.
- **Contacto:** formato de teléfono (6-15 dígitos) y correo válido.

Los errores se devuelven con mensajes localizados y códigos HTTP apropiados.

---

## Endpoints relevantes

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/clientes` | Listado paginado con filtros por búsqueda, clasificación y estado. Devuelve estructura `ClienteCompleto`. |
| `POST` | `/api/clientes` | Crea cliente. Usa `validateClientePayload`, persiste persona, cliente y empresa asociada cuando aplica, y registra evento en bitácora. |
| `GET` | `/api/clientes/[id]` | Recupera cliente completo para edición, incluyendo empresa asociada. |
| `PUT` | `/api/clientes/[id]` | Actualiza cliente existente, sincronizando persona y empresa. Mantiene transacciones en una única operación Prisma. |
| `POST` | `/api/clientes/validar-documento` | Valida disponibilidad de DNI/RUC. Respuestas:
   - `{ disponible: true, mensaje: 'Documento disponible' }`
   - `{ disponible: false, mensaje: 'Este documento ya está registrado por …' }`
      (el sufijo indica si lo posee un cliente, proveedor o usuario)

Todos los endpoints requieren sesión válida vía `getServerSession(authOptions)`.

---

## Comportamiento del frontend (`src/components/clientes/cliente-form.tsx`)

- **Selector de tipo de documento** controla el formulario dinámico:
   - RUC: oculta “Registrar empresa” y habilita campo `nombre_comercial` de la persona.
   - Otros documentos: muestra checkbox “Registrar empresa” y, si se activa, despliega subformulario con RUC/razón social/dirección.
- **Validaciones en vivo** integradas con React Hook Form + Zod (adaptadas a los mensajes del backend).
- **Chequeo asíncrono de documento** usando `/api/clientes/validar-documento` para mostrar disponibilidad en tiempo real.
- **Reglas de UX**:
   - Bloquea fecha de nacimiento futura y muestra error si la edad calculada es menor a 18.
   - Advierte si se intenta registrar empresa con tipo RUC.
   - Normaliza espacios y mayúsculas en nombres.

La tabla de clientes (`src/components/clientes/clientes-table.tsx`) incorpora filtros combinables por clasificación (natural, con RUC, con empresa), estado comercial y capacidad de facturación.

---

## Semillas y datos de prueba

- `prisma/seed.ts` genera:
   - Persona natural con DNI.
   - Persona natural con RUC (incluye nombre comercial).
   - Persona natural + empresa asociada.
- Permiten validar filtros, disponibilidad de documentos y comportamiento de facturación.

---

## Pruebas automatizadas

- **Unitarias / API**: `tests/api/clientesIdApi.test.ts` y `tests/api/clientesValidarDocumentoApi.test.ts` mockean Prisma y next-auth para validar flujos de edición y verificación de documentos.
- **Typecheck**: ejecutar `npm run lint` y `npx tsc --noEmit` antes de subir cambios.

### Comando recomendado

```bash
npm exec -- jest tests/api/clientesValidarDocumentoApi.test.ts
npx tsc --noEmit
```

---

## Checklist de verificación manual

1. Crear cliente natural con DNI → sin empresa.
2. Crear cliente natural con DNI + empresa asociada → verificar creación de `empresa_persona` y que la empresa aparece en la tabla.
3. Crear cliente con RUC → confirmar que no se muestra subformulario de empresa y que se guarda `nombre_comercial`.
4. Editar cliente existente cambiando de DNI a RUC → validar reglas de unicidad y mensajes.
5. Eliminar cliente → asegurar cascada que remueve empresa vinculada.
6. Probar endpoint de validación con documento repetido → recibir mensaje contextual.

---

## Próximos pasos sugeridos

- Integrar módulo de proveedores reutilizando `empresa_persona` como referencia.
- Añadir pruebas E2E con Playwright para cubrir el flujo completo de creación/edición.
- Conectar la clasificación de clientes con reglas de facturación y reportes.