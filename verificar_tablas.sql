-- Verificar que todas las tablas necesarias existen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar estructura de cada tabla
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'ventas_historicas',
    'stock_actual',
    'transito_china',
    'compras_historicas',
    'packs',
    'skus_desconsiderar',
    'predicciones',
    'alertas_inventario',
    'metricas_modelo'
  )
ORDER BY table_name, ordinal_position;

-- Verificar conteo de registros en cada tabla
SELECT
  'ventas_historicas' as tabla,
  COUNT(*) as registros
FROM ventas_historicas
UNION ALL
SELECT 'stock_actual', COUNT(*) FROM stock_actual
UNION ALL
SELECT 'transito_china', COUNT(*) FROM transito_china
UNION ALL
SELECT 'compras_historicas', COUNT(*) FROM compras_historicas
UNION ALL
SELECT 'packs', COUNT(*) FROM packs
UNION ALL
SELECT 'skus_desconsiderar', COUNT(*) FROM skus_desconsiderar
UNION ALL
SELECT 'predicciones', COUNT(*) FROM predicciones
UNION ALL
SELECT 'alertas_inventario', COUNT(*) FROM alertas_inventario
UNION ALL
SELECT 'metricas_modelo', COUNT(*) FROM metricas_modelo;
