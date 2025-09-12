-- Crear tabla para cachear cálculos completos de análisis
CREATE TABLE IF NOT EXISTS sku_analysis_cache (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(255) NOT NULL UNIQUE,
  
  -- Precios históricos
  precio_promedio_30d DECIMAL(10,2) DEFAULT 0,
  precio_promedio_90d DECIMAL(10,2) DEFAULT 0,
  total_ventas_30d INTEGER DEFAULT 0,
  total_ventas_90d INTEGER DEFAULT 0,
  
  -- Cálculos de venta diaria
  venta_diaria DECIMAL(8,4) DEFAULT 0,
  unidades_vendidas_periodo INTEGER DEFAULT 0,
  dias_periodo INTEGER DEFAULT 0,
  fecha_inicio_analisis TIMESTAMP WITH TIME ZONE,
  fecha_fin_analisis TIMESTAMP WITH TIME ZONE,
  
  -- Stock y reposición (usando config por defecto)
  stock_objetivo_30d INTEGER DEFAULT 0,
  stock_objetivo_60d INTEGER DEFAULT 0,
  stock_objetivo_90d INTEGER DEFAULT 0,
  cantidad_sugerida_30d INTEGER DEFAULT 0,
  cantidad_sugerida_60d INTEGER DEFAULT 0, 
  cantidad_sugerida_90d INTEGER DEFAULT 0,
  
  -- Metadatos
  stock_actual_cache INTEGER DEFAULT 0, -- Para calcular cantidad sugerida
  tiene_historial_compras BOOLEAN DEFAULT FALSE,
  tiene_historial_ventas BOOLEAN DEFAULT FALSE,
  calculo_confiable BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sku_analysis_cache_sku ON sku_analysis_cache(sku);
CREATE INDEX IF NOT EXISTS idx_sku_analysis_cache_updated ON sku_analysis_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_sku_analysis_cache_venta_diaria ON sku_analysis_cache(venta_diaria);
CREATE INDEX IF NOT EXISTS idx_sku_analysis_cache_confiable ON sku_analysis_cache(calculo_confiable);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_sku_analysis_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_sku_analysis_cache_updated_at ON sku_analysis_cache;
CREATE TRIGGER trigger_sku_analysis_cache_updated_at
  BEFORE UPDATE ON sku_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_sku_analysis_cache_updated_at();

-- Comentarios
COMMENT ON TABLE sku_analysis_cache IS 'Cache completo de análisis pre-calculados por SKU incluyendo precios, venta diaria, stock objetivo y cantidad sugerida';
COMMENT ON COLUMN sku_analysis_cache.precio_promedio_30d IS 'Precio promedio ponderado de últimos 30 días';
COMMENT ON COLUMN sku_analysis_cache.precio_promedio_90d IS 'Precio promedio ponderado de últimos 90 días';
COMMENT ON COLUMN sku_analysis_cache.venta_diaria IS 'Unidades vendidas por día calculadas según período de análisis';
COMMENT ON COLUMN sku_analysis_cache.stock_objetivo_30d IS 'Stock objetivo para 30 días de cobertura';
COMMENT ON COLUMN sku_analysis_cache.cantidad_sugerida_30d IS 'Cantidad a reponer para 30 días (stock_objetivo - stock_actual)';
COMMENT ON COLUMN sku_analysis_cache.calculo_confiable IS 'Indica si el cálculo tiene suficientes datos históricos para ser confiable';