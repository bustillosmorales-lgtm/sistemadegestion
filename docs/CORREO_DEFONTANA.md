# Correo para Solicitar Información Técnica a Defontana

## 📧 Versión 1: Formal y Completa

---

**Asunto:** Solicitud de Información Técnica - Integración API de Ventas

Estimado equipo de Defontana:

Mi nombre es [TU NOMBRE] de [TU EMPRESA], somos clientes actuales de Defontana con Company ID [TU_COMPANY_ID].

Estamos desarrollando una integración automatizada para importar nuestro historial de ventas desde Defontana hacia nuestro sistema de gestión de inventario y predicción de demanda. El objetivo es utilizar estos datos para mejorar nuestras proyecciones de reposición mediante análisis de machine learning.

**Confirmación de uso y seguridad:**
- La integración será exclusivamente de **lectura** (solo GET requests)
- **NO modificaremos** ningún dato en Defontana
- **NO crearemos** documentos, ventas ni registros en Defontana
- Solo importaremos datos de ventas hacia nuestro sistema interno

Para implementar esta integración de manera correcta desde el primer intento, necesitamos conocer los detalles técnicos exactos de su API REST. Agradeceríamos mucho si pueden proporcionarnos la siguiente información:

---

### 1. AUTENTICACIÓN Y CREDENCIALES

- ¿Cómo se obtiene el API Key para integraciones? (ya tenemos uno, solo confirmando)
- ¿El Company ID que utilizamos es: [TU_COMPANY_ID]?
- ¿La autenticación se realiza mediante Bearer Token en el header?
  ```
  Authorization: Bearer {API_KEY}
  ```
- ¿Existe algún ambiente de pruebas (sandbox) disponible?
- ¿Cuál es la URL base de la API?
  - Producción: ¿`https://api.defontana.com`?
  - Sandbox (si existe): ¿`https://sandbox-api.defontana.com`?

---

### 2. ENDPOINT DE VENTAS

Necesitamos el endpoint exacto para obtener ventas históricas:

**¿Cuál es el endpoint correcto?**
- ¿Es: `/api/v1/companies/{companyId}/sales`?
- ¿O tiene otra estructura?

**Parámetros que acepta:**
- ¿Acepta filtros por fecha? (`dateFrom`, `dateTo`)
- ¿Formato de fecha esperado? (ej: `YYYY-MM-DD`, `DD-MM-YYYY`, timestamp)
- ¿Soporta paginación? (`page`, `pageSize`, `limit`, `offset`)
- ¿Cuál es el tamaño máximo de página? (ej: ¿100, 500, 1000 registros?)
- ¿Qué otros parámetros opcionales acepta?

**Ejemplo de llamada:**
```
GET https://api.defontana.com/api/v1/companies/{companyId}/sales?dateFrom=2024-01-01&dateTo=2024-12-31&page=1&pageSize=100
```
¿Es correcto este formato?

---

### 3. ESTRUCTURA DE LA RESPUESTA JSON

**Esta es la parte más importante.** Necesitamos conocer la estructura exacta del JSON de respuesta para mapear correctamente los datos.

**Por favor, proporcionen:**

1. **Ejemplo de respuesta completa** (pueden anonimizar los datos sensibles)

2. **Nombres exactos de los campos** que necesitamos extraer:

**A nivel de documento de venta:**
- ¿Cómo se llama el campo de fecha de la venta?
  - ¿`date`, `fecha`, `saleDate`, `created_at`, otro?
- ¿Cómo se llama el campo de ID del documento?
  - ¿`id`, `saleId`, `documentId`, otro?
- ¿Cómo se llama el campo de número de documento?
  - ¿`documentNumber`, `number`, `folio`, otro?
- ¿Cómo se llama el campo de cliente?
  - ¿`customerName`, `cliente`, `customer.name`, otro?

**A nivel de detalle/items de venta:**
- ¿Cómo se llama el array de productos vendidos?
  - ¿`items`, `details`, `detalles`, `products`, otro?
- ¿Cómo se llama el campo de código/SKU del producto?
  - ¿`sku`, `code`, `productCode`, `codigo`, otro?
- ¿Cómo se llama el campo de cantidad vendida?
  - ¿`quantity`, `qty`, `cantidad`, `units`, otro?
- ¿Cómo se llama el campo de precio unitario?
  - ¿`unitPrice`, `price`, `precio`, `pricePerUnit`, otro?
- ¿Hay campo de nombre del producto?
  - ¿`productName`, `name`, `descripcion`, otro?

**Estructura esperada:**
```json
{
  "[campo_array_ventas]": [
    {
      "[campo_id]": "V-12345",
      "[campo_fecha]": "2024-01-15",
      "[campo_numero_documento]": "F-001-00123",
      "[campo_cliente]": "Cliente Ejemplo S.A.",
      "[campo_array_items]": [
        {
          "[campo_sku]": "PROD-001",
          "[campo_cantidad]": 5,
          "[campo_precio_unitario]": 15000,
          "[campo_nombre_producto]": "Producto Ejemplo"
        }
      ]
    }
  ],
  "[campo_paginacion]": {
    "[campo_tiene_mas]": true,
    "[campo_total]": 1523
  }
}
```

¿Pueden completar los nombres de campos entre corchetes?

---

### 4. LÍMITES Y RESTRICCIONES

- ¿Existe un límite de rate limiting? (ej: 100 requests/minuto)
- ¿Cuál es el máximo de registros por request?
- ¿Existe un límite en el rango de fechas que se puede consultar?
- ¿Hay alguna restricción horaria para las consultas?

