-- Agregar columnas de stock a la tabla existente
ALTER TABLE public.stock_actual
ADD COLUMN IF NOT EXISTS stock_bodega_central NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_full_tlt_meli NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_full_lmc_meli NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_total NUMERIC DEFAULT 0;

-- Crear índice para stock_total
CREATE INDEX IF NOT EXISTS idx_stock_actual_stock_total ON public.stock_actual(stock_total);

-- Comentarios
COMMENT ON COLUMN public.stock_actual.stock_bodega_central IS 'Stock en bodega central TLT';
COMMENT ON COLUMN public.stock_actual.stock_full_tlt_meli IS 'Stock full en Mercado Libre TLT';
COMMENT ON COLUMN public.stock_actual.stock_full_lmc_meli IS 'Stock full en Mercado Libre LMC';
COMMENT ON COLUMN public.stock_actual.stock_total IS 'Stock total (suma de todos los stocks)';
