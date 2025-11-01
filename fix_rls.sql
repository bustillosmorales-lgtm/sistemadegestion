-- ================================================
-- FIX: Deshabilitar RLS temporalmente para desarrollo
-- ================================================
-- Ejecutar esto en Supabase SQL Editor

-- OPCIÓN 1: Deshabilitar RLS completamente (para desarrollo)
-- Esto permite que cualquiera pueda leer/escribir

ALTER TABLE ventas_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_actual DISABLE ROW LEVEL SECURITY;
ALTER TABLE transito_china DISABLE ROW LEVEL SECURITY;
ALTER TABLE compras_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE skus_desconsiderar DISABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;

-- Verificación
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Deberías ver "rowsecurity = false" en todas las tablas
