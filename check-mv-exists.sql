-- Verificar si existe la vista materializada
SELECT EXISTS (
  SELECT 1 
  FROM pg_matviews 
  WHERE schemaname = 'public' 
  AND matviewname = 'sku_venta_diaria_mv'
) as vista_existe;

-- Si existe, ver cuántos registros tiene
SELECT COUNT(*) as total_skus
FROM sku_venta_diaria_mv;

-- Ver ejemplos de datos
SELECT sku, fecha_inicio, fecha_fin, dias_periodo, total_vendido, venta_diaria
FROM sku_venta_diaria_mv
LIMIT 5;
