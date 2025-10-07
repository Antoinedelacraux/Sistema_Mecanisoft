# Módulo de Facturación para Boleta y Factura (Perú)

## 1. Contexto Legal y Operativo
En Perú, la facturación electrónica es obligatoria para la mayoría de empresas. Los comprobantes principales son:
- **Boleta de venta**: Para consumidores finales (personas naturales, sin RUC).
- **Factura**: Para empresas/personas con RUC, permite crédito fiscal.

Ambos deben cumplir requisitos SUNAT: numeración, formato, envío electrónico, y validación.

## 2. Relación con Tablas Existentes
- **Cliente**: Debe almacenar tipo de documento (DNI, RUC), nombre/razón social, dirección, correo.
- **Cotización**: Puede convertirse en boleta/factura si el cliente acepta y aprueba.
- **Orden de trabajo**: Puede ser fuente de facturación si implica servicios/productos entregados.

## 3. Estructura de Datos Sugerida
### Tabla: comprobante
- id_comprobante (PK)
- tipo ('boleta', 'factura')
- serie, numero
- fecha_emision
- id_cliente (FK)
- id_orden_trabajo (FK, opcional)
- id_cotizacion (FK, opcional)
- total, igv, subtotal
- estado ('emitido', 'anulado', 'enviado_sunat', etc)
- xml_sunat, pdf_url, cdr_url

### Tabla: detalle_comprobante
- id_detalle (PK)
- id_comprobante (FK)
- descripcion
- cantidad
- precio_unitario
- descuento
- tipo_item ('producto', 'servicio')
- referencia_id (FK a producto/servicio)

## 4. Flujo de Facturación
1. **Cotización aprobada** → opción "Emitir boleta/factura".
2. Selección de tipo de comprobante según cliente:
   - Si cliente tiene RUC → factura.
   - Si solo DNI → boleta.
3. Generar comprobante con datos de cliente, items, totales.
4. Enviar a SUNAT vía API (proveedor OSE o facturador propio).
5. Guardar respuesta (XML, CDR, PDF).
6. Cambiar estado de comprobante y mostrar/descargar al usuario.

## 5. Requisitos Técnicos
- Integración con API SUNAT/OSE (ejemplo: Nubefact, Facturador SUNAT).
- Validación de datos: RUC/DNI, totales, formato.
- Generación de PDF y XML.
- Registro de estados y logs de envío.

## 6. UI/UX Sugerida
- Botón "Emitir boleta/factura" en cotización/orden aprobada.
- Formulario para revisar/editar datos de cliente y comprobante.
- Visualización y descarga de PDF/XML/CDR.
- Estado de envío y respuesta SUNAT.

## 7. Consideraciones
- Manejar anulaciones y notas de crédito.
- Validar duplicidad de serie/número.
- Cumplir con numeración y formatos oficiales.
- Guardar comprobantes y respuestas SUNAT para auditoría.

## 8. Ejemplo de Integración
- Usar API REST de Nubefact para emitir y consultar comprobantes.
- Guardar respuesta y actualizar estado en la base de datos.

---
**Referencias:**
- [SUNAT: Facturación Electrónica](https://www.sunat.gob.pe/factura-electronica/)
- [Nubefact API](https://www.nubefact.com/api/)
- [Formato UBL Perú](https://cpe.sunat.gob.pe/sites/default/files/inline-files/UBL%20Per%C3%BA.pdf)
