-- Crear tabla para datos de stock
CREATE TABLE IF NOT EXISTS public.stock_actual (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    stock_bodega_central NUMERIC DEFAULT 0,
    stock_full_tlt_meli NUMERIC DEFAULT 0,
    stock_full_lmc_meli NUMERIC DEFAULT 0,
    stock_total NUMERIC DEFAULT 0,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear índice para búsquedas rápidas por SKU
CREATE INDEX IF NOT EXISTS idx_stock_actual_sku ON public.stock_actual(sku);

-- Habilitar Row Level Security
ALTER TABLE public.stock_actual ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (permitir lectura para todos los usuarios autenticados)
CREATE POLICY "Allow public read access" ON public.stock_actual
    FOR SELECT
    TO public
    USING (true);

-- Crear política para service_role (permite todo)
CREATE POLICY "Allow service_role all access" ON public.stock_actual
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.stock_actual IS 'Inventario actual de productos';
COMMENT ON COLUMN public.stock_actual.sku IS 'Código único del producto';
COMMENT ON COLUMN public.stock_actual.stock_bodega_central IS 'Stock en bodega central TLT';
COMMENT ON COLUMN public.stock_actual.stock_full_tlt_meli IS 'Stock full en Mercado Libre TLT';
COMMENT ON COLUMN public.stock_actual.stock_full_lmc_meli IS 'Stock full en Mercado Libre LMC';
COMMENT ON COLUMN public.stock_actual.stock_total IS 'Stock total (suma de todos los stocks)';
