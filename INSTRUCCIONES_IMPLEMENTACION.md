# 📋 Instrucciones de Implementación - Sistema de Múltiples Órdenes

## ⚠️ IMPORTANTE: Leer antes de comenzar

Esta implementación es un **cambio arquitectónico significativo** que afectará:
- Cómo se rastrean las órdenes de compra
- Cómo se calculan las cantidades necesarias
- Cómo se muestran los datos en el dashboard
- Cómo funcionan las importaciones/exportaciones

**Tiempo estimado:** 2-3 horas
**Complejidad:** Alta
**Requiere:** Acceso a base de datos Supabase

---

## 📦 Paso 1: Backup de Base de Datos

**ANTES DE HACER CUALQUIER COSA:**

```bash
# Crear backup completo de Supabase
# Ir a Supabase Dashboard > Project Settings > Database > Backups
# Crear un backup manual
```

**Guardar datos críticos:**
```sql
-- Export current products status
COPY (SELECT sku, status, request_details, quote_details, analysis_details FROM products WHERE status != 'NEEDS_REPLENISHMENT') TO '/tmp/products_backup.csv' WITH CSV HEADER;
```

---

## 🗄️ Paso 2: Crear Tabla purchase_orders

**Opción A: Via Supabase SQL Editor (Recomendado)**

1. Ir a Supabase Dashboard > SQL Editor
2. Copiar el contenido de: `scripts/create_purchase_orders_table.sql`
3. Ejecutar el script
4. Verificar que la tabla se creó correctamente:

```sql
SELECT * FROM purchase_orders LIMIT 1;
SELECT * FROM v_purchase_orders_summary LIMIT 1;
```

**Opción B: Via script Node.js**

```bash
# Instalar dependencias si no están
npm install @supabase/supabase-js dotenv

# Ejecutar script
node scripts/create_purchase_orders_table_node.js
```

**Verificación:**
```sql
-- Debe retornar las columnas: id, sku, order_number, cantidad_solicitada, etc.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'purchase_orders';

-- Verificar triggers
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders';
```

---

## 🔄 Paso 3: Migrar Datos Existentes

**CRÍTICO:** Este paso mueve los datos de `products.status` a `purchase_orders`

```bash
# Ejecutar migración
node scripts/migrate_to_purchase_orders.js
```

**El script hará:**
1. ✅ Buscar productos con status ≠ NEEDS_REPLENISHMENT
2. ✅ Crear orden en purchase_orders por cada uno
3. ✅ Copiar todos los detalles (request_details, quote_details, etc.)
4. ✅ Actualizar products.primary_status
5. ✅ Limpiar campos de detalles en products

**Verificar migración:**
```sql
-- Contar órdenes creadas
SELECT COUNT(*) FROM purchase_orders;

-- Ver distribución por status
SELECT status, COUNT(*) FROM purchase_orders GROUP BY status;

-- Verificar que products se actualizó
SELECT sku, status, primary_status, has_active_orders
FROM products
WHERE primary_status IS NOT NULL
LIMIT 10;
```

**Si algo sale mal:**
```sql
-- Rollback: Eliminar tabla y restaurar backup
DROP TABLE purchase_orders CASCADE;
-- Restaurar desde backup de Supabase
```

---

## 🔧 Paso 4: Actualizar Código del Sistema

### 4.1 Actualizar analysis-cached.js

**Ubicación:** `pages/api/analysis-cached.js`

**Cambios necesarios:**

1. Importar helper:
```javascript
import { getActiveOrdersSummaryBatch, calculateReplenishmentStatus } from '../../lib/purchaseOrdersHelper';
```

2. Después de obtener `skuList` (línea ~254), agregar:
```javascript
// Obtener órdenes activas para todos los SKUs
console.log(`📦 Obteniendo órdenes activas para ${skuList.length} SKUs...`);
const ordersSummaryMap = await getActiveOrdersSummaryBatch(skuList);
console.log(`✅ Órdenes obtenidas para ${ordersSummaryMap.size} SKUs`);
```

