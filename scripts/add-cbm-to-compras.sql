-- ============================================
-- Agregar columna CBM a tabla compras
-- ============================================

-- Verificar si la columna ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'compras'
        AND column_name = 'cbm'
    ) THEN
        -- Agregar la columna CBM como NUMERIC(10,4) para precisión
        ALTER TABLE compras
        ADD COLUMN cbm NUMERIC(10,4);

        -- Agregar índice para búsquedas y ordenamiento
        CREATE INDEX IF NOT EXISTS idx_compras_cbm
        ON compras(cbm) WHERE cbm IS NOT NULL;

        -- Agregar comentario
        COMMENT ON COLUMN compras.cbm IS 'Metros cúbicos (CBM) del producto en esta compra específica';

        RAISE NOTICE 'Columna cbm agregada exitosamente a tabla compras';
    ELSE
        RAISE NOTICE 'La columna cbm ya existe en tabla compras';
    END IF;
END $$;

-- Verificar el esquema actualizado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'compras'
ORDER BY ordinal_position;
