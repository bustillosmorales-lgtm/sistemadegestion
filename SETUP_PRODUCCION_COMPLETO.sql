-- =====================================================
-- SETUP COMPLETO PARA PRODUCCIÓN
-- Ejecutar TODO este SQL en Supabase SQL Editor
-- =====================================================

-- PASO 1: Crear tabla processing_jobs
-- =====================================================

CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  file_url TEXT,
  parameters JSONB,
  progress INTEGER DEFAULT 0,
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(100),
  ip_address INET
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);

-- =====================================================
-- PASO 2: Configurar bucket job-files (si ya existe)
-- =====================================================

-- Hacer público para que service_role pueda usarlo
UPDATE storage.buckets
SET public = true
WHERE name = 'job-files';

-- Si el bucket NO existe, créalo manualmente en:
-- Storage → New Bucket → nombre: "job-files"
-- Y luego ejecuta el UPDATE de arriba

-- =====================================================
-- PASO 3: Fix de productos con desconsiderado NULL
-- =====================================================

-- Actualizar NULL a false (productos activos por defecto)
UPDATE products
SET desconsiderado = false
WHERE desconsiderado IS NULL;

-- =====================================================
-- VERIFICACIONES
-- =====================================================

-- Verificar tabla processing_jobs
SELECT 'Tabla processing_jobs' as item, COUNT(*) as registros FROM processing_jobs;

-- Verificar bucket
SELECT 'Bucket job-files' as item, name, public FROM storage.buckets WHERE name = 'job-files';

-- Verificar productos desconsiderados
SELECT
  'Productos' as item,
  COUNT(*) as total,
  SUM(CASE WHEN desconsiderado = false OR desconsiderado IS NULL THEN 1 ELSE 0 END) as activos,
  SUM(CASE WHEN desconsiderado = true THEN 1 ELSE 0 END) as desconsiderados
FROM products;

-- =====================================================
-- ✅ Si ves resultados de las verificaciones, ¡todo listo!
-- =====================================================