3. Dentro del loop de `basicResults` (línea ~302), después de calcular `cantidadSugerida`:
```javascript
// Obtener info de órdenes
const ordersSummary = ordersSummaryMap.get(product.sku) || {
  hasOrders: false,
  totalOrders: 0,
  cantidadEnProceso: 0,
  orders: []
};

// Calcular estado de reposición
const replenishmentStatus = calculateReplenishmentStatus(
  cantidadSugerida, // cantidad total necesaria
  ordersSummary.cantidadEnProceso // cantidad en proceso
);
```

4. En el return del objeto result (línea ~442), agregar:
```javascript
// Campos existentes...
cantidadSugerida: cantidadSugerida,

// NUEVOS CAMPOS:
cantidadTotalNecesaria: replenishmentStatus.cantidadTotalNecesaria,
cantidadEnProceso: replenishmentStatus.cantidadEnProceso,
cantidadPendiente: replenishmentStatus.cantidadPendiente,
replenishmentStatus: replenishmentStatus.status,
replenishmentAlert: replenishmentStatus.alert,
needsAdditionalAction: replenishmentStatus.needsAction,
activeOrders: ordersSummary.orders,
totalActiveOrders: ordersSummary.totalOrders,
```

### 4.2 Actualizar import-by-action.js

**Ubicación:** `pages/api/import-by-action.js`

**Cambios en `processRequestQuote`** (línea ~338):

```javascript
import { createPurchaseOrder } from '../../lib/purchaseOrdersHelper';

async function processRequestQuote(sku, row) {
  const cantidadACotizar = parseInt(row['📝 Cantidad a Cotizar']);
  const comentarios = row['📝 Comentarios'] || '';

  if (!cantidadACotizar || cantidadACotizar <= 0) {
    throw new Error('Cantidad a cotizar debe ser mayor a 0');
  }

  // NUEVO: Crear orden en purchase_orders en lugar de actualizar products.status
  await createPurchaseOrder(sku, cantidadACotizar, comentarios);

  // Actualizar primary_status del producto
  await supabase
    .from('products')
    .update({ primary_status: 'QUOTE_REQUESTED' })
    .eq('sku', sku);
}
```

**Similar para todas las funciones:**
- `processQuote` - Actualizar orden en purchase_orders
- `processAnalyze` - Actualizar orden en purchase_orders
- `processApprove` - Actualizar orden en purchase_orders
- etc.

### 4.3 Actualizar export-by-status.js

**Ubicación:** `pages/api/export-by-status.js`

**Para NEEDS_REPLENISHMENT**, agregar columnas:
```javascript
const excelData = filteredData.map(product => ({
  'SKU': product.sku,
  'Descripción': product.descripcion,
  'Stock Actual': product.stock_actual,
  'Cantidad Total Necesaria': product.cantidadTotalNecesaria || product.cantidadSugerida,
  'Cantidad en Proceso': product.cantidadEnProceso || 0,
  'Cantidad Pendiente': product.cantidadPendiente || product.cantidadSugerida,
  '⚠️ Alerta': product.replenishmentAlert?.message || '',
  '📝 Cantidad a Cotizar': '',
  '📝 Comentarios': ''
}));
```

**Para otros status**, mostrar info de órdenes:
```javascript
// Consultar purchase_orders para este status
const { data: orders } = await supabase
  .from('purchase_orders')
  .select('*')
  .eq('status', status)
  .order('created_at', { ascending: false });

// Una fila por orden
const excelData = orders.map(order => ({
  'Número de Orden': order.order_number,
  'SKU': order.sku,
  'Cantidad Solicitada': order.cantidad_solicitada,
  'Cantidad Recibida': order.cantidad_recibida,
  'Status': order.status,
  'Creada': order.created_at,
  // ... otros campos según el status
}));
```

