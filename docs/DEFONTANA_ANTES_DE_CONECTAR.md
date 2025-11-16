# ⚠️ IMPORTANTE: Leer Antes de Conectar Defontana

## 🔐 Seguridad

**✅ ES SEGURO CONECTAR**

La integración con Defontana es **100% de solo lectura**:

- ✅ Solo hace GET requests (lectura)
- ✅ NO modifica nada en Defontana
- ✅ NO crea documentos en Defontana
- ✅ NO elimina datos de Defontana
- ✅ NO envía información desde tu sistema a Defontana

**Lo único que hace:**
1. Lee las ventas históricas de Defontana
2. Las guarda en TU base de datos (tabla `ventas`)
3. Usa esos datos para mejorar predicciones

---

## 📊 ¿Dónde se Guardan las Ventas?

Las ventas se guardan en la tabla **`ventas`** de tu Supabase con esta estructura:

```sql
CREATE TABLE ventas (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,           -- Código del producto
  unidades INTEGER NOT NULL,            -- Cantidad vendida
  precio_unitario DECIMAL(12,2),       -- Precio de venta
  fecha_venta DATE NOT NULL,            -- Fecha de la venta
  origen VARCHAR(50) DEFAULT 'manual', -- 'defontana', 'bsale', 'manual'
  metadata JSONB,                       -- Info adicional (ID venta, cliente, etc.)
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Ejemplo de registro:**
```json
{
  "sku": "ABC123",
  "unidades": 5,
  "precio_unitario": 15000,
  "fecha_venta": "2024-01-15",
  "origen": "defontana",
  "metadata": {
    "saleId": "V-12345",
    "documentNumber": "F-001-00123",
    "customerName": "Cliente Ejemplo"
  }
}
```

---

## ⚠️ VERIFICACIONES NECESARIAS

### 1. Verificar que la Tabla `ventas` Existe

**Ejecutar en Supabase SQL Editor:**

```bash
node scripts/check-tabla-ventas.sql
```

O manualmente:
1. Ve a Supabase → SQL Editor
2. Ejecuta el contenido de `scripts/check-tabla-ventas.sql`
3. Verifica que la tabla se creó correctamente

### 2. Verificar la API de Defontana

**IMPORTANTE**: El código actual asume una estructura de API que podría no ser exacta.

**Antes de sincronizar, verifica:**

1. **Endpoint correcto**: ¿Es realmente `/api/v1/companies/{id}/sales`?
2. **Parámetros**: ¿Qué parámetros acepta? (dateFrom, dateTo, etc.)
3. **Estructura de respuesta**: ¿Cómo vienen los datos?

**Ejecutar script de prueba:**

```bash
# 1. Configura credenciales temporalmente en .env.local:
DEFONTANA_API_KEY=tu_api_key_aqui
DEFONTANA_COMPANY_ID=tu_company_id_aqui
DEFONTANA_ENVIRONMENT=production

# 2. Ejecuta el test:
node scripts/test-defontana-connection.js
```

Este script:
- ✅ Prueba la conexión sin modificar nada
- ✅ Muestra la estructura real de la respuesta
- ✅ Te ayuda a verificar si el código necesita ajustes

---

## 📚 Documentación de la API de Defontana

**Necesitas consultar:**

1. **Panel de Defontana**:
   - Configuración → API → Documentación
   - Integraciones → Desarrolladores

2. **Información que necesitas:**
   - URL base de la API
   - Endpoint para obtener ventas
   - Formato de autenticación
   - Estructura de la respuesta
   - Límites de rate limiting

3. **Soporte de Defontana**:
   - Si no encuentras la documentación, contacta a soporte
   - Solicita ejemplos de uso de la API

---

## 🔄 Flujo de Sincronización

Cuando sincronices ventas, esto es lo que sucede:

```
┌─────────────────┐
│   Defontana     │
│  (Solo lectura) │
└────────┬────────┘
         │ GET /sales
         │ (últimos 12 meses)
         ▼
┌─────────────────┐
│  Tu Sistema     │
│  (Procesa)      │
└────────┬────────┘
         │ Extrae: SKU, cantidad,
         │         precio, fecha
         ▼
┌─────────────────┐
│   Supabase      │
│  tabla: ventas  │
│  origen: 'defontana'
└─────────────────┘
```

**Pasos internos:**

1. Se conecta a Defontana con tu API Key
2. Solicita ventas (paginado, 100 por página)
3. Por cada venta:
   - Extrae SKU, cantidad, precio, fecha
   - La guarda en `ventas` con `origen='defontana'`
4. Registra el resultado en `sync_logs`

**NO se envía nada de vuelta a Defontana**

---

## 🛡️ Permisos Necesarios en Defontana

Tu API Key de Defontana solo necesita:

- ✅ Lectura de ventas (`sales:read`)
- ❌ NO necesita permisos de escritura
- ❌ NO necesita permisos de modificación
- ❌ NO necesita permisos de eliminación

**Verifica en Defontana** que tu API Key tenga acceso de lectura a ventas.

---

## 🚦 Checklist Antes de Conectar

- [ ] Ejecuté el SQL para crear tabla `ventas` en Supabase
- [ ] Ejecuté el SQL para crear tablas de integración (`integraciones_config`, `sync_logs`)
- [ ] Tengo mi API Key de Defontana
- [ ] Tengo mi Company ID de Defontana
- [ ] Ejecuté `test-defontana-connection.js` para verificar conexión
- [ ] Verifiqué la estructura de la respuesta de la API
- [ ] Confirmé que el endpoint es correcto
- [ ] Mi API Key tiene permisos de lectura de ventas

---

## ⚙️ Si Necesitas Ajustar el Código

Si la estructura de la API de Defontana es diferente, necesitarás ajustar:

**Archivo**: `netlify/functions/defontana-sync.js`

**Sección a revisar** (líneas ~50-70):

```javascript
// Ajusta este endpoint según documentación de Defontana
const response = await fetch(
  `${baseUrl}/api/v1/companies/${companyId}/sales?...`,
  { /* ... */ }
);

const data = await response.json();

// Ajusta según estructura real de respuesta
if (data.sales && data.sales.length > 0) {
  allSales = allSales.concat(data.sales);
}

// Ajusta extracción de campos según estructura real
for (const item of items) {
  const sku = item.sku || item.productCode || item.code;
  const quantity = parseInt(item.quantity || item.qty || 0);
  const unitPrice = parseFloat(item.unitPrice || item.price || 0);
}
```

---

## 📞 Soporte

Si tienes dudas:

1. **Revisa documentación de Defontana API**
2. **Ejecuta el script de prueba** para ver la estructura real
3. **Contacta a Defontana** si necesitas ayuda con su API
4. **Revisa los logs** en Supabase tabla `sync_logs`

---

## ✅ Una Vez Verificado Todo

Cuando hayas verificado que todo está correcto:

1. Ve a Dashboard → ⚙️ Configuración → 🔗 Integraciones
2. Ingresa tus credenciales de Defontana
3. Click en "Guardar y Conectar"
4. Click en "🔄 Sincronizar Ventas Ahora"
5. Espera confirmación
6. Verifica en Supabase que las ventas se guardaron:

```sql
SELECT COUNT(*) as total_ventas
FROM ventas
WHERE origen = 'defontana';
```

---

**¡Listo para conectar de forma segura!** 🚀
