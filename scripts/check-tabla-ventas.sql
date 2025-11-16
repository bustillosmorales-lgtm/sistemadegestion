-- Verificar si existe la tabla ventas
-- Ejecutar en Supabase SQL Editor

SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'ventas'
) as tabla_ventas_existe;

-- Si NO existe, crear la tabla:
CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  unidades INTEGER NOT NULL,
  precio_unitario DECIMAL(12,2) DEFAULT 0,
  fecha_venta DATE NOT NULL,
  origen VARCHAR(50) DEFAULT 'manual', -- 'manual', 'defontana', 'bsale', etc.
  metadata JSONB, -- Información adicional de la fuente
  created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_ventas_sku ON ventas(sku);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_origen ON ventas(origen);

-- Comentarios
COMMENT ON TABLE ventas IS 'Registro histórico de ventas de todas las fuentes';
COMMENT ON COLUMN ventas.sku IS 'Código del producto vendido';
COMMENT ON COLUMN ventas.origen IS 'Fuente de la venta (manual, defontana, bsale, etc.)';
COMMENT ON COLUMN ventas.metadata IS 'Información adicional en JSON (saleId, documentNumber, customerName)';

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Verificación completada. Si la tabla no existía, fue creada.';
END $$;