### 4.4 Actualizar dashboard-stats.js

**Ubicación:** `pages/api/dashboard-stats.js`

**Cambiar contador de NEEDS_REPLENISHMENT:**
```javascript
// ANTES:
if (status === 'NEEDS_REPLENISHMENT') {
  statusCounts.NEEDS_REPLENISHMENT++;
}

// DESPUÉS:
// Contar solo productos con cantidadPendiente > 0
// (Este valor viene del análisis)
```

**Agregar nuevo contador:**
```javascript
statusCounts.PARTIAL_ORDERS = 0; // Productos con órdenes parciales

if (product.replenishmentStatus === 'PARTIAL') {
  statusCounts.PARTIAL_ORDERS++;
}
```

---

## 🎨 Paso 5: Actualizar UI del Dashboard

### 5.1 Mostrar alertas de reposición adicional

**Ubicación:** `pages/dashboard.js`

**En la card de cada producto:**
```jsx
{producto.replenishmentAlert && (
  <div className={`mt-2 p-2 rounded ${
    producto.replenishmentAlert.type === 'critical' ? 'bg-red-100 border border-red-300' :
    producto.replenishmentAlert.type === 'warning' ? 'bg-yellow-100 border border-yellow-300' :
    'bg-blue-100 border border-blue-300'
  }`}>
    <span className="text-sm">
      {producto.replenishmentAlert.icon} {producto.replenishmentAlert.message}
    </span>
  </div>
)}
```

### 5.2 Mostrar info de órdenes activas

```jsx
{producto.totalActiveOrders > 0 && (
  <div className="mt-2 text-sm text-gray-600">
    📦 {producto.totalActiveOrders} orden{producto.totalActiveOrders > 1 ? 'es' : ''} activa{producto.totalActiveOrders > 1 ? 's' : ''}
    <button onClick={() => setShowOrders(producto.sku)} className="ml-2 text-blue-600 underline">
      Ver detalles
    </button>
  </div>
)}
```

### 5.3 Modal de órdenes por SKU

