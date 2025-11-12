-- Agregar columna descripcion a la tabla predicciones
ALTER TABLE public.predicciones
ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Comentario
COMMENT ON COLUMN public.predicciones.descripcion IS 'Descripción del producto/SKU';
