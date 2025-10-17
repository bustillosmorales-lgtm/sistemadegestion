-- FIX: Permisos para bucket job-files
-- Ejecutar en Supabase SQL Editor

-- Opción 1: Deshabilitar RLS para el bucket (MÁS SIMPLE)
-- Esto permite que el service key tenga acceso completo

-- Primero, verificar el bucket
SELECT * FROM storage.buckets WHERE name = 'job-files';

-- Crear políticas para permitir operaciones con service_role
CREATE POLICY "Allow service role to upload"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'job-files');

CREATE POLICY "Allow service role to read"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'job-files');

CREATE POLICY "Allow service role to update"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'job-files');

CREATE POLICY "Allow service role to delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'job-files');

-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
