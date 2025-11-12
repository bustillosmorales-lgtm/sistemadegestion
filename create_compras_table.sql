-- Crear tabla para datos de compras/reposiciones
CREATE TABLE IF NOT EXISTS public.compras (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    fecha DATE NOT NULL,
    cantidad NUMERIC NOT NULL,
    contenedor TEXT,
    precio_unitario NUMERIC,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_compras_sku ON public.compras(sku);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON public.compras(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_sku_fecha ON public.compras(sku, fecha);

-- Habilitar Row Level Security
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- Crear política para lectura pública
CREATE POLICY "Allow public read access" ON public.compras
    FOR SELECT
    TO public
    USING (true);

-- Crear política para service_role (permite todo)
CREATE POLICY "Allow service_role all access" ON public.compras
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.compras IS 'Historial de compras y reposiciones de inventario';
COMMENT ON COLUMN public.compras.sku IS 'Código del producto';
COMMENT ON COLUMN public.compras.fecha IS 'Fecha de llegada/recepción';
COMMENT ON COLUMN public.compras.cantidad IS 'Unidades compradas';
COMMENT ON COLUMN public.compras.contenedor IS 'Identificador del contenedor';
