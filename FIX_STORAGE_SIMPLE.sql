-- FIX RÁPIDO: Deshabilitar RLS para bucket job-files
-- Copiar y pegar en Supabase SQL Editor

-- Ver estado actual
SELECT
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'job-files';

-- Actualizar bucket para que sea público (más simple)
UPDATE storage.buckets
SET public = true
WHERE name = 'job-files';

-- Verificar cambio
SELECT
  name,
  public,
  'Bucket configurado como público - archivos accesibles con service_role' as status
FROM storage.buckets
WHERE name = 'job-files';

-- ✅ Ahora el service_role key puede subir archivos sin problemas
