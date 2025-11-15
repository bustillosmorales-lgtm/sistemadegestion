-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- Impacto esperado: Queries 10-100x más rápidas

-- 1. Índice en fecha_calculo (usado en TODAS las queries)
-- Beneficio: Query de última fecha será instantánea
CREATE INDEX IF NOT EXISTS idx_predicciones_fecha_calculo
ON predicciones(fecha_calculo DESC);

-- 2. Índice en clasificacion_abc (filtro común)
-- Beneficio: Filtrar "Solo Clase A" será instantáneo
CREATE INDEX IF NOT EXISTS idx_predicciones_abc
ON predicciones(clasificacion_abc);

-- 3. Índice en SKU (búsqueda con ILIKE)
-- Beneficio: Búsqueda de SKU será instantánea
-- NOTA: Usamos gin con pg_trgm para ILIKE eficiente
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_predicciones_sku_trgm
ON predicciones USING gin(sku gin_trgm_ops);

-- 4. Índice en valor_total_sugerencia (ordenamiento)
-- Beneficio: ORDER BY será instantáneo
CREATE INDEX IF NOT EXISTS idx_predicciones_valor
ON predicciones(valor_total_sugerencia DESC);

-- 5. Índice compuesto para query más común
-- Beneficio: Query completa (fecha + orden) será instantánea
CREATE INDEX IF NOT EXISTS idx_predicciones_fecha_valor
ON predicciones(fecha_calculo DESC, valor_total_sugerencia DESC);

-- 6. Índice para filtro de alertas
-- Beneficio: "Solo con alertas" será instantáneo
CREATE INDEX IF NOT EXISTS idx_predicciones_alertas
ON predicciones USING gin(alertas)
WHERE alertas IS NOT NULL AND alertas != '{}';

-- ============================================
-- VERIFICAR ÍNDICES CREADOS
-- ============================================
-- Ejecuta esto para ver todos los índices:
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
WHERE tablename = 'predicciones'
ORDER BY indexname;

-- ============================================
-- ANALIZAR PERFORMANCE
-- ============================================
-- Antes de crear índices, ejecuta:
-- EXPLAIN ANALYZE SELECT * FROM predicciones WHERE fecha_calculo = (SELECT MAX(fecha_calculo) FROM predicciones);
--
-- Después de crear índices, ejecuta la misma query y compara tiempos
