-- add-password-column.sql
-- Migración para agregar columna password a la tabla users
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar la columna password con valor por defecto
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '123456';

-- 2. Establecer la contraseña por defecto para todos los usuarios existentes
UPDATE users 
SET password = '123456' 
WHERE password IS NULL OR password = '';

-- 3. Verificar que todos los usuarios tienen contraseña
SELECT 
    id, 
    email, 
    name, 
    password,
    created_at
FROM users
ORDER BY email;

-- Comentarios:
-- - Todos los usuarios nuevos tendrán contraseña '123456' por defecto
-- - Todos los usuarios existentes ahora tienen contraseña '123456'
-- - La autenticación en pages/api/auth.js ya está preparada para usar este campo