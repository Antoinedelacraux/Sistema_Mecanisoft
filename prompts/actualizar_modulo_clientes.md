### CONTEXTO DEL MÓDULO

Módulo de **clientes (personas)** del sistema del taller mecánico.

Actualmente, cada cliente se registra en la tabla `persona`, con los siguientes campos:
- tipo_documento (DNI, RUC, CE, Pasaporte)
- numero_documento
- nombres
- apellido_paterno
- apellido_materno
- sexo
- telefono
- correo
- fecha_registro
- estatus
- registrar_empresa (opcional, tipo booleano)

El campo `registrar_empresa` actualmente no tiene un comportamiento definido, por lo que se utilizará para **determinar si la persona desea registrar una empresa asociada**.  
El sistema permite registrar solo **una identidad por persona**, pero ahora se requiere manejar **casos mixtos** donde una persona natural también pueda tener una **empresa asociada**, o registrar directamente una persona natural con RUC.  

Además, se considera que más adelante se implementará un módulo de **proveedores**, por lo que la tabla de empresas asociadas a personas se llamará **`empresa_persona`**, evitando conflictos futuros con otras tablas como `empresa_proveedor`.

---

### NUEVOS REQUERIMIENTOS

#### 1. Tipos de clientes a soportar
El sistema debe manejar tres tipos de registros:

1. **Persona natural (DNI / CE / Pasaporte)**
   - Se registran nombres y apellidos normalmente.
   - Solo puede emitir **boletas**.
   - El campo `registrar_empresa` indica si desea asociar una empresa.
     - Si se marca, se abre un formulario adicional (ver punto 2).

2. **Persona natural con RUC (persona con negocio propio)**
   - Tipo de documento: RUC.
   - Campos: nombres, apellidos, RUC, opcional “nombre comercial”.
   - Puede emitir **facturas directamente**, sin requerir una empresa asociada.
   - No se utiliza el campo `registrar_empresa`.
   - No se crea registro en `empresa_persona`.

3. **Persona jurídica (empresa)**
   - Cliente principal: persona natural (DNI, CE, Pasaporte) que actúa como representante.
   - Si `registrar_empresa` es TRUE, se abre formulario para registrar:
     - RUC
     - Razón social
     - Nombre comercial (opcional)
     - Dirección fiscal
   - Estos datos se guardan en la tabla `empresa_persona`, relacionada con `persona` mediante una FK `persona_id`.
   - Esta empresa podrá emitir **facturas**.

---

### 2. Cambios requeridos en el formulario

- Mostrar selector `Tipo de documento`: [DNI, RUC, CE, Pasaporte].
- Si selecciona **RUC**:
  - Mostrar campo “Nombre comercial (opcional)”.
  - Ocultar casilla de “Registrar empresa”.
  - Ignorar el valor del campo `registrar_empresa`.
- Si selecciona **DNI**, **CE** o **Pasaporte**:
  - Mostrar casilla `[ ] Registrar empresa asociada`.
  - Si se marca, mostrar subformulario con los campos de empresa.
- Validar que no se repita el número de documento (RUC, DNI, etc.) en la base de datos.
- Mostrar advertencia si el usuario intenta registrar una empresa cuando el tipo_documento sea RUC.

---

### 3. Cambios en la base de datos

1. **Tabla `persona`:**
   - Mantener estructura actual.
   - Confirmar que `registrar_empresa` sea tipo `BOOLEAN` o `TINYINT(1)` (0 = no, 1 = sí).
   - Asegurar que `tipo_documento` acepte valores `'DNI'`, `'RUC'`, `'CE'`, `'PASAPORTE'`.

2. **Nueva tabla `empresa_persona`:**
   ```sql
   CREATE TABLE empresa_persona (
       id INT AUTO_INCREMENT PRIMARY KEY,
       persona_id INT NOT NULL,
       ruc VARCHAR(11) UNIQUE NOT NULL,
       razon_social VARCHAR(150) NOT NULL,
       nombre_comercial VARCHAR(100) NULL,
       direccion_fiscal VARCHAR(200) NULL,
       FOREIGN KEY (persona_id) REFERENCES persona(id)
   );

### 4. Validación de edades de clintes 
1. Registrar personas mayores de 18 años, implementar calendario para elegir fecha de nacimiento.
Agregar campo a tabla persona

Validaciones

Si el tipo_documento es RUC y el usuario marca o intenta registrar empresa → mostrar mensaje:

“Ya estás registrando una persona con RUC, no es necesario asociar una empresa adicional.”

Si el tipo_documento es DNI/CE/Pasaporte y el campo registrar_empresa es false, registrar solo la persona.

Si registrar_empresa es true, crear registro en empresa_persona vinculado a la persona.

Validar que el RUC no se repita en empresa_persona.

Si se elimina una persona, eliminar también su empresa asociada (ON DELETE CASCADE).

Si la persona no tiene 18 años o mas no se registra.

5. RESULTADO ESPERADO

Refactorizar el módulo de clientes para:

Soportar tres tipos de registro: persona natural, persona natural con RUC y persona jurídica.

Utilizar el campo registrar_empresa como bandera para mostrar o no el subformulario de empresa.

Crear automáticamente los registros en empresa_persona cuando corresponda.

Evitar registros duplicados de RUC o número de documento.

Mantener compatibilidad con los módulos de órdenes, cotizaciones y facturación.

Adaptar la interfaz para que sea dinámica según tipo de documento.

Preparar el sistema para integrar un futuro módulo de proveedores con su propia tabla empresa_proveedor.

Registrar personas a partir de los 18 años.

6. NOTA FINAL

Después de aplicar los cambios, ejecutar:

npx tsc --noEmit

para verificar que no existan errores de tipado ni conflictos con los módulos actuales.