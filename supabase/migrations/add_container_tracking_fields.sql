-- Migración: Agregar campos de seguimiento de contenedores a cotizaciones

-- 1. Agregar campos de seguimiento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_confirmacion_compra') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_confirmacion_compra TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_carga_contenedor') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_carga_contenedor TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='numero_contenedor') THEN
        ALTER TABLE cotizaciones ADD COLUMN numero_contenedor TEXT;
    END IF;
END $$;

-- 2. Crear índice para búsquedas por contenedor
CREATE INDEX IF NOT EXISTS idx_cotizaciones_contenedor ON cotizaciones(numero_contenedor);

-- 3. Agregar comentarios
COMMENT ON COLUMN cotizaciones.fecha_confirmacion_compra IS 'Fecha en que proveedor confirma recepción de orden de compra';
COMMENT ON COLUMN cotizaciones.fecha_carga_contenedor IS 'Fecha en que mercadería se carga en contenedor';
COMMENT ON COLUMN cotizaciones.numero_contenedor IS 'Número del contenedor donde se cargó la mercadería';

-- Verificación
SELECT 'Migración completada: Campos de contenedores agregados' as mensaje;
