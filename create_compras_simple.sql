-- Paso 1: Crear tabla básica
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
