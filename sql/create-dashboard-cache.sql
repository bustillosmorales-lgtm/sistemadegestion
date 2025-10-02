-- Tabla para cachear resultados completos del análisis de dashboard
CREATE TABLE IF NOT EXISTS dashboard_analysis_cache (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(255) NOT NULL UNIQUE,

  -- Datos básicos del producto
  descripcion TEXT,
  status VARCHAR(100),
  stock_actual INTEGER DEFAULT 0,

  -- Cálculos de venta
  venta_diaria DECIMAL(8,4) DEFAULT 0,
  venta_diaria_calculada BOOLEAN DEFAULT FALSE,
  en_transito INTEGER DEFAULT 0,

  -- Proyecciones y sugerencias
  cantidad_sugerida INTEGER DEFAULT 0,
  stock_objetivo INTEGER DEFAULT 0,
  stock_proyectado_llegada INTEGER DEFAULT 0,
  consumo_durante_lead_time INTEGER DEFAULT 0,
  lead_time_dias INTEGER DEFAULT 90,

  -- Impacto económico (JSON para flexibilidad)
  impacto_economico JSONB DEFAULT '{}',

  -- Metadatos de cálculo
  config_usado JSONB DEFAULT '{}', -- Configuración usada en el cálculo
  essential BOOLEAN DEFAULT TRUE,
  from_cache BOOLEAN DEFAULT TRUE,

  -- Timestamps y control
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'), -- Cache válido por 1 hora
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance óptima
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_sku ON dashboard_analysis_cache(sku);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON dashboard_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_status ON dashboard_analysis_cache(status);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_valor_total ON dashboard_analysis_cache USING GIN ((impacto_economico->'valorTotal'));
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_prioridad ON dashboard_analysis_cache USING GIN ((impacto_economico->'prioridad'));

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_dashboard_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_dashboard_cache_updated_at ON dashboard_analysis_cache;
CREATE TRIGGER trigger_dashboard_cache_updated_at
  BEFORE UPDATE ON dashboard_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_cache_updated_at();

-- Función para limpiar cache expirado
CREATE OR REPLACE FUNCTION clean_expired_dashboard_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM dashboard_analysis_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Comentarios
COMMENT ON TABLE dashboard_analysis_cache IS 'Cache completo de resultados del análisis de dashboard con expiración automática';
COMMENT ON COLUMN dashboard_analysis_cache.impacto_economico IS 'JSON con valorTotal, precioPromedioReal, prioridad, etc.';
COMMENT ON COLUMN dashboard_analysis_cache.config_usado IS 'Configuración utilizada para el cálculo (stockSaludableMinDias, tiempoEntrega, etc.)';
COMMENT ON COLUMN dashboard_analysis_cache.expires_at IS 'Timestamp de expiración del cache - se recalcula automáticamente';