**Crear componente nuevo:**
```jsx
// components/OrdersModal.js
export default function OrdersModal({ sku, orders, onClose, onCreateOrder }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Órdenes para {sku}</h2>

        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.order_number} className="border p-4 rounded">
              <div className="flex justify-between">
                <span className="font-semibold">{order.order_number}</span>
                <span className={`px-2 py-1 rounded text-sm ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div className="mt-2 text-sm">
                <span>Cantidad: {order.cantidad_solicitada} unidades</span>
                <span className="ml-4">Creada: {new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={onCreateOrder} className="bg-green-600 text-white px-4 py-2 rounded">
            + Nueva Orden
          </button>
          <button onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ Paso 6: Pruebas

### 6.1 Prueba de cálculos

1. Crear producto de prueba:
```sql
INSERT INTO products (sku, descripcion, stock_actual, status, precio_venta_sugerido)
VALUES ('TEST-MULTI-001', 'Producto Test Múltiples Órdenes', 100, 'NEEDS_REPLENISHMENT', 10000);
```

2. Verificar que aparece en NEEDS_REPLENISHMENT con cantidad sugerida

3. Crear primera orden parcial (500 de 1000 necesarias):
- Exportar NEEDS_REPLENISHMENT
- Marcar TEST-MULTI-001 para cotizar 500 unidades
- Importar

4. Verificar:
```sql
SELECT * FROM purchase_orders WHERE sku = 'TEST-MULTI-001';
-- Debe mostrar 1 orden de 500 unidades con status QUOTE_REQUESTED
```

5. Verificar en dashboard:
- Debe mostrar alerta: "⚠️ Orden parcial - Necesita 500 unidades adicionales"
- Debe mostrar: "En proceso: 500 unidades"
- Debe mostrar: "Pendiente: 500 unidades"

6. Crear segunda orden (500 restantes):
- El producto debe seguir apareciendo en análisis con cantidadPendiente = 500
- Crear otra orden de 500
- Verificar que ahora cantidadPendiente = 0

### 6.2 Prueba de múltiples órdenes en diferentes status

1. Crear órdenes en diferentes fases:
```sql
-- Orden 1: En cotización
-- Orden 2: En análisis
-- Orden 3: Aprobada
```

2. Verificar que todas aparecen en la vista de órdenes
3. Verificar que los cálculos suman todas las órdenes activas

### 6.3 Prueba de cancelación

1. Cancelar una orden:
```sql
UPDATE purchase_orders
SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_reason = 'Prueba'
WHERE order_number = 'ORD-XXX';
```

2. Verificar que:
- Ya no cuenta en cantidadEnProceso
- cantidadPendiente aumenta automáticamente
- El producto vuelve a aparecer con alerta si es necesario

---

## 🐛 Solución de Problemas

### Problema: Tabla purchase_orders no se crea

**Solución:**
```sql
-- Verificar permisos
SELECT has_table_privilege('public', 'products', 'SELECT');

-- Re-ejecutar script con más permisos
-- O usar Supabase Dashboard SQL Editor directamente
```

### Problema: Migración falla a mitad

**Solución:**
```sql
-- Ver cuántas órdenes se crearon
SELECT COUNT(*) FROM purchase_orders;

-- Ver qué productos no se migraron
SELECT sku, status FROM products
WHERE status NOT IN ('NEEDS_REPLENISHMENT', 'NO_REPLENISHMENT_NEEDED')
AND primary_status IS NULL;

-- Re-ejecutar migración solo para esos SKUs
```

### Problema: Cálculos no consideran órdenes

**Solución:**
```javascript
// Verificar que se está llamando a getActiveOrdersSummaryBatch
console.log('Orders summary map size:', ordersSummaryMap.size);

// Verificar datos de prueba
const { data } = await supabase.from('purchase_orders').select('*').limit(5);
console.log('Sample orders:', data);
```

---

## 📊 Monitoreo Post-Implementación

**Queries útiles:**

```sql
-- Ver productos con órdenes parciales
SELECT
  p.sku,
  p.descripcion,
  p.has_active_orders,
  p.total_cantidad_en_proceso,
  (SELECT COUNT(*) FROM purchase_orders WHERE sku = p.sku AND status NOT IN ('RECEIVED', 'CANCELLED')) as ordenes_activas
FROM products p
WHERE p.has_active_orders = true
ORDER BY p.total_cantidad_en_proceso DESC;

-- Ver resumen por SKU usando la vista
SELECT * FROM v_purchase_orders_summary
WHERE ordenes_activas > 1
ORDER BY cantidad_en_proceso DESC;

-- Ver órdenes creadas hoy
SELECT * FROM purchase_orders
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;
```

---

## 🎯 Checklist Final

Antes de dar por completada la implementación:

- [ ] Backup de base de datos creado
- [ ] Tabla `purchase_orders` creada y verificada
- [ ] Triggers funcionando correctamente
- [ ] Vista `v_purchase_orders_summary` creada
- [ ] Migración de datos completada sin errores
- [ ] `analysis-cached.js` actualizado y testeado
- [ ] `import-by-action.js` actualizado
- [ ] `export-by-status.js` actualizado
- [ ] Dashboard muestra alertas correctamente
- [ ] Modal de órdenes funciona
- [ ] Prueba completa de flujo parcial exitosa
- [ ] Documentación actualizada
- [ ] Equipo capacitado en nuevo flujo

---

## 📞 Soporte

Si encuentras problemas durante la implementación:

1. Revisar logs de consola en browser y server
2. Verificar queries SQL en Supabase Dashboard
3. Consultar este documento
4. Revisar `PLAN_MULTIPLES_ORDENES.md` para contexto

**¡Éxito con la implementación!** 🚀
