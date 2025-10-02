-- ========================================
-- AGREGAR CAMPO FECHA DE QUIEBRE DE STOCK
-- Ejecutar en Supabase SQL Editor
-- ========================================

-- 1. Agregar campo last_stockout_date a tabla products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS last_stockout_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_products_stockout_date
ON products(last_stockout_date)
WHERE last_stockout_date IS NOT NULL;

-- 3. Función para actualizar fecha de quiebre automáticamente
CREATE OR REPLACE FUNCTION update_stockout_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actúa cuando stock pasa de >0 a 0 (nuevo quiebre)
    IF OLD.stock_actual > 0 AND NEW.stock_actual = 0 THEN
        NEW.last_stockout_date = NOW();

        -- Log para debug (opcional)
        RAISE LOG 'Stock agotado para SKU: % en fecha: %', NEW.sku, NOW();
    END IF;

    -- Cuando stock vuelve a tener existencias, mantener la fecha (no resetear)
    -- La fecha representa la ÚLTIMA vez que hubo quiebre

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear trigger que se ejecuta antes de UPDATE
CREATE OR REPLACE TRIGGER stockout_date_trigger
    BEFORE UPDATE OF stock_actual ON products
    FOR EACH ROW
    WHEN (OLD.stock_actual IS DISTINCT FROM NEW.stock_actual)
    EXECUTE FUNCTION update_stockout_date();

-- 5. Comentarios para documentación
COMMENT ON COLUMN products.last_stockout_date IS 'Fecha de la última vez que el stock llegó a cero. Se actualiza automáticamente via trigger.';
COMMENT ON FUNCTION update_stockout_date() IS 'Función trigger que actualiza last_stockout_date cuando stock_actual cambia de >0 a 0';
COMMENT ON TRIGGER stockout_date_trigger ON products IS 'Trigger que ejecuta update_stockout_date() cuando stock_actual cambia';

-- 6. Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Campo last_stockout_date agregado exitosamente a tabla products';
    RAISE NOTICE 'Trigger stockout_date_trigger creado y activo';
    RAISE NOTICE 'El sistema ahora capturará automáticamente fechas de quiebre de stock';
END
$$;