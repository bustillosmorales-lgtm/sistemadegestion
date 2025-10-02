-- Script manual para crear tabla dashboard_analysis_cache
-- Ejecutar directamente en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.dashboard_analysis_cache (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(255) NOT NULL UNIQUE,
    descripcion TEXT,
    status VARCHAR(100),
    stock_actual INTEGER DEFAULT 0,
    venta_diaria DECIMAL(8,4) DEFAULT 0,
    venta_diaria_calculada BOOLEAN DEFAULT FALSE,
    en_transito INTEGER DEFAULT 0,
    cantidad_sugerida INTEGER DEFAULT 0,
    stock_objetivo INTEGER DEFAULT 0,
    stock_proyectado_llegada INTEGER DEFAULT 0,
    consumo_durante_lead_time INTEGER DEFAULT 0,
    lead_time_dias INTEGER DEFAULT 90,
    impacto_economico JSONB DEFAULT '{}',
    config_usado JSONB DEFAULT '{}',
    essential BOOLEAN DEFAULT TRUE,
    from_cache BOOLEAN DEFAULT TRUE,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_sku ON public.dashboard_analysis_cache(sku);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON public.dashboard_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_status ON public.dashboard_analysis_cache(status);

-- Función de limpieza
CREATE OR REPLACE FUNCTION public.clean_expired_dashboard_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.dashboard_analysis_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_dashboard_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_dashboard_cache_updated_at ON public.dashboard_analysis_cache;
CREATE TRIGGER trigger_dashboard_cache_updated_at
    BEFORE UPDATE ON public.dashboard_analysis_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_dashboard_cache_updated_at();

-- Política RLS (Row Level Security)
ALTER TABLE public.dashboard_analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.dashboard_analysis_cache
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.dashboard_analysis_cache
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.dashboard_analysis_cache
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users only" ON public.dashboard_analysis_cache
    FOR DELETE USING (true);