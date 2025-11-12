-- Tabla de configuración del sistema de forecasting
CREATE TABLE IF NOT EXISTS public.configuracion_sistema (
    id BIGSERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor NUMERIC NOT NULL,
    descripcion TEXT NOT NULL,
    unidad TEXT,
    valor_minimo NUMERIC,
    valor_maximo NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar valores por defecto
INSERT INTO public.configuracion_sistema (clave, valor, descripcion, unidad, valor_minimo, valor_maximo)
VALUES
    ('dias_stock_deseado', 90, 'Días de stock deseado para mantener en inventario', 'días', 30, 180),
    ('dias_transito', 120, 'Tiempo de tránsito desde China a bodega', 'días', 30, 180),
    ('nivel_servicio', 0.95, 'Nivel de servicio objetivo (95% = mantener stock el 95% del tiempo)', '%', 0.80, 0.99),
    ('umbral_intermitencia', 0.5, 'Umbral para detectar demanda intermitente (% de días sin venta)', '%', 0.3, 0.8),
    ('alpha_ewma', 0.3, 'Factor de ponderación temporal EWMA (mayor = más peso a datos recientes)', 'factor', 0.1, 0.5),
    ('umbral_abc_a', 0.8, 'Umbral acumulado para clasificación ABC - Categoría A (top % del valor)', '%', 0.6, 0.9),
    ('umbral_abc_b', 0.95, 'Umbral acumulado para clasificación ABC - Categoría B', '%', 0.85, 0.98),
    ('umbral_xyz_x', 0.5, 'Umbral de CV para clasificación XYZ - Categoría X (baja variabilidad)', 'CV', 0.3, 0.7),
    ('umbral_xyz_y', 1.0, 'Umbral de CV para clasificación XYZ - Categoría Y (media variabilidad)', 'CV', 0.7, 1.5),
    ('dias_historico', 180, 'Días de historial de ventas a considerar para predicciones', 'días', 90, 365),
    ('iqr_multiplicador', 1.5, 'Multiplicador IQR para detección de outliers', 'factor', 1.0, 3.0)
ON CONFLICT (clave) DO NOTHING;

-- Índice para búsqueda rápida por clave
CREATE INDEX IF NOT EXISTS idx_configuracion_clave ON public.configuracion_sistema(clave);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_configuracion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_configuracion_updated_at
    BEFORE UPDATE ON public.configuracion_sistema
    FOR EACH ROW
    EXECUTE FUNCTION update_configuracion_updated_at();

-- RLS: Permitir lectura a todos los usuarios autenticados
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all users" ON public.configuracion_sistema
    FOR SELECT USING (true);

-- Solo admin puede actualizar (ajustar según tu sistema de permisos)
CREATE POLICY "Allow update access to authenticated users" ON public.configuracion_sistema
    FOR UPDATE USING (true);
