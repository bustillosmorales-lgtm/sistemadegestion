-- Script para agregar columnas faltantes a las tablas
-- Ejecutar en Supabase SQL Editor

-- ============================================================
-- 1. AGREGAR COLUMNAS A predicciones
-- ============================================================

ALTER TABLE predicciones
ADD COLUMN IF NOT EXISTS venta_diaria_promedio NUMERIC,
ADD COLUMN IF NOT EXISTS desviacion_estandar NUMERIC,
ADD COLUMN IF NOT EXISTS coeficiente_variacion NUMERIC,
ADD COLUMN IF NOT EXISTS stock_optimo NUMERIC,
ADD COLUMN IF NOT EXISTS transito_china NUMERIC,
ADD COLUMN IF NOT EXISTS sugerencia_reposicion_p75 NUMERIC,
ADD COLUMN IF NOT EXISTS sugerencia_reposicion_p90 NUMERIC,
ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC,
ADD COLUMN IF NOT EXISTS periodo_inicio TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS periodo_fin TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dias_periodo INTEGER,
ADD COLUMN IF NOT EXISTS unidades_totales_periodo NUMERIC,
ADD COLUMN IF NOT EXISTS es_demanda_intermitente BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- ============================================================
-- 2. AGREGAR COLUMNAS A metricas_modelo
-- ============================================================

ALTER TABLE metricas_modelo
ADD COLUMN IF NOT EXISTS fecha_calculo DATE,
ADD COLUMN IF NOT EXISTS total_skus INTEGER,
ADD COLUMN IF NOT EXISTS mape NUMERIC,
ADD COLUMN IF NOT EXISTS mae NUMERIC,
ADD COLUMN IF NOT EXISTS rmse NUMERIC,
ADD COLUMN IF NOT EXISTS bias NUMERIC,
ADD COLUMN IF NOT EXISTS mape_abc_a NUMERIC,
ADD COLUMN IF NOT EXISTS mape_abc_b NUMERIC,
ADD COLUMN IF NOT EXISTS mape_abc_c NUMERIC,
ADD COLUMN IF NOT EXISTS skus_con_prediccion INTEGER,
ADD COLUMN IF NOT EXISTS skus_sin_datos INTEGER,
ADD COLUMN IF NOT EXISTS tiempo_ejecucion_segundos NUMERIC;

-- ============================================================
-- 3. AGREGAR COLUMNAS A alertas_inventario
-- ============================================================

ALTER TABLE alertas_inventario
ADD COLUMN IF NOT EXISTS valor_actual NUMERIC,
ADD COLUMN IF NOT EXISTS valor_esperado NUMERIC,
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activa';

-- ============================================================
-- 4. VERIFICAR COLUMNAS AGREGADAS
-- ============================================================

-- Verificar predicciones
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'predicciones'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar metricas_modelo
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'metricas_modelo'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar alertas_inventario
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'alertas_inventario'
  AND table_schema = 'public'
ORDER BY ordinal_position;
