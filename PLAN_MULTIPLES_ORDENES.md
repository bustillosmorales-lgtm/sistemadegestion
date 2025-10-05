# Plan de Implementación: Sistema de Múltiples Órdenes de Compra

## 🎯 Objetivo
Permitir que un SKU pueda tener múltiples órdenes de compra simultáneas y mostrar alertas cuando la cantidad en proceso no cubre la recomendación total.

## 📋 Cambios Necesarios

### 1. Nueva Tabla: `purchase_orders`
```sql
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  cantidad_solicitada INTEGER NOT NULL,
  cantidad_recibida INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- QUOTE_REQUESTED, QUOTED, ANALYZING, PURCHASE_APPROVED, MANUFACTURING, SHIPPING, RECEIVED, CANCELLED

  -- Detalles por fase
  request_details JSONB,
  quote_details JSONB,
  analysis_details JSONB,
  approval_details JSONB,
  purchase_details JSONB,
  manufacturing_details JSONB,
  shipping_details JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Relaciones
  FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE CASCADE
);

CREATE INDEX idx_purchase_orders_sku ON purchase_orders(sku);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
```

### 2. Modificar Tabla `products`
```sql
-- Agregar campos nuevos a products:
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_status TEXT; -- Status principal del producto
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_active_orders BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_cantidad_en_proceso INTEGER DEFAULT 0;
```

### 3. Nueva Lógica de Cálculos

**Cantidad Total Necesaria (CTN):**
```javascript
CTN = Stock Objetivo - (Stock Actual + Stock en Tránsito - Consumo Durante Lead Time)
```

**Cantidad en Proceso (CEP):**
```javascript
CEP = Suma de todas las órdenes activas (no RECEIVED, no CANCELLED)
```

**Cantidad Pendiente de Solicitar (CPS):**
```javascript
CPS = CTN - CEP
```

**Alertas:**
```javascript
if (CPS > 0 && CEP > 0) {
  // ⚠️ ALERTA: Hay órdenes en proceso pero se necesita más
  mostrarAlerta("Orden parcial - Necesita {CPS} unidades adicionales")
}

if (CPS > 0 && CEP === 0) {
  // ❗ CRÍTICO: No hay órdenes y se necesita reposición
  status = "NEEDS_REPLENISHMENT"
}

if (CPS <= 0 && CEP > 0) {
  // ✅ OK: Órdenes en proceso cubren necesidad
  mostrarInfo("En proceso - {CEP} unidades")
}
```

### 4. Modificaciones a APIs

#### `analysis-cached.js`
- Calcular `cantidadTotalNecesaria`
- Consultar `purchase_orders` para obtener `cantidadEnProceso`
- Calcular `cantidadPendiente = cantidadTotalNecesaria - cantidadEnProceso`
- Agregar campo `alertaReposicionAdicional` cuando sea necesario

#### `export-by-status.js`
- Para NEEDS_REPLENISHMENT: Solo mostrar SKUs con `cantidadPendiente > 0`
- Agregar columna "Cantidad en Proceso"
- Agregar columna "Cantidad Adicional Necesaria"
- Para otros status: Mostrar todas las órdenes activas del SKU

#### `import-by-action.js`
- En lugar de cambiar `products.status`, crear registro en `purchase_orders`
- Mantener `products.primary_status` como indicador general
- Permitir múltiples órdenes para el mismo SKU

#### `dashboard-stats.js`
- Contar SKUs con `cantidadPendiente > 0` para NEEDS_REPLENISHMENT
- Agregar contador "Órdenes Parciales" para SKUs con CEP > 0 y CPS > 0

### 5. Cambios en UI

#### Dashboard Principal
```
┌─────────────────────────────────────────────────────────┐
│ SKU-123 - Producto Ejemplo                              │
│ Status: ANALYZING (Orden #ORD-001)                      │
│                                                          │
│ 📊 Análisis de Reposición:                              │
│ ├─ Cantidad Total Necesaria: 1000 unidades              │
│ ├─ En Proceso (1 orden):     500 unidades               │
│ └─ ⚠️ PENDIENTE:              500 unidades               │
│                                                          │
│ [Ver Órdenes] [Solicitar Compra Adicional]              │
└─────────────────────────────────────────────────────────┘
```

