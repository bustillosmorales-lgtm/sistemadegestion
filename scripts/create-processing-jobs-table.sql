-- =====================================================
-- Tabla: processing_jobs
-- Propósito: Gestionar jobs asíncronos para Netlify Free
-- =====================================================

-- Eliminar tabla si existe (solo para desarrollo)
DROP TABLE IF EXISTS processing_jobs CASCADE;

-- Crear tabla
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de job
  type VARCHAR(50) NOT NULL, -- 'import_by_action', 'export_by_status', 'bulk_upload', etc.

  -- Estado del job
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'

  -- Datos del job
  file_url TEXT, -- URL del archivo en Supabase Storage
  parameters JSONB, -- Parámetros adicionales del job

  -- Progreso
  progress INTEGER DEFAULT 0, -- 0-100
  total_items INTEGER, -- Total de items a procesar
  processed_items INTEGER DEFAULT 0, -- Items procesados

  -- Resultados
  results JSONB, -- Resultados del procesamiento
  error_message TEXT, -- Mensaje de error si failed

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by VARCHAR(100), -- Email del usuario que creó el job
  ip_address INET -- IP del cliente
);

-- Índices para mejorar performance
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at DESC);
CREATE INDEX idx_processing_jobs_status_created ON processing_jobs(status, created_at) WHERE status IN ('queued', 'processing');

-- Índice compuesto para queries comunes
CREATE INDEX idx_processing_jobs_lookup ON processing_jobs(type, status, created_at DESC);

-- Función para limpiar jobs antiguos (más de 30 días)
CREATE OR REPLACE FUNCTION clean_old_processing_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processing_jobs
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular progreso automáticamente
CREATE OR REPLACE FUNCTION update_job_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_items > 0 THEN
    NEW.progress = ROUND((NEW.processed_items::NUMERIC / NEW.total_items::NUMERIC) * 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar progreso automáticamente
CREATE TRIGGER trigger_update_job_progress
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW
  WHEN (OLD.processed_items IS DISTINCT FROM NEW.processed_items)
  EXECUTE FUNCTION update_job_progress();

-- Comentarios de documentación
COMMENT ON TABLE processing_jobs IS 'Tabla para gestionar jobs asíncronos en Netlify Free (límite 10s)';
COMMENT ON COLUMN processing_jobs.type IS 'Tipo de job: import_by_action, export_by_status, bulk_upload, etc.';
COMMENT ON COLUMN processing_jobs.status IS 'Estado: queued (pendiente), processing (en proceso), completed (completado), failed (fallido)';
COMMENT ON COLUMN processing_jobs.file_url IS 'URL del archivo en Supabase Storage (bucket: job-files)';
COMMENT ON COLUMN processing_jobs.progress IS 'Porcentaje de progreso (0-100), calculado automáticamente';

-- RLS (Row Level Security) - DESHABILITADO para simplificar
-- En producción, habilitar RLS y agregar políticas según roles
ALTER TABLE processing_jobs DISABLE ROW LEVEL SECURITY;

-- Grant permissions (ajustar según tus necesidades)
-- GRANT ALL ON processing_jobs TO service_role;
-- GRANT SELECT, INSERT, UPDATE ON processing_jobs TO authenticated;

-- =====================================================
-- Crear bucket en Supabase Storage (ejecutar manualmente)
-- =====================================================
-- 1. Ir a Storage en Supabase Dashboard
-- 2. Crear bucket "job-files"
-- 3. Configurar como público (opcional) o privado
-- 4. Configurar políticas de acceso

-- =====================================================
-- Ejemplo de uso
-- =====================================================
/*
-- Crear un job
INSERT INTO processing_jobs (type, file_url, parameters, created_by)
VALUES (
  'import_by_action',
  'https://....supabase.co/storage/v1/object/public/job-files/file.xlsx',
  '{"action": "request_quote", "notify": true}',
  'user@example.com'
)
RETURNING *;

-- Buscar jobs pendientes
SELECT * FROM processing_jobs
WHERE status = 'queued'
ORDER BY created_at ASC
LIMIT 10;

-- Actualizar progreso
UPDATE processing_jobs
SET
  processed_items = 50,
  total_items = 100
WHERE id = 'job-uuid';
-- progress se calcula automáticamente (50%)

-- Marcar como completado
UPDATE processing_jobs
SET
  status = 'completed',
  results = '{"success": true, "imported": 100}',
  completed_at = NOW()
WHERE id = 'job-uuid';

-- Limpiar jobs antiguos
SELECT clean_old_processing_jobs();
*/

-- =====================================================
-- Verificación
-- =====================================================
SELECT
  'processing_jobs table created' as message,
  COUNT(*) as initial_rows
FROM processing_jobs;
