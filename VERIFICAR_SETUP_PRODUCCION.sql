-- =====================================================
-- VERIFICACIÓN DEL SETUP EN PRODUCCIÓN
-- Ejecutar en Supabase SQL Editor para confirmar
-- =====================================================

-- 1. Verificar que la tabla processing_jobs existe
SELECT
  'Tabla processing_jobs' as verificacion,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'processing_jobs';

-- 2. Verificar estructura de la tabla
SELECT
  'Columnas de processing_jobs' as verificacion,
  COUNT(*) as total_columnas,
  STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columnas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'processing_jobs';

-- 3. Verificar índices creados
SELECT
  'Índices de processing_jobs' as verificacion,
  COUNT(*) as total_indices,
  STRING_AGG(indexname, ', ') as indices
FROM pg_indexes
WHERE tablename = 'processing_jobs';

-- 4. Verificar bucket job-files
SELECT
  'Bucket job-files' as verificacion,
  name,
  CASE
    WHEN public = true THEN '✅ PÚBLICO'
    ELSE '❌ PRIVADO (ejecutar fix)'
  END as estado,
  created_at
FROM storage.buckets
WHERE name = 'job-files';

-- 5. Verificar productos con desconsiderado NULL
SELECT
  'Productos con desconsiderado NULL' as verificacion,
  COUNT(*) as total,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ SIN NULLS'
    ELSE '⚠️ EJECUTAR FIX'
  END as estado
FROM products
WHERE desconsiderado IS NULL;

-- 6. Resumen de productos por estado desconsiderado
SELECT
  'Resumen productos' as verificacion,
  COUNT(*) as total,
  SUM(CASE WHEN desconsiderado = false THEN 1 ELSE 0 END) as activos,
  SUM(CASE WHEN desconsiderado = true THEN 1 ELSE 0 END) as desconsiderados,
  SUM(CASE WHEN desconsiderado IS NULL THEN 1 ELSE 0 END) as nulos
FROM products;

-- =====================================================
-- RESULTADOS ESPERADOS
-- =====================================================
--
-- 1. Tabla processing_jobs: ✅ EXISTE
-- 2. Columnas: 15 columnas totales
-- 3. Índices: 3 índices (status, type, created_at)
-- 4. Bucket: ✅ PÚBLICO
-- 5. Productos NULL: ✅ SIN NULLS (0)
-- 6. Resumen: nulos = 0
--
-- Si ves estos resultados, el setup está COMPLETO ✅
-- =====================================================
