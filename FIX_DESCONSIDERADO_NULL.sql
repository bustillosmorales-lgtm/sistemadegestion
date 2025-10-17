-- FIX: Productos con desconsiderado = NULL

-- 1. Verificar cuántos productos tienen desconsiderado NULL
SELECT
  'Productos con desconsiderado NULL' as tipo,
  COUNT(*) as total
FROM products
WHERE desconsiderado IS NULL;

-- 2. Verificar cuántos tienen desconsiderado = true
SELECT
  'Productos desconsiderados (true)' as tipo,
  COUNT(*) as total
FROM products
WHERE desconsiderado = true;

-- 3. Verificar cuántos tienen desconsiderado = false
SELECT
  'Productos activos (false)' as tipo,
  COUNT(*) as total
FROM products
WHERE desconsiderado = false;

-- 4. FIX: Actualizar NULL a false (productos activos por defecto)
UPDATE products
SET desconsiderado = false
WHERE desconsiderado IS NULL;

-- 5. Verificar el fix
SELECT
  'DESPUÉS DEL FIX - Total productos' as tipo,
  COUNT(*) as total,
  SUM(CASE WHEN desconsiderado = false THEN 1 ELSE 0 END) as activos,
  SUM(CASE WHEN desconsiderado = true THEN 1 ELSE 0 END) as desconsiderados,
  SUM(CASE WHEN desconsiderado IS NULL THEN 1 ELSE 0 END) as nulos
FROM products;
