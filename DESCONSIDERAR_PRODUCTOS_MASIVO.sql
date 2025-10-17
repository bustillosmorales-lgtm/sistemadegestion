-- =====================================================
-- DESCONSIDERAR PRODUCTOS MASIVAMENTE
-- =====================================================
--
-- Este SQL te permite marcar productos como "desconsiderados"
-- para que NO aparezcan en "Necesita Reposición"
--
-- =====================================================

-- OPCIÓN 1: Desconsiderar productos específicos por SKU
-- =====================================================

-- Ejemplo: Desconsiderar 3 productos específicos
UPDATE products
SET desconsiderado = true
WHERE sku IN (
  'TEST-001',
  'TEST-002',
  'TEST-003'
);

-- Para desconsiderar MUCHOS productos, copia y pega tus SKUs:
/*
UPDATE products
SET desconsiderado = true
WHERE sku IN (
  '010918VE',
  '01HR3309',
  '0',
  -- ... agrega todos los SKUs aquí, separados por comas
  'SKU-N'
);
*/

-- =====================================================
-- OPCIÓN 2: Desconsiderar por condiciones
-- =====================================================

-- Ejemplo: Desconsiderar todos los productos con stock > 1000
/*
UPDATE products
SET desconsiderado = true
WHERE stock > 1000;
*/

-- Ejemplo: Desconsiderar productos sin ventas en 90 días
/*
UPDATE products
SET desconsiderado = true
WHERE sku NOT IN (
  SELECT DISTINCT sku
  FROM sales
  WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
);
*/

-- Ejemplo: Desconsiderar productos con CBM muy alto
/*
UPDATE products
SET desconsiderado = true
WHERE cbm > 0.5;
*/

-- =====================================================
-- OPCIÓN 3: RE-CONSIDERAR productos (volver a activos)
-- =====================================================

-- Re-considerar productos específicos
/*
UPDATE products
SET desconsiderado = false
WHERE sku IN (
  'SKU-001',
  'SKU-002'
);
*/

-- Re-considerar TODOS los productos
/*
UPDATE products
SET desconsiderado = false;
*/

-- =====================================================
-- VERIFICACIONES
-- =====================================================

-- Ver cuántos productos están desconsiderados
SELECT
  COUNT(*) as total_desconsiderados
FROM products
WHERE desconsiderado = true;

-- Ver lista de productos desconsiderados
SELECT
  sku,
  description,
  stock,
  desconsiderado
FROM products
WHERE desconsiderado = true
ORDER BY sku
LIMIT 50;

-- Ver resumen completo
SELECT
  CASE
    WHEN desconsiderado = true THEN 'Desconsiderados'
    WHEN desconsiderado = false THEN 'Activos'
    ELSE 'Sin definir (NULL)'
  END as estado,
  COUNT(*) as total
FROM products
GROUP BY desconsiderado
ORDER BY desconsiderado;

-- =====================================================
-- CÓMO USAR ESTE ARCHIVO
-- =====================================================
--
-- 1. Si tienes POCOS productos (< 20):
--    - Usa OPCIÓN 1 con lista de SKUs
--    - Copia tus SKUs en la lista
--    - Ejecuta el UPDATE
--
-- 2. Si tienes MUCHOS productos (1180 como mencionaste):
--    - Descarga la lista de SKUs de "Necesita Reposición"
--    - Abre el Excel
--    - Copia la columna SKU
--    - Pégala aquí reemplazando los ejemplos
--    - Ejecuta el UPDATE
--
-- 3. Si quieres desconsiderar por condición:
--    - Usa OPCIÓN 2
--    - Modifica la condición WHERE según tu necesidad
--
-- =====================================================

-- EJEMPLO PRÁCTICO: Desconsiderar los 1180 productos
-- =====================================================
--
-- Si descargaste el Excel de "Necesita Reposición" y tiene 1180 productos,
-- puedes copiar los SKUs y pegarlos así:
--
/*
UPDATE products
SET desconsiderado = true
WHERE sku IN (
  '010918VE',
  '01HR3309',
  '0',
  -- ... pegar los 1180 SKUs aquí ...
);
*/
--
-- CONSEJO: Usa un editor de texto para:
-- 1. Copiar columna SKU del Excel
-- 2. Buscar/Reemplazar saltos de línea por: ',\n  '
-- 3. Agregar comillas simples al inicio y fin de cada línea
--
-- O usa esta fórmula en Excel en una nueva columna:
-- ="'" & A2 & "',"
-- Donde A2 es la celda con el SKU
-- Luego copia toda esa columna y pégala aquí
--
-- =====================================================
