# 📋 PASOS DE IMPLEMENTACIÓN - GUÍA MANUAL

## ⚠️ IMPORTANTE: BACKUP PRIMERO

Antes de comenzar, **CREAR BACKUP EN SUPABASE**:
1. Ir a: https://supabase.com/dashboard/project/[tu-proyecto]
2. Settings > Database > Backups
3. Click "Create backup" - Esperar a que complete
4. ✅ Confirmar backup creado

---

## 🗄️ FASE 1: CREAR TABLA EN SUPABASE

### Paso 1: Abrir SQL Editor en Supabase

1. Ir a: https://supabase.com/dashboard/project/[tu-proyecto]
2. Click en "SQL Editor" en el menú izquierdo
3. Click en "New query"

### Paso 2: Copiar y Ejecutar este SQL

**COPIAR TODO EL CONTENIDO DE:** `scripts/create_purchase_orders_table.sql`

O copiar directamente de aquí:

\`\`\`sql
-- 1. Crear tabla purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  cantidad_solicitada INTEGER NOT NULL,
  cantidad_recibida INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'QUOTE_REQUESTED',
  request_details JSONB,
  quote_details JSONB,
  analysis_details JSONB,
  approval_details JSONB,
  purchase_details JSONB,
  manufacturing_details JSONB,
  shipping_details JSONB,
  notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sku ON purchase_orders(sku);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_number ON purchase_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

-- 3. Agregar columnas a products
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_status TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_active_orders BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_cantidad_en_proceso INTEGER DEFAULT 0;

-- 4. Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trigger_update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_orders_updated_at();

-- 6. Función para sincronizar products
CREATE OR REPLACE FUNCTION sync_product_active_orders()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET
    has_active_orders = EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE sku = COALESCE(NEW.sku, OLD.sku)
      AND status NOT IN ('RECEIVED', 'CANCELLED')
    ),
    total_cantidad_en_proceso = COALESCE((
      SELECT SUM(cantidad_solicitada - cantidad_recibida)
      FROM purchase_orders
      WHERE sku = COALESCE(NEW.sku, OLD.sku)
      AND status NOT IN ('RECEIVED', 'CANCELLED')
    ), 0)
  WHERE sku = COALESCE(NEW.sku, OLD.sku);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Triggers para sincronización
DROP TRIGGER IF EXISTS trigger_sync_product_on_insert ON purchase_orders;
CREATE TRIGGER trigger_sync_product_on_insert
  AFTER INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_active_orders();

DROP TRIGGER IF EXISTS trigger_sync_product_on_update ON purchase_orders;
CREATE TRIGGER trigger_sync_product_on_update
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_active_orders();

DROP TRIGGER IF EXISTS trigger_sync_product_on_delete ON purchase_orders;
CREATE TRIGGER trigger_sync_product_on_delete
  AFTER DELETE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_active_orders();

-- 8. Vista para análisis
CREATE OR REPLACE VIEW v_purchase_orders_summary AS
SELECT
  sku,
  COUNT(*) as total_ordenes,
  COUNT(*) FILTER (WHERE status NOT IN ('RECEIVED', 'CANCELLED')) as ordenes_activas,
  SUM(cantidad_solicitada) as total_solicitado,
  SUM(cantidad_recibida) as total_recibido,
  SUM(cantidad_solicitada - cantidad_recibida) FILTER (WHERE status NOT IN ('RECEIVED', 'CANCELLED')) as cantidad_en_proceso,
  MAX(created_at) as ultima_orden,
  array_agg(DISTINCT status) FILTER (WHERE status NOT IN ('RECEIVED', 'CANCELLED')) as status_activos
FROM purchase_orders
GROUP BY sku;

SELECT '✅ Tabla purchase_orders creada exitosamente' AS status;
\`\`\`

### Paso 3: Ejecutar el SQL

1. Click en "Run" (o presionar Ctrl+Enter)
2. Esperar a que termine (debería tomar 5-10 segundos)
3. Verificar que dice: "✅ Tabla purchase_orders creada exitosamente"

### Paso 4: Verificar la Tabla

Ejecutar este query para verificar:

\`\`\`sql
-- Verificar estructura
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- Verificar triggers
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders';

-- Verificar vista
SELECT * FROM v_purchase_orders_summary LIMIT 1;
\`\`\`

**Resultado Esperado:**
- ✅ Debería mostrar ~18 columnas (id, sku, order_number, etc.)
- ✅ Debería mostrar 3 triggers
- ✅ Vista debería existir (aunque esté vacía)

---

## 📦 FASE 2: MIGRAR DATOS EXISTENTES

### Opción A: Via Script Node.js (Recomendado)

\`\`\`bash
# En tu terminal local
node scripts/migrate_to_purchase_orders.js
\`\`\`

**Qué hace el script:**
1. Busca productos con status != NEEDS_REPLENISHMENT
2. Por cada uno, crea una orden en purchase_orders
3. Copia todos los detalles (request_details, quote_details, etc.)
4. Actualiza products.primary_status
5. Limpia campos de detalles en products

**Tiempo estimado:** 1-2 minutos

### Opción B: Via SQL Manual (Si el script falla)

\`\`\`sql
-- 1. Insertar órdenes desde productos existentes
INSERT INTO purchase_orders (
  sku,
  order_number,
  cantidad_solicitada,
  status,
  request_details,
  quote_details,
  analysis_details,
  approval_details,
  purchase_details,
  manufacturing_details,
  shipping_details,
  created_at
)
SELECT
  sku,
  'ORD-MIGR-' || LPAD(ROW_NUMBER() OVER (ORDER BY updated_at)::TEXT, 6, '0') as order_number,
  COALESCE(
    (request_details->>'quantityToQuote')::INTEGER,
    (approval_details->>'approvedQuantity')::INTEGER,
    100
  ) as cantidad_solicitada,
  status,
  request_details,
  quote_details,
  analysis_details,
  approval_details,
  purchase_details,
  manufacturing_details,
  shipping_details,
  COALESCE(updated_at, NOW()) as created_at
FROM products
WHERE status NOT IN ('NEEDS_REPLENISHMENT', 'NO_REPLENISHMENT_NEEDED')
  AND status IS NOT NULL;

-- 2. Actualizar products
UPDATE products
SET
  primary_status = status,
  has_active_orders = true
WHERE status NOT IN ('NEEDS_REPLENISHMENT', 'NO_REPLENISHMENT_NEEDED')
  AND status IS NOT NULL;

-- 3. Verificar migración
SELECT
  COUNT(*) as total_ordenes_migradas,
  COUNT(DISTINCT sku) as productos_afectados
FROM purchase_orders;
\`\`\`

### Paso 5: Validar Migración

\`\`\`sql
-- Ver resumen de migración
SELECT
  status,
  COUNT(*) as ordenes,
  SUM(cantidad_solicitada) as total_unidades
FROM purchase_orders
GROUP BY status
ORDER BY ordenes DESC;

-- Ver ejemplos
SELECT
  order_number,
  sku,
  cantidad_solicitada,
  status,
  created_at
FROM purchase_orders
ORDER BY created_at DESC
LIMIT 10;

-- Verificar sincronización con products
SELECT
  p.sku,
  p.primary_status,
  p.has_active_orders,
  p.total_cantidad_en_proceso,
  (SELECT COUNT(*) FROM purchase_orders WHERE sku = p.sku) as ordenes_reales
FROM products p
WHERE p.has_active_orders = true
LIMIT 10;
\`\`\`

---

## ✅ CHECKLIST FASE 1

Antes de continuar a Fase 2, verificar:

- [ ] ✅ Backup de Supabase creado
- [ ] ✅ Tabla `purchase_orders` existe
- [ ] ✅ 3 triggers creados y funcionando
- [ ] ✅ Vista `v_purchase_orders_summary` existe
- [ ] ✅ Columnas agregadas a `products` (primary_status, has_active_orders, total_cantidad_en_proceso)
- [ ] ✅ Migración ejecutada sin errores
- [ ] ✅ Cantidad de órdenes migradas > 0
- [ ] ✅ Campo `has_active_orders` actualizado en products

**Si todos los checks están OK, continuar con Fase 2 (Backend)**

---

## 🔄 ROLLBACK (Si algo sale mal)

### Opción 1: Restaurar Backup de Supabase
1. Ir a Settings > Database > Backups
2. Seleccionar el backup creado al inicio
3. Click "Restore"

### Opción 2: Eliminar Cambios Manualmente
\`\`\`sql
-- CUIDADO: Esto elimina todos los cambios
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP VIEW IF EXISTS v_purchase_orders_summary;
DROP FUNCTION IF EXISTS sync_product_active_orders();
DROP FUNCTION IF EXISTS update_purchase_orders_updated_at();

ALTER TABLE products DROP COLUMN IF EXISTS primary_status;
ALTER TABLE products DROP COLUMN IF EXISTS has_active_orders;
ALTER TABLE products DROP COLUMN IF EXISTS total_cantidad_en_proceso;
\`\`\`

---

## 📝 NOTAS IMPORTANTES

1. **Tiempo Total Fase 1:** ~15-30 minutos
2. **Requiere:** Acceso admin a Supabase
3. **Reversible:** Sí, vía backup o SQL rollback
4. **Impacto en producción:** Ninguno hasta Fase 2
5. **Datos perdidos:** Ninguno (solo se copian/agregan)

---

## 🚀 CUANDO TERMINES FASE 1

**Avísame cuando tengas todos los checks en ✅ y continuamos con:**

### FASE 2: Actualizar Backend (1 hora)
- Modificar `analysis-cached.js`
- Modificar `import-by-action.js`
- Modificar `export-by-status.js`
- Modificar `dashboard-stats.js`

Estaré listo para guiarte paso a paso en la Fase 2 cuando confirmes que Fase 1 está completa.
