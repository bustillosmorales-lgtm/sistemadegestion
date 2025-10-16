-- ============================================
-- Actualizar vista materializada para incluir packs descompuestos
-- ============================================

-- 1. Eliminar vista materializada antigua si existe
DROP MATERIALIZED VIEW IF EXISTS sku_venta_diaria_mv CASCADE;

-- 2. Crear vista materializada CON descomposición de packs
CREATE MATERIALIZED VIEW sku_venta_diaria_mv AS
WITH parametros AS (
    -- Parámetros configurables
    SELECT
        90 as dias_analisis,
        30 as dias_minimos_confiables
),
ventas_con_packs AS (
    -- NUEVO: Incluir ventas directas + ventas de packs descompuestas
    SELECT
        vd.sku,
        vd.fecha_venta::DATE as fecha_venta,
        SUM(vd.cantidad) as cantidad
    FROM ventas_descompuestas vd
    WHERE vd.fecha_venta >= CURRENT_DATE - (SELECT dias_analisis FROM parametros)
    GROUP BY vd.sku, vd.fecha_venta::DATE
),
estadisticas_ventas AS (
    SELECT
        v.sku,
        COUNT(DISTINCT v.fecha_venta) as dias_con_ventas,
        SUM(v.cantidad) as cantidad_total_vendida,
        -- Venta diaria = total vendido / días del período (no días con venta)
        ROUND(
            SUM(v.cantidad)::NUMERIC /
            NULLIF((SELECT dias_analisis FROM parametros), 0),
            2
        ) as venta_diaria_promedio,
        -- Promedio solo en días con venta (para comparación)
        ROUND(
            AVG(v.cantidad)::NUMERIC,
            2
        ) as venta_promedio_dias_activos,
        MAX(v.cantidad) as venta_maxima,
        MIN(v.cantidad) as venta_minima,
        -- Calcular si el cálculo es confiable
        CASE
            WHEN COUNT(DISTINCT v.fecha_venta) >= (SELECT dias_minimos_confiables FROM parametros)
            THEN true
            ELSE false
        END as calculo_confiable
    FROM ventas_con_packs v
    GROUP BY v.sku
)
SELECT
    ev.sku,
    ev.venta_diaria_promedio as venta_diaria,
    ev.venta_promedio_dias_activos,
    ev.dias_con_ventas,
    ev.cantidad_total_vendida,
    ev.venta_maxima,
    ev.venta_minima,
    ev.calculo_confiable,
    (SELECT dias_analisis FROM parametros) as periodo_dias,
    NOW() as actualizado_at
FROM estadisticas_ventas ev;

-- 3. Crear índices para optimizar consultas
CREATE UNIQUE INDEX idx_venta_diaria_mv_sku ON sku_venta_diaria_mv(sku);
CREATE INDEX idx_venta_diaria_mv_confiable ON sku_venta_diaria_mv(calculo_confiable);
CREATE INDEX idx_venta_diaria_mv_venta_diaria ON sku_venta_diaria_mv(venta_diaria DESC);

-- 4. Comentarios
COMMENT ON MATERIALIZED VIEW sku_venta_diaria_mv IS 'Vista materializada de venta diaria por SKU incluyendo packs descompuestos';
COMMENT ON COLUMN sku_venta_diaria_mv.venta_diaria IS 'Venta promedio diaria calculada sobre todo el período (incluye packs descompuestos)';
COMMENT ON COLUMN sku_venta_diaria_mv.venta_promedio_dias_activos IS 'Venta promedio solo en días con ventas';
COMMENT ON COLUMN sku_venta_diaria_mv.calculo_confiable IS 'TRUE si hay suficientes días con ventas para calcular con confianza';

-- 5. Crear o reemplazar función para refrescar
CREATE OR REPLACE FUNCTION refresh_venta_diaria_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;
    RAISE NOTICE 'Vista materializada sku_venta_diaria_mv actualizada con packs descompuestos';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_venta_diaria_mv IS 'Refresca la vista materializada de venta diaria incluyendo packs';

-- 6. Refrescar por primera vez
REFRESH MATERIALIZED VIEW sku_venta_diaria_mv;

-- 7. Verificar resultados
SELECT
    COUNT(*) as total_skus,
    COUNT(*) FILTER (WHERE calculo_confiable = true) as skus_confiables,
    COUNT(*) FILTER (WHERE calculo_confiable = false) as skus_insuficientes,
    ROUND(AVG(venta_diaria), 2) as venta_diaria_promedio,
    ROUND(AVG(dias_con_ventas), 0) as dias_promedio_con_ventas
FROM sku_venta_diaria_mv;

-- 8. Mostrar ejemplo de SKU con pack
SELECT
    mv.sku,
    mv.venta_diaria,
    mv.dias_con_ventas,
    mv.cantidad_total_vendida,
    mv.calculo_confiable,
    -- Verificar si es producto de pack
    CASE
        WHEN EXISTS (SELECT 1 FROM packs p WHERE p.producto_sku = mv.sku)
        THEN '✅ Incluye ventas por packs'
        ELSE 'Solo ventas directas'
    END as tipo_calculo
FROM sku_venta_diaria_mv mv
ORDER BY mv.venta_diaria DESC
LIMIT 10;
