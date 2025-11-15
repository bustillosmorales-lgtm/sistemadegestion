-- Agregar campos de contenedor a transito_china
DO $$
BEGIN
    -- Agregar numero_contenedor
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='transito_china' AND column_name='numero_contenedor'
    ) THEN
        ALTER TABLE transito_china ADD COLUMN numero_contenedor TEXT;
        CREATE INDEX idx_transito_contenedor ON transito_china(numero_contenedor);
    END IF;

    -- Agregar descripcion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='transito_china' AND column_name='descripcion'
    ) THEN
        ALTER TABLE transito_china ADD COLUMN descripcion TEXT;
    END IF;

    -- Agregar fecha_contenedor
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='transito_china' AND column_name='fecha_contenedor'
    ) THEN
        ALTER TABLE transito_china ADD COLUMN fecha_contenedor DATE;
    END IF;

    -- Agregar origen para distinguir de donde viene el registro
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='transito_china' AND column_name='origen'
    ) THEN
        ALTER TABLE transito_china ADD COLUMN origen TEXT DEFAULT 'carga_masiva';
    END IF;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Campos de contenedor agregados a transito_china correctamente';
END $$;
