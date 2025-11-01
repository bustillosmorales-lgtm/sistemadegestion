-- ================================================
-- VERIFICACIÓN COMPLETA DEL ESTADO ACTUAL
-- ================================================
-- Ejecuta esto en Supabase SQL Editor para ver qué está mal

-- 1. Verificar RLS en tablas
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS_Habilitado"
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

-- 2. Verificar buckets de Storage
SELECT
  id,
  name,
  public as "Es_Publico",
  created_at
FROM storage.buckets
WHERE id = 'excel-uploads';

-- 3. Verificar políticas de Storage
SELECT
  name,
  definition
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- ================================================
-- RESULTADOS ESPERADOS:
-- ================================================
-- 1. RLS_Habilitado debe ser "false" en todas las 9 tablas
-- 2. Es_Publico debe ser "true" para excel-uploads
-- 3. Debe haber al menos 1 política para storage.objects
