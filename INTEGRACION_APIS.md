# 🔌 Integración con APIs Externas

Sistema completo de integración con **MercadoLibre** y **Defontana** para sincronización automática de inventario, ventas y facturación.

## 📋 Funcionalidades Implementadas

### 🛒 **MercadoLibre**
- ✅ **Autenticación OAuth 2.0** completa
- ✅ **Sincronización de inventario** (stock en tiempo real)
- ✅ **Importación de órdenes** automática
- ✅ **Mapeo de productos** interno ↔ MercadoLibre
- ✅ **Pausar/activar publicaciones** remotamente
- ✅ **Actualización masiva de precios**
- ✅ **Importación de productos** desde ML al sistema

### 📊 **Defontana**
- ✅ **Configuración por API Key**
- ✅ **Creación automática de facturas**
- ✅ **Sincronización de productos**
- ✅ **Exportación de datos contables**
- ✅ **Reportes financieros**

## 🚀 Configuración Inicial

### 1. **Ejecutar Migración de Base de Datos**

```sql
-- En el SQL Editor de Supabase, ejecutar:
-- scripts/migrate-api-tables.sql
```

Esto creará las tablas:
- `api_configurations` - Configuraciones de APIs
- `platform_mappings` - Mapeos productos interno ↔ externo
- `external_orders` - Órdenes importadas
- `sync_logs` - Historial de sincronizaciones

### 2. **Variables de Entorno**

Agregar al archivo `.env.local`:

```env
# MercadoLibre
NEXT_PUBLIC_MERCADOLIBRE_APP_ID=tu_app_id
MERCADOLIBRE_CLIENT_SECRET=tu_client_secret

# Defontana
DEFONTANA_API_KEY=tu_api_key_defontana
```

### 3. **Configurar APIs desde la Interfaz**

1. Ve a `/api-config` en tu aplicación
2. **MercadoLibre**: Haz clic en "Conectar con MercadoLibre"
3. **Defontana**: Ingresa tu API Key y configura

## 📡 Endpoints Disponibles

### **Autenticación**
- `GET /api/auth/mercadolibre?action=authorize` - Iniciar OAuth ML
- `GET /api/auth/mercadolibre?action=callback` - Callback OAuth ML
- `POST /api/auth/mercadolibre` - Desconectar ML
- `POST /api/auth/defontana` - Configurar/desconectar Defontana

### **Sincronización de Inventario**
```javascript
// Actualizar stock de un producto específico
POST /api/sync/inventory
{
  "action": "update_stock",
  "platform": "mercadolibre",
  "sku": "SKU123",
  "quantity": 50
}

// Sincronizar todo el inventario
POST /api/sync/inventory
{
  "action": "sync_all",
  "platform": "mercadolibre"
}

// Importar productos desde la plataforma
POST /api/sync/inventory
{
  "action": "import_products",
  "platform": "mercadolibre"
}
```

### **Sincronización de Ventas**
```javascript
// Importar órdenes de los últimos 7 días
POST /api/sync/sales
{
  "action": "sync_orders",
  "platform": "mercadolibre",
  "from_date": "2025-01-01T00:00:00Z",
  "to_date": "2025-01-07T23:59:59Z"
}

// Crear factura en Defontana
POST /api/sync/sales
{
  "action": "create_invoice",
  "order_id": "ML-123456789"
}
```

## 🔄 Flujo de Sincronización

### **Inventario (Stock)**
1. **Cambio en sistema interno** → Actualiza `products.stock_actual`
2. **Webhook/Cron** → Detecta cambio
3. **API Sync** → Actualiza stock en MercadoLibre/Defontana
4. **Log** → Registra sincronización en `sync_logs`

### **Ventas (Órdenes)**
1. **Nueva orden en ML** → Importar via API
2. **Procesar orden** → Crear registros en `ventas`
3. **Auto-crear productos** → Si no existen en sistema
4. **Facturar** → Crear factura automática en Defontana

## 🎯 Casos de Uso

### **Escenario 1: Nuevo Producto**
```javascript
// 1. Crear producto en sistema interno
await fetch('/api/products', {
  method: 'POST',
  body: JSON.stringify({
    sku: 'NUEVO001',
    descripcion: 'Producto Nuevo',
    stock_actual: 100,
    precio: 25.99
  })
});

// 2. Sincronizar a MercadoLibre
await fetch('/api/sync/inventory', {
  method: 'POST',
  body: JSON.stringify({
    action: 'update_stock',
    platform: 'mercadolibre',
    sku: 'NUEVO001',
    quantity: 100
  })
});
```

