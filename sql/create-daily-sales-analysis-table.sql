-- Crear tabla para almacenar venta_diaria pre-calculada
-- Esta tabla contendrá los datos reales calculados nocturnamente

CREATE TABLE IF NOT EXISTS daily_sales_analysis (
    sku VARCHAR(255) PRIMARY KEY,
    venta_diaria DECIMAL(10,4) NOT NULL DEFAULT 0,
    fecha_calculo DATE NOT NULL DEFAULT CURRENT_DATE,
    dias_historicos INTEGER NOT NULL DEFAULT 0,
    fecha_inicio DATE,
    fecha_fin DATE,
    total_vendido DECIMAL(10,2) DEFAULT 0,
    metodo_calculo VARCHAR(50) DEFAULT 'real_data',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_sales_sku
ON daily_sales_analysis(sku);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_sales_fecha_calculo
ON daily_sales_analysis(fecha_calculo DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_sales_venta_diaria
ON daily_sales_analysis(venta_diaria DESC);

-- Comentarios para documentación
COMMENT ON TABLE daily_sales_analysis IS 'Tabla que almacena venta diaria pre-calculada para cada SKU. Se actualiza nocturnamente con datos reales.';
COMMENT ON COLUMN daily_sales_analysis.sku IS 'SKU del producto';
COMMENT ON COLUMN daily_sales_analysis.venta_diaria IS 'Venta promedio diaria calculada con datos históricos reales';
COMMENT ON COLUMN daily_sales_analysis.fecha_calculo IS 'Fecha en que se realizó el cálculo';
COMMENT ON COLUMN daily_sales_analysis.dias_historicos IS 'Cantidad de días históricos utilizados en el cálculo';
COMMENT ON COLUMN daily_sales_analysis.fecha_inicio IS 'Fecha de inicio del período analizado';
COMMENT ON COLUMN daily_sales_analysis.fecha_fin IS 'Fecha de fin del período analizado';
COMMENT ON COLUMN daily_sales_analysis.metodo_calculo IS 'Método utilizado: real_data, first_sale, default_period';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_daily_sales_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_sales_analysis_updated_at
    BEFORE UPDATE ON daily_sales_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_sales_analysis_updated_at();

-- Verificar la creación
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'daily_sales_analysis'
ORDER BY ordinal_position;