---

### 5. CAMPOS ADICIONALES ÚTILES

¿Están disponibles estos campos adicionales?
- Estado del documento (anulado, vigente, etc.)
- Tipo de documento (factura, boleta, nota de crédito, etc.)
- Moneda de la transacción
- Bodega/sucursal de la venta
- Vendedor asociado

---

### 6. MANEJO DE ERRORES

¿Qué códigos HTTP y mensajes de error podemos esperar?
- 401: ¿Credenciales inválidas?
- 404: ¿Recurso no encontrado?
- 429: ¿Rate limit excedido?
- 500: ¿Error del servidor?

¿Los errores vienen en algún formato específico?
```json
{
  "error": "mensaje",
  "code": "ERROR_CODE"
}
```

---

### 7. DOCUMENTACIÓN

¿Tienen documentación técnica de la API disponible?
- URL de documentación
- Ejemplos de uso
- Postman Collection o similar

---

### 8. EJEMPLO REAL (OPCIONAL PERO IDEAL)

Si es posible, agradeceríamos un **ejemplo real de respuesta** de nuestro Company ID (con datos anonimizados si es necesario), para que podamos mapear exactamente los campos.

Ejemplo de llamada que haríamos:
```bash
curl -X GET "https://api.defontana.com/api/v1/companies/[NUESTRO_COMPANY_ID]/sales?dateFrom=2024-01-01&dateTo=2024-01-07&page=1&pageSize=1" \
  -H "Authorization: Bearer [NUESTRO_API_KEY]" \
  -H "Content-Type: application/json"
```

---

### RESUMEN DE DATOS CRÍTICOS QUE NECESITAMOS EXTRAER:

Para nuestro análisis de demanda, solo necesitamos estos 4 campos esenciales:

1. **SKU/Código del producto** → Para identificar qué se vendió
2. **Cantidad vendida** → Para cuantificar la demanda
3. **Precio unitario** → Para análisis de valor (opcional)
4. **Fecha de venta** → Para análisis temporal

Todo lo demás es metadata complementaria pero no crítica.

---

Agradecemos de antemano su tiempo y colaboración. Esta información nos permitirá implementar la integración de manera eficiente y sin riesgos para la plataforma.

Quedamos atentos a su respuesta.

Saludos cordiales,

[TU NOMBRE]
[TU CARGO]
[TU EMPRESA]
[TU EMAIL]
[TU TELÉFONO]

---

---

## 📧 Versión 2: Directa y Técnica

---

**Asunto:** Consulta Técnica - Estructura API REST para Importar Ventas

Hola equipo de Defontana,

Soy [TU NOMBRE] de [TU EMPRESA] (Company ID: [TU_COMPANY_ID]).

Estoy integrando nuestra plataforma con su API para importar ventas históricas (solo lectura). Para mapear correctamente los datos, necesito confirmar:

**1. Endpoint de Ventas:**
```
GET /api/v1/companies/{companyId}/sales?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=1&pageSize=100
```
¿Es correcto? ¿Qué parámetros acepta exactamente?

**2. Estructura JSON de Respuesta:**

Necesito los nombres exactos de estos campos:
- Campo que contiene el array de ventas: ¿`sales`, `data`, `results`?
- Fecha de venta: ¿`date`, `fecha`, `saleDate`?
- Array de items: ¿`items`, `details`, `detalles`?
- SKU del producto: ¿`sku`, `code`, `productCode`?
- Cantidad: ¿`quantity`, `qty`, `cantidad`?
- Precio: ¿`unitPrice`, `price`, `precio`?

**Ejemplo ideal:**
```json
{
  "NOMBRE_CAMPO_ARRAY": [
    {
      "NOMBRE_CAMPO_FECHA": "2024-01-15",
      "NOMBRE_CAMPO_ITEMS": [
        {
          "NOMBRE_CAMPO_SKU": "ABC123",
          "NOMBRE_CAMPO_CANTIDAD": 5,
          "NOMBRE_CAMPO_PRECIO": 1000
        }
      ]
    }
  ]
}
```

¿Pueden completar los nombres reales?

**3. Límites:**
- Rate limit: ¿requests/minuto?
- Max registros por página: ¿100, 500, 1000?

**4. ¿Tienen documentación de la API o Postman Collection?**

Muchas gracias!

[TU NOMBRE]
[EMAIL]
[TELÉFONO]

---

---

## 📋 Checklist para Enviar

Antes de enviar el correo, asegúrate de:

- [ ] Reemplazar [TU NOMBRE] con tu nombre real
- [ ] Reemplazar [TU EMPRESA] con el nombre de tu empresa
- [ ] Reemplazar [TU_COMPANY_ID] con tu Company ID real
- [ ] Reemplazar [TU CARGO] con tu cargo
- [ ] Agregar tu email y teléfono de contacto
- [ ] Revisar ortografía
- [ ] Enviar a: soporte@defontana.com o el email de soporte técnico que tengas

---

## 💡 Consejo

Si tienes un ejecutivo comercial asignado en Defontana, cópialo en el correo. Suele acelerar las respuestas.

---

## 📥 Qué Hacer Cuando Te Respondan

1. **Guarda la respuesta** en un archivo de texto
2. **Compárteme la información** que te envíen
3. **Ajustaré el código** de `defontana-sync.js` con los nombres exactos
4. **Probaremos la conexión** con el script de test
5. **Conectarás con confianza** sabiendo que funcionará al primer intento

---

¡Éxito con el correo! 🚀
