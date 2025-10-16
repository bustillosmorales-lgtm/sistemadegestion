-- ============================================
-- Agregar columna fecha_efectiva_llegada a tabla containers
-- ============================================

-- Verificar si la columna ya existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'containers'
        AND column_name = 'fecha_efectiva_llegada'
    ) THEN
        -- Agregar la columna como DATE
        ALTER TABLE containers
        ADD COLUMN fecha_efectiva_llegada DATE;

        -- Agregar índice para búsquedas por estado (bodega vs tránsito)
        CREATE INDEX IF NOT EXISTS idx_containers_fecha_efectiva
        ON containers(fecha_efectiva_llegada) WHERE fecha_efectiva_llegada IS NOT NULL;

        -- Agregar comentario
        COMMENT ON COLUMN containers.fecha_efectiva_llegada IS 'Fecha efectiva de llegada a bodega. Si tiene valor = EN BODEGA, si es NULL = EN TRÁNSITO';

        RAISE NOTICE 'Columna fecha_efectiva_llegada agregada exitosamente a tabla containers';
    ELSE
        RAISE NOTICE 'La columna fecha_efectiva_llegada ya existe en tabla containers';
    END IF;
END $$;

-- Migrar datos existentes: Copiar actual_arrival_date a fecha_efectiva_llegada donde exista
UPDATE containers
SET fecha_efectiva_llegada = actual_arrival_date::DATE
WHERE actual_arrival_date IS NOT NULL
  AND fecha_efectiva_llegada IS NULL;

-- Verificar el esquema actualizado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'containers'
ORDER BY ordinal_position;
