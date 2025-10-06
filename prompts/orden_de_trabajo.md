---
mode: agent
---

## 🧩 CONTEXTO DEL MÓDULO

Módulo de **órdenes de trabajo** del sistema web de taller mecánico.

Cada orden de trabajo debe contener:
- Un cliente previamente registrado.
- Uno de sus vehículos registrados.
- Uno o varios servicios seleccionados.
- (Opcionalmente) productos asociados a ciertos servicios.
- (Opcionalmente) mecánicos asignados, que se pueden definir más adelante.
- Un **resumen general** de todo lo escogido.

---

## ⚙️ REGLAS DE NEGOCIO

### 1. Creación de nueva orden
- Antes de crear la orden, validar si el cliente requiere:
  - Solo **servicios**, o  
  - **Servicios y productos** (por ejemplo: cambio de motor y compra del motor en el taller).
- Cada servicio puede tener **0 o 1 producto asociado**.
- En una misma orden, algunos servicios pueden tener producto asociado y otros no.
- Los mecánicos pueden **no asignarse al momento de registrar la orden**; se podrán agregar más adelante.
- El estado inicial de toda nueva orden será **"Pendiente"**, lo que significa que **aún no ha sido enviada al Kanban**.

---

### 2. Duración de los servicios
- Cada servicio tiene una duración **por rango (mínimo y máximo)** y su respectiva unidad (`minutos`,`horas`, `días`, `semanas`).
- Ejemplos:
  - Cambio de motor → 1–2 semanas  
  - Limpieza de auto → 1–2 días  
  - Cambio de retrovisor → 3–4 horas  
- El sistema debe calcular automáticamente el **rango total estimado de duración** de la orden:
  - Convertir todas las unidades a una base común (por ejemplo, horas).
  - Sumar los tiempos mínimos y máximos de cada servicio.
  - Guardar los valores finales en los campos:
    - `duracion_min`
    - `duracion_max`
    - `unidad_tiempo`

---

### 3. Registro y gestión de órdenes
- Una vez registrada, la orden aparecerá en una **tabla** (cada fila representa una orden).
- En cada fila debe existir una **acción o botón** para **validar si la orden está lista para enviarse al Kanban**.
- Una orden solo puede enviarse al Kanban si:
  - Tiene al menos un servicio correctamente registrado.
  - Tiene asignado al menos un mecánico.
  - Está lista para iniciar su ejecución.
- Cuando se valida y envía al Kanban:
  - Su estado cambia de `"Pendiente"` a `"Por hacer"`.
  - La orden se muestra automáticamente en la columna **"Por hacer"** del tablero Kanban.
  - A partir de este momento, **ya no puede editarse**.
- Si la orden aún está `"Pendiente"`, debe poder:
  - Editarse (todo menos el cliente).
---

## 🎯 RESULTADO ESPERADO

Refactorizar el módulo de creación y gestión de órdenes de trabajo para:
- Validar si se requiere producto por cada servicio seleccionado.  
- Permitir crear órdenes sin mecánicos asignados (opcional).  
- Calcular automáticamente la duración total estimada (rango min–max).  
- Mostrar las órdenes en una tabla con botón o acción para **“Enviar al Kanban”**.  
- Al enviarse al Kanban, cambiar el estado a `"Por hacer"` y bloquear la edición.  
- Mantener la posibilidad de edición solo mientras la orden esté en estado `"Pendiente"`.  
- Reflejar correctamente los estados del Kanban:  
  - `Por hacer`  
  - `En proceso`  
  - `Pausado`  
  - `Completado`  

---

## 🧠 Instrucción para Copilot

@workspace  
Aplica esta nueva lógica en todos los archivos relacionados con el **módulo de órdenes de trabajo**. 
Asegura la coherencia entre la validación de servicios/productos, la asignación de mecánicos, el cálculo de tiempos y el flujo de estados dentro del tablero Kanban.

## 🧪 Verificación final

Una vez implementados los cambios, asegúrate de que el código compile sin errores ejecutando el siguiente comando:

```bash
npx tsc --noEmit