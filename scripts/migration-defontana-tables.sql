-- Migración: Tablas para Integración con Defontana
-- Ejecutar este SQL en Supabase SQL Editor

-- 1. Tabla de configuración de integraciones
CREATE TABLE IF NOT EXISTS integraciones_config (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) UNIQUE NOT NULL, -- 'defontana', 'bsale', etc.
  config JSONB NOT NULL, -- Almacena apiKey, companyId, etc.
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE integraciones_config IS 'Configuración de integraciones externas (Defontana, Bsale, etc.)';
COMMENT ON COLUMN integraciones_config.tipo IS 'Tipo de integración (defontana, bsale, etc.)';
COMMENT ON COLUMN integraciones_config.config IS 'Configuración en JSON (credenciales, parámetros)';

-- 2. Tabla de logs de sincronización
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  integration VARCHAR(50) NOT NULL, -- 'defontana', 'bsale', etc.
  sync_type VARCHAR(50) NOT NULL, -- 'sales', 'products', 'customers', etc.
  records_imported INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
  error_message TEXT,
  metadata JSONB, -- Información adicional sobre la sincronización
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE sync_logs IS 'Registro de sincronizaciones con sistemas externos';
COMMENT ON COLUMN sync_logs.integration IS 'Sistema externo (defontana, bsale, etc.)';
COMMENT ON COLUMN sync_logs.sync_type IS 'Tipo de datos sincronizados';
COMMENT ON COLUMN sync_logs.records_imported IS 'Cantidad de registros importados';

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON sync_logs(integration);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integraciones_config_tipo ON integraciones_config(tipo);

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Tablas para integración con Defontana creadas exitosamente';
  RAISE NOTICE 'Tablas: integraciones_config, sync_logs';
END $$;
