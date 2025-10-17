# 📋 SQL para Crear Tabla processing_jobs

## Copia y pega este SQL en Supabase SQL Editor

```sql
-- =====================================================
-- Tabla: processing_jobs
-- Propósito: Gestionar jobs asíncronos para Netlify Free
-- =====================================================

-- Crear tabla
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_type ON processing_jobs(type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at DESC);

-- Verificar
SELECT 'Tabla processing_jobs creada exitosamente' as mensaje;
SELECT COUNT(*) as registros_actuales FROM processing_jobs;
```

## Pasos:

1. Ve a: https://supabase.com (tu proyecto)
2. Click en **"SQL Editor"** en el menú lateral
3. Click en **"New Query"**
4. Copia y pega el SQL de arriba
5. Click en **"Run"** (Ctrl+Enter)

Deberías ver:
```
✅ Success. No rows returned
```

Y luego refrescar el schema cache automáticamente.