#### Vista de Órdenes por SKU
```
SKU-123 - Producto Ejemplo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Órdenes Activas:
1. ORD-001: 500 unidades - ANALYZING (Aprobación pendiente)
2. ORD-002: 300 unidades - QUOTED (Esperando análisis)

Total en Proceso: 800 unidades
Cantidad Adicional Necesaria: 200 unidades

[+ Nueva Orden de 200 unidades]
```

### 6. Migración de Datos Existentes

```javascript
// Script de migración:
// 1. Por cada producto con status != 'NEEDS_REPLENISHMENT':
//    - Crear orden en purchase_orders con detalles actuales
//    - Asignar primary_status = status actual
//    - Limpiar campos de detalles en products
// 2. Recalcular cantidades en proceso para todos los SKUs
```

## 🔄 Flujo Nuevo Completo

### Ejemplo: Necesita 1000, compra 500

**Estado 1: Inicial**
```
SKU-123
├─ Status: NEEDS_REPLENISHMENT
├─ Cantidad Total Necesaria: 1000
├─ Órdenes Activas: 0
└─ Cantidad Pendiente: 1000
```

**Estado 2: Usuario solicita 500**
```
SKU-123
├─ Primary Status: QUOTE_REQUESTED (por orden principal)
├─ Cantidad Total Necesaria: 1000
├─ Órdenes Activas: 1
│   └─ ORD-001: 500 unidades - QUOTE_REQUESTED
├─ Cantidad en Proceso: 500
├─ Cantidad Pendiente: 500
└─ ⚠️ ALERTA: "Necesita 500 unidades adicionales"
```

**Estado 3: Usuario solicita 500 más**
```
SKU-123
├─ Primary Status: QUOTE_REQUESTED
├─ Cantidad Total Necesaria: 1000
├─ Órdenes Activas: 2
│   ├─ ORD-001: 500 unidades - ANALYZING
│   └─ ORD-002: 500 unidades - QUOTE_REQUESTED
├─ Cantidad en Proceso: 1000
├─ Cantidad Pendiente: 0
└─ ✅ OK: "Necesidad cubierta por órdenes en proceso"
```

**Estado 4: Llega primera orden**
```
SKU-123
├─ Primary Status: QUOTE_REQUESTED (ORD-002)
├─ Cantidad Total Necesaria: 1000
├─ Órdenes Activas: 1
│   └─ ORD-002: 500 unidades - ANALYZING
├─ Órdenes Completadas: 1
│   └─ ORD-001: 500 unidades - RECEIVED
├─ Cantidad en Proceso: 500
├─ Cantidad Pendiente: 500
└─ ⚠️ ALERTA: "Necesita 500 unidades adicionales" (si todavía aplica)
```

## 📊 Ventajas del Nuevo Sistema

✅ **Transparencia Total:** Ver todas las órdenes de un SKU
✅ **Compras Parciales:** Aprobar en múltiples etapas
✅ **Alertas Inteligentes:** Saber cuándo se necesita más
✅ **Historial Completo:** Rastrear todas las órdenes
✅ **Flexibilidad:** Cancelar órdenes específicas sin afectar otras
✅ **Análisis Preciso:** Cantidad real pendiente vs en proceso

## 🚀 Orden de Implementación

1. ✅ Crear tabla `purchase_orders`
2. ✅ Modificar `analysis-cached.js` para calcular cantidades correctas
3. ✅ Actualizar `import-by-action.js` para crear órdenes
4. ✅ Modificar `export-by-status.js` para mostrar info de órdenes
5. ✅ Actualizar dashboard para mostrar alertas
6. ✅ Crear vista de órdenes por SKU
7. ✅ Script de migración de datos existentes
8. ✅ Pruebas completas del flujo

## 📝 Notas Importantes

- `products.status` se convertirá en `primary_status` (solo indicativo)
- El status real de cada orden está en `purchase_orders.status`
- Un SKU puede aparecer en múltiples categorías simultáneamente
- NEEDS_REPLENISHMENT ahora significa "tiene cantidad pendiente > 0"
- Los cálculos siempre consideran TODAS las órdenes activas
