CREATE TABLE public.compras (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    fecha DATE NOT NULL,
    cantidad NUMERIC NOT NULL,
    contenedor TEXT,
    precio_unitario NUMERIC,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);