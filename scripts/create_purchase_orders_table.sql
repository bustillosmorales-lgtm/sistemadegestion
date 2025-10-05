-- Script de creación de tabla purchase_orders
-- Sistema de Múltiples Órdenes de Compra por SKU

-- 1. Crear tabla purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  order_number TEXT UNIQUE NOT NULL,

  -- Cantidades
  cantidad_solicitada INTEGER NOT NULL,
  cantidad_recibida INTEGER DEFAULT 0,

  -- Status de esta orden específica
  status TEXT NOT NULL DEFAULT 'QUOTE_REQUESTED',
  -- Posibles valores: QUOTE_REQUESTED, QUOTED, ANALYZING, PURCHASE_APPROVED,
  --                   MANUFACTURING, SHIPPING, RECEIVED, CANCELLED

  -- Detalles por fase (mismo formato que products)
  request_details JSONB,
  quote_details JSONB,
  analysis_details JSONB,
  approval_details JSONB,
  purchase_details JSONB,
  manufacturing_details JSONB,
  shipping_details JSONB,

  -- Campos adicionales
  notes TEXT,
  cancelled_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

-- 2. Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_purchase_orders_sku ON purchase_orders(sku);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_number ON purchase_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

-- 3. Agregar columnas nuevas a products (si no existen)
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_status TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_active_orders BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_cantidad_en_proceso INTEGER DEFAULT 0;

-- 4. Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trigger_update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_orders_updated_at();

-- 6. Función para sincronizar has_active_orders en products
CREATE OR REPLACE FUNCTION sync_product_active_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el producto correspondiente
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

-- 7. Triggers para sincronizar products cuando cambian purchase_orders
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

-- 8. Vista para análisis rápido de órdenes por SKU
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

-- 9. Comentarios en tabla
COMMENT ON TABLE purchase_orders IS 'Órdenes de compra individuales - Permite múltiples órdenes por SKU';
COMMENT ON COLUMN purchase_orders.sku IS 'SKU del producto (FK a products)';
COMMENT ON COLUMN purchase_orders.order_number IS 'Número único de orden (ORD-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN purchase_orders.cantidad_solicitada IS 'Cantidad total solicitada en esta orden';
COMMENT ON COLUMN purchase_orders.cantidad_recibida IS 'Cantidad recibida hasta ahora';
COMMENT ON COLUMN purchase_orders.status IS 'Status actual de esta orden específica';

-- 10. Datos de prueba (comentar en producción)
-- INSERT INTO purchase_orders (sku, order_number, cantidad_solicitada, status, created_at) VALUES
-- ('SKU-TEST-001', 'ORD-20250101-00001', 500, 'ANALYZING', NOW() - INTERVAL '5 days'),
-- ('SKU-TEST-001', 'ORD-20250103-00002', 300, 'QUOTE_REQUESTED', NOW() - INTERVAL '2 days'),
-- ('SKU-TEST-002', 'ORD-20250102-00003', 1000, 'QUOTED', NOW() - INTERVAL '3 days');

SELECT '✅ Tabla purchase_orders creada exitosamente' AS status;
SELECT '✅ Índices creados' AS status;
SELECT '✅ Triggers configurados' AS status;
SELECT '✅ Vista v_purchase_orders_summary creada' AS status;
