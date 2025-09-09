-- Migración para crear tablas necesarias para APIs externas
-- Ejecutar en el SQL Editor de Supabase

-- Tabla para configuraciones de APIs
CREATE TABLE IF NOT EXISTS api_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_name VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(api_name)
);

-- Comentarios para la tabla de configuraciones
COMMENT ON TABLE api_configurations IS 'Configuraciones de APIs externas (MercadoLibre, Defontana, etc.)';
COMMENT ON COLUMN api_configurations.api_name IS 'Nombre de la API (mercadolibre, defontana)';
COMMENT ON COLUMN api_configurations.config IS 'Configuración JSON con tokens, keys, etc.';
COMMENT ON COLUMN api_configurations.active IS 'Si la configuración está activa';

-- Tabla para mapeos entre productos internos y externos
CREATE TABLE IF NOT EXISTS platform_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,
    internal_sku VARCHAR(100) NOT NULL,
    external_id VARCHAR(200) NOT NULL,
    external_data JSONB,
    last_sync TIMESTAMP WITH TIME ZONE,
    last_quantity INTEGER,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(platform, internal_sku),
    FOREIGN KEY (internal_sku) REFERENCES products(sku) ON DELETE CASCADE
);

-- Comentarios para la tabla de mapeos
COMMENT ON TABLE platform_mappings IS 'Mapeos entre productos internos y productos en plataformas externas';
COMMENT ON COLUMN platform_mappings.platform IS 'Plataforma externa (mercadolibre, defontana)';
COMMENT ON COLUMN platform_mappings.internal_sku IS 'SKU interno del producto';
COMMENT ON COLUMN platform_mappings.external_id IS 'ID del producto en la plataforma externa';
COMMENT ON COLUMN platform_mappings.external_data IS 'Datos adicionales del producto externo';
COMMENT ON COLUMN platform_mappings.last_sync IS 'Última vez que se sincronizó';
COMMENT ON COLUMN platform_mappings.last_quantity IS 'Última cantidad sincronizada';

-- Tabla para órdenes/ventas externas
CREATE TABLE IF NOT EXISTS external_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(200) NOT NULL,
    order_data JSONB NOT NULL,
    status VARCHAR(50),
    total_amount DECIMAL(10,2),
    date_created TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(platform, external_id)
);

-- Comentarios para la tabla de órdenes externas
COMMENT ON TABLE external_orders IS 'Órdenes/ventas importadas desde plataformas externas';
COMMENT ON COLUMN external_orders.platform IS 'Plataforma de origen (mercadolibre, defontana)';
COMMENT ON COLUMN external_orders.external_id IS 'ID de la orden en la plataforma externa';
COMMENT ON COLUMN external_orders.order_data IS 'Datos completos de la orden';
COMMENT ON COLUMN external_orders.processed_at IS 'Cuándo se procesó la orden';

-- Tabla para logs de sincronización
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,
    sync_type VARCHAR(100) NOT NULL,
    date_from TIMESTAMP WITH TIME ZONE,
    date_to TIMESTAMP WITH TIME ZONE,
    results JSONB,
    error_message TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Comentarios para la tabla de logs
COMMENT ON TABLE sync_logs IS 'Registros de sincronizaciones con plataformas externas';
COMMENT ON COLUMN sync_logs.platform IS 'Plataforma sincronizada';
COMMENT ON COLUMN sync_logs.sync_type IS 'Tipo de sincronización (inventory_sync, sales_sync, etc.)';
COMMENT ON COLUMN sync_logs.results IS 'Resultados de la sincronización en JSON';
COMMENT ON COLUMN sync_logs.duration_seconds IS 'Duración de la sincronización en segundos';

-- Agregar campos adicionales a la tabla de ventas para tracking de plataformas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ventas' AND column_name = 'canal') THEN
        ALTER TABLE ventas ADD COLUMN canal VARCHAR(50);
        COMMENT ON COLUMN ventas.canal IS 'Canal de venta (mercadolibre, defontana, manual)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ventas' AND column_name = 'external_order_id') THEN
        ALTER TABLE ventas ADD COLUMN external_order_id VARCHAR(200);
        COMMENT ON COLUMN ventas.external_order_id IS 'ID de la orden en la plataforma externa';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ventas' AND column_name = 'buyer_info') THEN
        ALTER TABLE ventas ADD COLUMN buyer_info JSONB;
        COMMENT ON COLUMN ventas.buyer_info IS 'Información del comprador desde la plataforma externa';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ventas' AND column_name = 'defontana_invoice_id') THEN
        ALTER TABLE ventas ADD COLUMN defontana_invoice_id VARCHAR(100);
        COMMENT ON COLUMN ventas.defontana_invoice_id IS 'ID de la factura en Defontana';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ventas' AND column_name = 'invoiced_at') THEN
        ALTER TABLE ventas ADD COLUMN invoiced_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN ventas.invoiced_at IS 'Cuándo se creó la factura en Defontana';
    END IF;
END $$;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_platform_mappings_platform ON platform_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_platform_mappings_internal_sku ON platform_mappings(internal_sku);
CREATE INDEX IF NOT EXISTS idx_platform_mappings_last_sync ON platform_mappings(last_sync);
CREATE INDEX IF NOT EXISTS idx_external_orders_platform ON external_orders(platform);
CREATE INDEX IF NOT EXISTS idx_external_orders_external_id ON external_orders(external_id);
CREATE INDEX IF NOT EXISTS idx_external_orders_date_created ON external_orders(date_created);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ventas_canal ON ventas(canal) WHERE canal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_external_order_id ON ventas(external_order_id) WHERE external_order_id IS NOT NULL;

-- Función para actualizar timestamp de updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_api_configurations_updated_at ON api_configurations;
CREATE TRIGGER update_api_configurations_updated_at 
    BEFORE UPDATE ON api_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_mappings_updated_at ON platform_mappings;
CREATE TRIGGER update_platform_mappings_updated_at 
    BEFORE UPDATE ON platform_mappings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar las tablas creadas
SELECT 
    tablename,
    schemaname
FROM pg_tables 
WHERE tablename IN ('api_configurations', 'platform_mappings', 'external_orders', 'sync_logs')
    AND schemaname = 'public'
ORDER BY tablename;