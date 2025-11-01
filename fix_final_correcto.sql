-- ================================================
-- FIX DEFINITIVO CORREGIDO - EJECUTAR TODO
-- ================================================

-- 1. BORRAR TODAS LAS POLÍTICAS PRIMERO
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. DESHABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE IF EXISTS ventas_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_actual DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transito_china DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compras_historicas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS skus_desconsiderar DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS predicciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alertas_inventario DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS metricas_modelo DISABLE ROW LEVEL SECURITY;

-- 3. CREAR BUCKET SI NO EXISTE
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-uploads', 'excel-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. VERIFICACIÓN FINAL (CORREGIDA)
-- Ver RLS en tablas
SELECT
  'TABLA' as tipo,
  tablename as nombre,
  CASE WHEN rowsecurity THEN 'SI (❌ MAL)' ELSE 'NO (✅ BIEN)' END as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'ventas_historicas', 'stock_actual', 'transito_china',
    'compras_historicas', 'packs', 'skus_desconsiderar',
    'predicciones', 'alertas_inventario', 'metricas_modelo'
  )
ORDER BY tablename;

-- Ver bucket
SELECT
  'BUCKET' as tipo,
  name as nombre,
  CASE WHEN public THEN 'SI (✅ BIEN)' ELSE 'NO (❌ MAL)' END as es_publico
FROM storage.buckets
WHERE id = 'excel-uploads';

-- ================================================
-- RESULTADO ESPERADO:
-- ================================================
-- TODAS las tablas deben mostrar: "NO (✅ BIEN)"
-- El BUCKET debe mostrar: "SI (✅ BIEN)"
