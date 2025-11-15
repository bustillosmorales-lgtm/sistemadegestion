-- Migración: Agregar campos de respuesta del proveedor a tabla cotizaciones existente

-- 1. Agregar nuevas columnas (solo si no existen)
DO $$
BEGIN
    -- Campos de respuesta del proveedor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='costo_proveedor') THEN
        ALTER TABLE cotizaciones ADD COLUMN costo_proveedor DECIMAL(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='moneda') THEN
        ALTER TABLE cotizaciones ADD COLUMN moneda TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='cantidad_minima_venta') THEN
        ALTER TABLE cotizaciones ADD COLUMN cantidad_minima_venta INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='unidades_por_embalaje') THEN
        ALTER TABLE cotizaciones ADD COLUMN unidades_por_embalaje INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='metros_cubicos_embalaje') THEN
        ALTER TABLE cotizaciones ADD COLUMN metros_cubicos_embalaje DECIMAL(10,4);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_respuesta') THEN
        ALTER TABLE cotizaciones ADD COLUMN fecha_respuesta TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='notas_proveedor') THEN
        ALTER TABLE cotizaciones ADD COLUMN notas_proveedor TEXT;
    END IF;
END $$;

-- 2. Actualizar constraint de estado para incluir 'respondida'
DO $$
BEGIN
    -- Eliminar constraint anterior si existe
    ALTER TABLE cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

    -- Crear nueva constraint con todos los estados
    ALTER TABLE cotizaciones ADD CONSTRAINT cotizaciones_estado_check
        CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'recibida', 'respondida'));
END $$;

-- 3. Agregar comentarios a las nuevas columnas
COMMENT ON COLUMN cotizaciones.costo_proveedor IS 'Costo cotizado por el proveedor';
COMMENT ON COLUMN cotizaciones.moneda IS 'Moneda del costo (USD, CLP, etc)';
COMMENT ON COLUMN cotizaciones.cantidad_minima_venta IS 'Cantidad mínima de venta del proveedor';
COMMENT ON COLUMN cotizaciones.unidades_por_embalaje IS 'Unidades que vienen por caja/embalaje';
COMMENT ON COLUMN cotizaciones.metros_cubicos_embalaje IS 'Metros cúbicos por embalaje (para cálculo de flete)';
COMMENT ON COLUMN cotizaciones.fecha_respuesta IS 'Fecha en que el proveedor respondió la cotización';
COMMENT ON COLUMN cotizaciones.notas_proveedor IS 'Notas adicionales del proveedor';

-- 4. Actualizar comentario del estado
COMMENT ON COLUMN cotizaciones.estado IS 'Estados: pendiente, aprobada, rechazada, recibida, respondida';

-- Verificación
SELECT 'Migración completada: Columnas agregadas correctamente' as mensaje;
