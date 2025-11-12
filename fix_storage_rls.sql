-- ================================================
-- FIX STORAGE: Crear bucket y políticas RLS
-- ================================================
-- Ejecutar en Supabase SQL Editor

-- 1. Crear bucket excel-uploads (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-uploads', 'excel-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Permitir lectura pública" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload anónimo en excel-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delete autenticado" ON storage.objects;

-- 3. Crear políticas para el bucket excel-uploads

-- Permitir lectura pública de archivos en excel-uploads
CREATE POLICY "Lectura pública excel-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'excel-uploads');

-- Permitir subir archivos a excel-uploads (con anon key)
CREATE POLICY "Upload público excel-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'excel-uploads');

-- Permitir actualizar archivos en excel-uploads
CREATE POLICY "Update público excel-uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'excel-uploads')
WITH CHECK (bucket_id = 'excel-uploads');

-- Permitir eliminar archivos en excel-uploads
CREATE POLICY "Delete público excel-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'excel-uploads');

-- 4. Verificar que el bucket está público
UPDATE storage.buckets
SET public = true
WHERE id = 'excel-uploads';

-- 5. Verificación
SELECT
  'Bucket configurado correctamente' as status,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'excel-uploads';
