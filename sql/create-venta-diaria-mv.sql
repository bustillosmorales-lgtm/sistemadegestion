-- Vista materializada para venta_diaria
-- Usa EXACTAMENTE la misma lógica de calculateVentaDiariaBatch()
-- Se debe refrescar diariamente con: REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;

CREATE MATERIALIZED VIEW IF NOT EXISTS sku_venta_diaria_mv AS
WITH llegadas_validas AS (
  -- Buscar llegada más reciente que tenga ≥30 días desde HOY
  SELECT DISTINCT ON (sku)
    sku,
    fecha_llegada_real as fecha_inicio
  FROM compras
  WHERE fecha_llegada_real IS NOT NULL
    AND fecha_llegada_real <= NOW() - INTERVAL '30 days'
  ORDER BY sku, fecha_llegada_real DESC
),
primera_venta AS (
  -- Si no hay llegadas válidas, usar primera venta
  SELECT sku, MIN(fecha_venta) as fecha_inicio
  FROM ventas
  GROUP BY sku
),
periodo_analisis AS (
  SELECT
    p.sku,
    -- Fecha de inicio: llegada válida > primera venta > 90 días atrás (default)
    COALESCE(
      l.fecha_inicio,
      pv.fecha_inicio,
      NOW() - INTERVAL '90 days'
    ) as fecha_inicio,
    -- Fecha de fin: fecha de quiebre > última venta > hoy
    CASE
      WHEN p.stock_actual <= 0 AND p.last_stockout_date IS NOT NULL
        THEN p.last_stockout_date::timestamp
      WHEN p.stock_actual <= 0 AND EXISTS(SELECT 1 FROM ventas v WHERE v.sku = p.sku)
        THEN (SELECT MAX(fecha_venta) FROM ventas WHERE sku = p.sku)
      ELSE NOW()
    END as fecha_fin
  FROM products p
  LEFT JOIN llegadas_validas l ON p.sku = l.sku
  LEFT JOIN primera_venta pv ON p.sku = pv.sku
),
ventas_calculadas AS (
  SELECT
    pa.sku,
    pa.fecha_inicio,
    pa.fecha_fin,
    EXTRACT(DAYS FROM (pa.fecha_fin - pa.fecha_inicio))::integer as dias_periodo,
    COALESCE(SUM(v.cantidad), 0) as total_vendido
  FROM periodo_analisis pa
  LEFT JOIN ventas v ON v.sku = pa.sku
    AND v.fecha_venta >= pa.fecha_inicio
    AND v.fecha_venta <= pa.fecha_fin
  GROUP BY pa.sku, pa.fecha_inicio, pa.fecha_fin
)
SELECT
  sku,
  CASE
    WHEN dias_periodo > 0 THEN ROUND((total_vendido::numeric / GREATEST(dias_periodo, 1))::numeric, 4)
    ELSE 0
  END as venta_diaria,
  fecha_inicio,
  fecha_fin,
  dias_periodo,
  total_vendido,
  -- Marcar si el cálculo es confiable (suficientes datos)
  (total_vendido > 0 AND dias_periodo >= 30) as calculo_confiable,
  NOW() as actualizado_en
FROM ventas_calculadas;

-- Índices para acceso rápido
CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_diaria_mv_sku
  ON sku_venta_diaria_mv(sku);

CREATE INDEX IF NOT EXISTS idx_venta_diaria_mv_confiable
  ON sku_venta_diaria_mv(calculo_confiable)
  WHERE calculo_confiable = true;

CREATE INDEX IF NOT EXISTS idx_venta_diaria_mv_actualizado
  ON sku_venta_diaria_mv(actualizado_en DESC);

-- Función para refrescar la vista materializada
CREATE OR REPLACE FUNCTION refresh_venta_diaria_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON MATERIALIZED VIEW sku_venta_diaria_mv IS 'Vista materializada con venta_diaria pre-calculada usando misma lógica de calculateVentaDiariaBatch()';
COMMENT ON COLUMN sku_venta_diaria_mv.venta_diaria IS 'Unidades vendidas por día (promedio)';
COMMENT ON COLUMN sku_venta_diaria_mv.calculo_confiable IS 'true si hay suficientes datos (>30 días y ventas > 0)';
COMMENT ON COLUMN sku_venta_diaria_mv.dias_periodo IS 'Días analizados para el cálculo';
COMMENT ON COLUMN sku_venta_diaria_mv.total_vendido IS 'Total de unidades vendidas en el período';
