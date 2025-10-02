-- SQL para crear índices de optimización de performance
-- Ejecutar en la base de datos de Supabase

-- 1. Índice para filtros por status (muy usado en dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status
ON products(status)
WHERE status IS NOT NULL;

-- 2. Índice para ordenamiento por stock_actual
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stock_actual
ON products(stock_actual DESC);

-- 3. Índice compuesto para consultas de ventas por SKU y fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_sku_fecha
ON ventas(sku, fecha_venta DESC);

-- 4. Índice para compras en tránsito (muy usado en cálculos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compras_sku_transito
ON compras(sku, status_compra)
WHERE status_compra = 'en_transito';

-- 5. Índice para compras con fecha de llegada (usado en venta_diaria)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compras_sku_llegada
ON compras(sku, fecha_llegada_real DESC)
WHERE fecha_llegada_real IS NOT NULL;

-- 6. Índice para productos con precio (filtro común)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_precio
ON products(sku, precio_venta_sugerido)
WHERE precio_venta_sugerido > 0;

-- 7. Índice para ordenamiento rápido en cache por valor total
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_cache_valor_orden
ON dashboard_analysis_cache(((impacto_economico->>'valorTotal')::numeric) DESC NULLS LAST)
WHERE expires_at > NOW();

-- 8. Índice compuesto para cache válido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_cache_valid
ON dashboard_analysis_cache(expires_at, sku)
WHERE expires_at > NOW();

-- Verificar que los índices se crearon correctamente
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
  AND tablename IN ('products', 'ventas', 'compras', 'dashboard_analysis_cache')
ORDER BY tablename, indexname;