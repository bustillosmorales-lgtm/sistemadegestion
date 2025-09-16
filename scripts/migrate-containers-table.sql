-- Migración para agregar campos faltantes a la tabla containers
-- Ejecutar en el SQL Editor de Supabase

-- Agregar columna actual_departure si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'containers' AND column_name = 'actual_departure') THEN
        ALTER TABLE containers ADD COLUMN actual_departure TIMESTAMP;
        COMMENT ON COLUMN containers.actual_departure IS 'Fecha y hora real de salida del contenedor';
    END IF;
END $$;

-- Agregar columna actual_arrival_date si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'containers' AND column_name = 'actual_arrival_date') THEN
        ALTER TABLE containers ADD COLUMN actual_arrival_date TIMESTAMP;
        COMMENT ON COLUMN containers.actual_arrival_date IS 'Fecha y hora real de llegada del contenedor';
    END IF;
END $$;

-- Verificar las columnas agregadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'containers' 
AND column_name IN ('actual_departure', 'actual_arrival_date')
ORDER BY column_name;