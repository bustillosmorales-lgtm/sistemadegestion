-- setup-database-indexes.sql - Optimizar base de datos con índices específicos

-- =============================================================================
-- ÍNDICES PARA TABLA PRODUCTS (tabla principal)
-- =============================================================================

-- Índice compuesto para paginación eficiente con filtro de status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_pagination 
ON products (sku ASC, status) 
WHERE status IS NOT NULL;

-- Índice para búsquedas por status (muy común en el dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status 
ON products (status) 
WHERE status IS NOT NULL;

-- Índice para búsquedas por SKU (único, pero aseguremos que esté optimizado)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku_unique 
ON products (sku);

-- Índice compuesto para análisis de stock y workflow
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_stock_analysis 
ON products (status, stock_actual, updated_at DESC) 
WHERE status IN ('NEEDS_REPLENISHMENT', 'NO_REPLENISHMENT_NEEDED', 'QUOTE_REQUESTED');

-- Índice para productos desconsiderados (filtro común)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_desconsiderado 
ON products (desconsiderado, status) 
WHERE desconsiderado IS NOT NULL;

-- =============================================================================
-- ÍNDICES PARA TABLA VENTAS (consultas intensivas en análisis)
-- =============================================================================

-- Índice compuesto principal para cálculo de venta diaria
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_sku_fecha_cantidad 
ON ventas (sku, fecha_venta DESC, cantidad) 
WHERE sku IS NOT NULL AND fecha_venta IS NOT NULL;

-- Índice para rangos de fechas específicos (últimos 30-90 días)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_fecha_reciente 
ON ventas (fecha_venta DESC, sku) 
WHERE fecha_venta >= (CURRENT_DATE - INTERVAL '90 days');

-- Índice para agregaciones por SKU
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ventas_sku_agregaciones 
ON ventas (sku, cantidad, fecha_venta) 
WHERE cantidad > 0;

-- =============================================================================
-- ÍNDICES PARA TABLA COMPRAS (para cálculo de fechas de llegada)
-- =============================================================================

-- Índice compuesto para fechas de llegada por SKU
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compras_sku_llegada 
ON compras (sku, fecha_llegada_real DESC) 
WHERE fecha_llegada_real IS NOT NULL;

-- Índice para compras recientes (últimos 30 días para análisis)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compras_fecha_reciente 
ON compras (fecha_llegada_real DESC, sku) 
WHERE fecha_llegada_real >= (CURRENT_DATE - INTERVAL '90 days');

-- =============================================================================
-- ÍNDICES PARA TABLA REPLENISHMENT_REMINDERS
-- =============================================================================

-- Índice para recordatorios activos por fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_active_date 
ON replenishment_reminders (is_active, reminder_date, sku) 
WHERE is_active = true;

-- =============================================================================
-- ÍNDICES PARA TABLA CONFIGURATION (caché de configuración)
-- =============================================================================

-- Índice simple para acceso rápido a configuración
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_configuration_id 
ON configuration (id);

-- =============================================================================
-- ESTADÍSTICAS Y MANTENIMIENTO
-- =============================================================================

-- Actualizar estadísticas de las tablas principales
ANALYZE products;
ANALYZE ventas;
ANALYZE compras;
ANALYZE replenishment_reminders;

-- =============================================================================
-- VIEWS MATERIALIZADAS PARA CONSULTAS COMPLEJAS (OPCIONAL)
-- =============================================================================

-- Vista materializada para estadísticas de venta diaria (refresh cada hora)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_venta_diaria_stats AS
SELECT 
    sku,
    COUNT(*) as total_ventas,
    SUM(cantidad) as total_cantidad,
    AVG(cantidad) as promedio_cantidad,
    MIN(fecha_venta) as primera_venta,
    MAX(fecha_venta) as ultima_venta,
    DATE_PART('day', MAX(fecha_venta) - MIN(fecha_venta)) as dias_periodo,
    CASE 
        WHEN DATE_PART('day', MAX(fecha_venta) - MIN(fecha_venta)) > 0 
        THEN SUM(cantidad) / DATE_PART('day', MAX(fecha_venta) - MIN(fecha_venta))
        ELSE 0 
    END as venta_diaria_estimada
FROM ventas 
WHERE fecha_venta >= (CURRENT_DATE - INTERVAL '180 days')
    AND cantidad > 0
    AND sku IS NOT NULL
GROUP BY sku
HAVING COUNT(*) >= 2; -- Solo SKUs con al menos 2 ventas

-- Índice en la vista materializada
CREATE INDEX IF NOT EXISTS idx_mv_venta_diaria_sku 
ON mv_venta_diaria_stats (sku);

-- =============================================================================
-- LIMPIEZA Y OPTIMIZACIÓN ADICIONAL
-- =============================================================================

-- Configurar autovacuum más agresivo para tablas grandes
ALTER TABLE products SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE ventas SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- =============================================================================
-- FUNCIONES DE MANTENIMIENTO
-- =============================================================================

-- Función para refrescar vista materializada (llamar desde cron cada hora)
CREATE OR REPLACE FUNCTION refresh_venta_diaria_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_venta_diaria_stats;
    -- Log del refresh
    INSERT INTO system_log (action, details, created_at) 
    VALUES ('refresh_mv_venta_diaria_stats', 'Vista materializada actualizada', NOW())
    ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN
    -- Manejo de errores silencioso
    NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CONSULTAS DE VERIFICACIÓN
-- =============================================================================

-- Verificar que los índices fueron creados correctamente
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('products', 'ventas', 'compras', 'replenishment_reminders')
ORDER BY tablename, indexname;

-- Verificar uso de índices en consultas comunes
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products 
WHERE status = 'NEEDS_REPLENISHMENT' 
ORDER BY sku 
LIMIT 25;

-- Estadísticas de tabla
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename IN ('products', 'ventas', 'compras');
*/