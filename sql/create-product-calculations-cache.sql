-- Tabla para cachear los cálculos exactos de product-quote-info
CREATE TABLE IF NOT EXISTS product_calculations_cache (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(255) UNIQUE NOT NULL,

    -- Valores calculados exactos
    venta_diaria_real DECIMAL(10,4) NOT NULL,
    stock_objetivo INTEGER NOT NULL,
    stock_en_transito INTEGER NOT NULL DEFAULT 0,
    consumo_durante_lead_time INTEGER NOT NULL,
    stock_proyectado_llegada INTEGER NOT NULL,
    cantidad_sugerida INTEGER NOT NULL,
    lead_time_dias INTEGER NOT NULL,
    stock_saludable_dias INTEGER NOT NULL,

    -- Metadata del cálculo
    calculation_method VARCHAR(100) NOT NULL DEFAULT 'real_time',
    fecha_calculo TIMESTAMP DEFAULT NOW(),
    config_used JSONB,

    -- Índices para performance
    INDEX idx_sku (sku),
    INDEX idx_fecha_calculo (fecha_calculo)
);

-- RLS policy if needed
ALTER TABLE product_calculations_cache ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated users" ON product_calculations_cache
    FOR ALL USING (auth.role() = 'authenticated');