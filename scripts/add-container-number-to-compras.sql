-- ============================================
-- Agregar columna container_number a tabla compras
-- ============================================

-- Verificar si la columna ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'compras'
        AND column_name = 'container_number'
    ) THEN
        -- Agregar la columna
        ALTER TABLE compras
        ADD COLUMN container_number VARCHAR(50);

        -- Agregar índice para búsquedas rápidas
        CREATE INDEX IF NOT EXISTS idx_compras_container_number
        ON compras(container_number);

        -- Agregar comentario
        COMMENT ON COLUMN compras.container_number IS 'Número del contenedor asociado a la compra';

        RAISE NOTICE 'Columna container_number agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna container_number ya existe';
    END IF;
END $$;

-- Verificar el esquema actualizado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'compras'
ORDER BY ordinal_position;
