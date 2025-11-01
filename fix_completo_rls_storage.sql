-- ================================================
-- FIX COMPLETO: RLS + Storage
-- ================================================
-- Ejecutar TODO este script en Supabase SQL Editor

-- 1. DESHABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE ventas_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_actual DISABLE ROW LEVEL SECURITY;
ALTER TABLE transito_china DISABLE ROW LEVEL SECURITY;
ALTER TABLE compras_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE skus_desconsiderar DISABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;

-- 2. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Permitir lectura pública" ON ventas_historicas;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON ventas_historicas;
DROP POLICY IF EXISTS "Permitir lectura pública" ON stock_actual;
DROP POLICY IF EXISTS "Permitir upsert con service_role" ON stock_actual;
DROP POLICY IF EXISTS "Permitir update con service_role" ON stock_actual;
DROP POLICY IF EXISTS "Permitir lectura pública" ON transito_china;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON transito_china;
DROP POLICY IF EXISTS "Permitir lectura pública" ON compras_historicas;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON compras_historicas;
DROP POLICY IF EXISTS "Permitir lectura pública" ON packs;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON packs;
DROP POLICY IF EXISTS "Permitir lectura pública" ON skus_desconsiderar;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON skus_desconsiderar;
DROP POLICY IF EXISTS "Permitir lectura pública" ON predicciones;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON predicciones;
DROP POLICY IF EXISTS "Permitir lectura pública" ON alertas_inventario;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON alertas_inventario;
DROP POLICY IF EXISTS "Permitir update con service_role" ON alertas_inventario;
DROP POLICY IF EXISTS "Permitir lectura pública" ON metricas_modelo;
DROP POLICY IF EXISTS "Permitir inserción con service_role" ON metricas_modelo;

-- 3. VERIFICACIÓN
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
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
ORDER BY tablename;

-- Deberías ver "rowsecurity = false" en todas las tablas
