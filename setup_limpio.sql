-- ================================================
-- SCRIPT DE SETUP LIMPIO - EJECUTAR COMPLETO
-- ================================================
-- Este script borra todo y lo crea desde cero
-- Ejecutar TODO de una vez en Supabase SQL Editor

-- 1. BORRAR TODO (si existe)
DROP TABLE IF EXISTS alertas_inventario CASCADE;
DROP TABLE IF EXISTS metricas_modelo CASCADE;
DROP TABLE IF EXISTS predicciones CASCADE;
DROP TABLE IF EXISTS skus_desconsiderar CASCADE;
DROP TABLE IF EXISTS packs CASCADE;
DROP TABLE IF EXISTS compras_historicas CASCADE;
DROP TABLE IF EXISTS transito_china CASCADE;
DROP TABLE IF EXISTS stock_actual CASCADE;
DROP TABLE IF EXISTS ventas_historicas CASCADE;

-- Borrar índices sueltos (si quedaron huérfanos)
DROP INDEX IF EXISTS idx_ventas_sku_fecha;
DROP INDEX IF EXISTS idx_predicciones_sku;
DROP INDEX IF EXISTS idx_predicciones_fecha_calculo;
DROP INDEX IF EXISTS idx_alertas_sku;
DROP INDEX IF EXISTS idx_stock_sku;

-- 2. CREAR TABLAS

-- Tabla: ventas_historicas
CREATE TABLE ventas_historicas (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  fecha DATE NOT NULL,
  unidades NUMERIC NOT NULL,
  precio NUMERIC,
  empresa TEXT,
  canal TEXT,
  mlc TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_venta UNIQUE (sku, fecha, canal)
);

-- Tabla: stock_actual
CREATE TABLE stock_actual (
  sku TEXT PRIMARY KEY,
  descripcion TEXT,
  bodega_c NUMERIC DEFAULT 0,
  bodega_d NUMERIC DEFAULT 0,
  bodega_e NUMERIC DEFAULT 0,
  bodega_f NUMERIC DEFAULT 0,
  bodega_h NUMERIC DEFAULT 0,
  bodega_j NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: transito_china
CREATE TABLE transito_china (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  unidades NUMERIC NOT NULL,
  estado TEXT DEFAULT 'en_transito',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: compras_historicas
CREATE TABLE compras_historicas (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  fecha_compra DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: packs
CREATE TABLE packs (
  id SERIAL PRIMARY KEY,
  sku_pack TEXT NOT NULL,
  sku_componente TEXT NOT NULL,
  cantidad NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: skus_desconsiderar
CREATE TABLE skus_desconsiderar (
  sku TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: predicciones
CREATE TABLE predicciones (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  fecha_calculo DATE DEFAULT CURRENT_DATE,
  venta_diaria_p50 NUMERIC,
  venta_diaria_p75 NUMERIC,
  venta_diaria_p90 NUMERIC,
  stock_actual NUMERIC,
  dias_stock_actual NUMERIC,
  stock_seguridad NUMERIC,
  punto_reorden NUMERIC,
  sugerencia_reposicion NUMERIC,
  valor_total_sugerencia NUMERIC,
  clasificacion_abc TEXT,
  clasificacion_xyz TEXT,
  tendencia TEXT,
  tasa_crecimiento_mensual NUMERIC,
  modelo_usado TEXT,
  mape_backtesting NUMERIC,
  alertas TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: alertas_inventario
CREATE TABLE alertas_inventario (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  tipo_alerta TEXT NOT NULL,
  severidad TEXT,
  mensaje TEXT,
  fecha_alerta DATE DEFAULT CURRENT_DATE,
  resuelta BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: metricas_modelo
CREATE TABLE metricas_modelo (
  id SERIAL PRIMARY KEY,
  fecha_ejecucion DATE DEFAULT CURRENT_DATE,
  total_skus_procesados INTEGER,
  mape_promedio NUMERIC,
  mae_promedio NUMERIC,
  rmse_promedio NUMERIC,
  skus_clase_a INTEGER,
  skus_clase_b INTEGER,
  skus_clase_c INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREAR ÍNDICES

-- Índices para ventas_historicas
CREATE INDEX idx_ventas_sku_fecha ON ventas_historicas(sku, fecha DESC);
CREATE INDEX idx_ventas_fecha ON ventas_historicas(fecha DESC);
CREATE INDEX idx_ventas_canal ON ventas_historicas(canal);

-- Índices para predicciones
CREATE INDEX idx_predicciones_sku ON predicciones(sku);
CREATE INDEX idx_predicciones_fecha_calculo ON predicciones(fecha_calculo DESC);
CREATE INDEX idx_predicciones_abc ON predicciones(clasificacion_abc);

-- Índices para alertas
CREATE INDEX idx_alertas_sku ON alertas_inventario(sku);
CREATE INDEX idx_alertas_fecha ON alertas_inventario(fecha_alerta DESC);
CREATE INDEX idx_alertas_resuelta ON alertas_inventario(resuelta);

-- Índice para stock
CREATE INDEX idx_stock_sku ON stock_actual(sku);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)

ALTER TABLE ventas_historicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE transito_china ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_historicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus_desconsiderar ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_modelo ENABLE ROW LEVEL SECURITY;

-- 5. CREAR POLÍTICAS RLS (Permitir lectura pública, escritura con service_role)

-- ventas_historicas
CREATE POLICY "Permitir lectura pública" ON ventas_historicas FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON ventas_historicas FOR INSERT WITH CHECK (true);

-- stock_actual
CREATE POLICY "Permitir lectura pública" ON stock_actual FOR SELECT USING (true);
CREATE POLICY "Permitir upsert con service_role" ON stock_actual FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update con service_role" ON stock_actual FOR UPDATE USING (true);

-- transito_china
CREATE POLICY "Permitir lectura pública" ON transito_china FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON transito_china FOR INSERT WITH CHECK (true);

-- compras_historicas
CREATE POLICY "Permitir lectura pública" ON compras_historicas FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON compras_historicas FOR INSERT WITH CHECK (true);

-- packs
CREATE POLICY "Permitir lectura pública" ON packs FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON packs FOR INSERT WITH CHECK (true);

-- skus_desconsiderar
CREATE POLICY "Permitir lectura pública" ON skus_desconsiderar FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON skus_desconsiderar FOR INSERT WITH CHECK (true);

-- predicciones
CREATE POLICY "Permitir lectura pública" ON predicciones FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON predicciones FOR INSERT WITH CHECK (true);

-- alertas_inventario
CREATE POLICY "Permitir lectura pública" ON alertas_inventario FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON alertas_inventario FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update con service_role" ON alertas_inventario FOR UPDATE USING (true);

-- metricas_modelo
CREATE POLICY "Permitir lectura pública" ON metricas_modelo FOR SELECT USING (true);
CREATE POLICY "Permitir inserción con service_role" ON metricas_modelo FOR INSERT WITH CHECK (true);

-- 6. VERIFICACIÓN FINAL

SELECT
  'Tablas creadas correctamente' AS status,
  COUNT(*) AS total_tablas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'ventas_historicas',
    'stock_actual',
    'transito_china',
    'compras_historicas',
    'packs',
    'skus_desconsiderar',
    'predicciones',
    'alertas_inventario',
    'metricas_modelo'
  );

-- ================================================
-- FIN DEL SCRIPT
-- ================================================
-- Si ves "total_tablas = 9", todo está perfecto!