### **Escenario 2: Venta en MercadoLibre**
```javascript
// 1. Importar órdenes recientes
await fetch('/api/sync/sales', {
  method: 'POST',
  body: JSON.stringify({
    action: 'sync_orders',
    platform: 'mercadolibre',
    from_date: new Date(Date.now() - 24*60*60*1000).toISOString()
  })
});

// 2. Sistema automáticamente:
// - Crea registro en `ventas`
// - Reduce stock en `products`
// - Crea mapeo en `platform_mappings`
// - Opcionalmente factura en Defontana
```

### **Escenario 3: Sincronización Masiva**
```javascript
// Sincronizar todo el inventario (ideal para cron job)
await fetch('/api/sync/inventory', {
  method: 'POST',
  body: JSON.stringify({
    action: 'sync_all',
    platform: 'mercadolibre'
  })
});
```

## 🔧 Configuración Avanzada

### **Mapeo Manual de Productos**
```sql
-- Mapear producto interno a MercadoLibre manualmente
INSERT INTO platform_mappings (
    platform, 
    internal_sku, 
    external_id, 
    active
) VALUES (
    'mercadolibre',
    'SKU123',
    'MLA123456789',
    true
);
```

### **Webhooks de MercadoLibre**
Para sincronización en tiempo real, configurar webhooks:

```javascript
// Webhook endpoint (crear en /api/webhooks/mercadolibre.js)
export default async function handler(req, res) {
  const { resource, user_id, topic } = req.body;
  
  if (topic === 'orders') {
    // Procesar nueva orden automáticamente
    await syncSingleOrder('mercadolibre', resource);
  }
  
  if (topic === 'items') {
    // Actualizar producto si cambió en ML
    await syncProductFromML(resource);
  }
  
  res.status(200).json({ received: true });
}
```

## 📊 Monitoreo y Logs

### **Dashboard de Estado**
- Ve a `/api-config` para ver estado general
- Productos mapeados por plataforma
- Última sincronización
- Productos que necesitan sync

### **Logs Detallados**
```sql
-- Ver logs de sincronización recientes
SELECT 
    platform,
    sync_type,
    results->>'success' as exitosos,
    results->>'errors' as errores,
    created_at
FROM sync_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### **Productos No Sincronizados**
```sql
-- Productos sin mapear en ML
SELECT p.sku, p.descripcion, p.stock_actual
FROM products p
LEFT JOIN platform_mappings pm ON p.sku = pm.internal_sku 
    AND pm.platform = 'mercadolibre'
WHERE pm.id IS NULL
    AND p.desconsiderado != true;
```

## 🛡️ Seguridad

- **Tokens encriptados** en base de datos
- **Refresh automático** de tokens OAuth
- **Validación** de API Keys en cada request
- **Rate limiting** para evitar límites de API
- **Logs auditables** de todas las operaciones

## 🔄 Automatización Recomendada

### **Cron Jobs Sugeridos**
```javascript
// Cada 15 minutos - Sincronizar stock
0,15,30,45 * * * * /api/sync/inventory?action=sync_all&platform=mercadolibre

// Cada hora - Importar órdenes nuevas  
0 * * * * /api/sync/sales?action=sync_orders&platform=mercadolibre

// Diario a las 2 AM - Limpieza de logs antiguos
0 2 * * * DELETE FROM sync_logs WHERE created_at < NOW() - INTERVAL '30 days'
```

## 🚨 Troubleshooting

### **Errores Comunes**

1. **"Token expirado"**
   - El sistema auto-renueva tokens OAuth
   - Si falla, reconectar en `/api-config`

2. **"Producto no mapeado"**
   - Importar productos desde ML con `import_products`
   - O crear mapeo manual en `platform_mappings`

3. **"API Key inválida"**
   - Verificar credenciales en Defontana
   - Reconfigurar en `/api-config`

### **Debug Mode**
```javascript
// Activar logs detallados
localStorage.setItem('debug_api_sync', 'true');
```

---

**Sistema completo listo para producción** ✅

Conecta automáticamente tu inventario con MercadoLibre y Defontana para una gestión unificada de ventas y facturación.