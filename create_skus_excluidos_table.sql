-- Tabla para SKUs excluidos del análisis de forecasting
CREATE TABLE IF NOT EXISTS public.skus_excluidos (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    motivo TEXT,
    excluido_por TEXT, -- Usuario o sistema que lo excluyó
    fecha_exclusion TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas por SKU
CREATE INDEX IF NOT EXISTS idx_skus_excluidos_sku ON public.skus_excluidos(sku);

-- RLS policies (Row Level Security)
ALTER TABLE public.skus_excluidos ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir SELECT a todos (lectura pública)
CREATE POLICY "Permitir lectura pública de skus_excluidos"
    ON public.skus_excluidos
    FOR SELECT
    USING (true);

-- Policy: Permitir INSERT a todos (cualquiera puede excluir)
CREATE POLICY "Permitir inserción de skus_excluidos"
    ON public.skus_excluidos
    FOR INSERT
    WITH CHECK (true);

-- Policy: Permitir DELETE a todos (cualquiera puede reactivar)
CREATE POLICY "Permitir eliminación de skus_excluidos"
    ON public.skus_excluidos
    FOR DELETE
    USING (true);

-- Policy: Permitir UPDATE a todos
CREATE POLICY "Permitir actualización de skus_excluidos"
    ON public.skus_excluidos
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.skus_excluidos IS 'SKUs que deben ser excluidos del análisis de forecasting';
COMMENT ON COLUMN public.skus_excluidos.sku IS 'Código SKU del producto excluido';
COMMENT ON COLUMN public.skus_excluidos.descripcion IS 'Descripción del producto';
COMMENT ON COLUMN public.skus_excluidos.motivo IS 'Razón por la cual fue excluido';
COMMENT ON COLUMN public.skus_excluidos.excluido_por IS 'Usuario o sistema que realizó la exclusión';
