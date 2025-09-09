-- Migración para agregar campos faltantes a la tabla products
-- Ejecutar en el SQL Editor de Supabase

-- Agregar columna categoria si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'categoria') THEN
        ALTER TABLE products ADD COLUMN categoria TEXT;
        COMMENT ON COLUMN products.categoria IS 'Categoría del producto';
    END IF;
END $$;

-- Agregar columna precio_venta_sugerido si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'precio_venta_sugerido') THEN
        ALTER TABLE products ADD COLUMN precio_venta_sugerido DECIMAL(10,2);
        COMMENT ON COLUMN products.precio_venta_sugerido IS 'Precio de venta sugerido en pesos chilenos';
    END IF;
END $$;

-- Agregar columna proveedor si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'proveedor') THEN
        ALTER TABLE products ADD COLUMN proveedor TEXT;
        COMMENT ON COLUMN products.proveedor IS 'Nombre del proveedor principal';
    END IF;
END $$;

-- Agregar columna notas si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'notas') THEN
        ALTER TABLE products ADD COLUMN notas TEXT;
        COMMENT ON COLUMN products.notas IS 'Notas adicionales del producto';
    END IF;
END $$;

-- Agregar columna codigo_interno si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'codigo_interno') THEN
        ALTER TABLE products ADD COLUMN codigo_interno TEXT;
        COMMENT ON COLUMN products.codigo_interno IS 'Código interno de la empresa';
    END IF;
END $$;

-- Verificar las columnas agregadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('categoria', 'precio_venta_sugerido', 'proveedor', 'notas', 'codigo_interno')
ORDER BY column_name;