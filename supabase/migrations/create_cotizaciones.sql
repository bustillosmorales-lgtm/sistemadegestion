-- Crear tabla de cotizaciones
CREATE TABLE IF NOT EXISTS cotizaciones (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  descripcion TEXT,
  cantidad_cotizar INTEGER NOT NULL CHECK (cantidad_cotizar > 0),
  precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) GENERATED ALWAYS AS (cantidad_cotizar * precio_unitario) STORED,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'recibida')),
  fecha_cotizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cotizaciones_sku ON cotizaciones(sku);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON cotizaciones(fecha_cotizacion DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden leer todas las cotizaciones
CREATE POLICY "Usuarios autenticados pueden leer cotizaciones"
ON cotizaciones FOR SELECT
TO authenticated
USING (true);

-- Política: usuarios autenticados pueden insertar cotizaciones
CREATE POLICY "Usuarios autenticados pueden crear cotizaciones"
ON cotizaciones FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política: usuarios autenticados pueden actualizar cotizaciones
CREATE POLICY "Usuarios autenticados pueden actualizar cotizaciones"
ON cotizaciones FOR UPDATE
TO authenticated
USING (true);

-- Política: usuarios autenticados pueden eliminar cotizaciones
CREATE POLICY "Usuarios autenticados pueden eliminar cotizaciones"
ON cotizaciones FOR DELETE
TO authenticated
USING (true);

-- Trigger para actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION update_cotizaciones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cotizaciones_timestamp
BEFORE UPDATE ON cotizaciones
FOR EACH ROW
EXECUTE FUNCTION update_cotizaciones_timestamp();

-- Comentarios
COMMENT ON TABLE cotizaciones IS 'Tabla de cotizaciones de productos para compra';
COMMENT ON COLUMN cotizaciones.estado IS 'Estados: pendiente, aprobada, rechazada, recibida';
