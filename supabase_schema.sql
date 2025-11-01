-- ============================================
-- ESQUEMA DE BASE DE DATOS PARA FORECASTING
-- Supabase (PostgreSQL)
-- ============================================

-- 1. TABLA: ventas_historicas
-- Almacena todas las ventas para forecasting
CREATE TABLE IF NOT EXISTS ventas_historicas (
    id BIGSERIAL PRIMARY KEY,
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

-- Índices para optimizar queries
CREATE INDEX idx_ventas_sku ON ventas_historicas(sku);
CREATE INDEX idx_ventas_fecha ON ventas_historicas(fecha);
CREATE INDEX idx_ventas_sku_fecha ON ventas_historicas(sku, fecha);

-- 2. TABLA: stock_actual
-- Stock actual por SKU y ubicación
CREATE TABLE IF NOT EXISTS stock_actual (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    descripcion TEXT,
    bodega_c NUMERIC DEFAULT 0,
    bodega_d NUMERIC DEFAULT 0,
    bodega_e NUMERIC DEFAULT 0,
    bodega_f NUMERIC DEFAULT 0,
    bodega_h NUMERIC DEFAULT 0,
    bodega_j NUMERIC DEFAULT 0,
    stock_total NUMERIC GENERATED ALWAYS AS (
        bodega_c + bodega_d + bodega_e + bodega_f + bodega_h + bodega_j
    ) STORED,
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_sku_stock UNIQUE (sku)
);

CREATE INDEX idx_stock_sku ON stock_actual(sku);

-- 3. TABLA: transito_china
-- Productos en tránsito desde China
CREATE TABLE IF NOT EXISTS transito_china (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    unidades NUMERIC NOT NULL,
    fecha_envio DATE,
    fecha_estimada_llegada DATE,
    estado TEXT DEFAULT 'en_transito',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transito_sku ON transito_china(sku);

-- 4. TABLA: compras_historicas
-- Histórico de compras para calcular lead time
CREATE TABLE IF NOT EXISTS compras_historicas (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    fecha_compra DATE NOT NULL,
    unidades NUMERIC,
    precio_unitario NUMERIC,
    fecha_llegada DATE,
    lead_time_dias INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN fecha_llegada IS NOT NULL
            THEN (fecha_llegada - fecha_compra)
            ELSE NULL
        END
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compras_sku ON compras_historicas(sku);
CREATE INDEX idx_compras_fecha ON compras_historicas(fecha_compra);

-- 5. TABLA: packs
-- Definición de packs y sus componentes
CREATE TABLE IF NOT EXISTS packs (
    id BIGSERIAL PRIMARY KEY,
    sku_pack TEXT NOT NULL,
    sku_componente TEXT NOT NULL,
    cantidad NUMERIC NOT NULL DEFAULT 1,
    CONSTRAINT unique_pack_componente UNIQUE (sku_pack, sku_componente)
);

CREATE INDEX idx_packs_pack ON packs(sku_pack);

-- 6. TABLA: skus_desconsiderar
-- SKUs a excluir del análisis
CREATE TABLE IF NOT EXISTS skus_desconsiderar (
    sku TEXT PRIMARY KEY,
    razon TEXT,
    fecha_exclusion TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: predicciones
-- Resultados de forecasting (calculados diariamente)
CREATE TABLE IF NOT EXISTS predicciones (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    fecha_calculo TIMESTAMPTZ DEFAULT NOW(),

    -- Métricas de venta
    venta_diaria_promedio NUMERIC,
    venta_diaria_p50 NUMERIC,  -- Mediana
    venta_diaria_p75 NUMERIC,  -- Percentil 75
    venta_diaria_p90 NUMERIC,  -- Percentil 90
    desviacion_estandar NUMERIC,
    coeficiente_variacion NUMERIC,

    -- Tendencia
    tendencia TEXT, -- 'creciente', 'estable', 'decreciente'
    tasa_crecimiento_mensual NUMERIC,

    -- Stock y reposición
    stock_actual NUMERIC,
    stock_optimo NUMERIC,
    stock_seguridad NUMERIC,
    dias_stock_actual NUMERIC,
    transito_china NUMERIC,

    -- Sugerencia final
    sugerencia_reposicion NUMERIC,
    sugerencia_reposicion_p75 NUMERIC,  -- Conservadora
    sugerencia_reposicion_p90 NUMERIC,  -- Pesimista

    -- Valorización
    precio_unitario NUMERIC,
    valor_total_sugerencia NUMERIC,

    -- Metadata
    periodo_inicio DATE,
    periodo_fin DATE,
    dias_periodo INTEGER,
    unidades_totales_periodo NUMERIC,

    -- Clasificación
    clasificacion_abc TEXT,  -- 'A', 'B', 'C'
    clasificacion_xyz TEXT,  -- 'X', 'Y', 'Z'
    es_demanda_intermitente BOOLEAN,

    -- Modelo usado
    modelo_usado TEXT,  -- 'prophet', 'arima', 'exponential_smoothing', 'croston'

    -- Observaciones y alertas
    observaciones TEXT,
    alertas TEXT[],

    CONSTRAINT unique_prediccion_sku_fecha UNIQUE (sku, fecha_calculo)
);

CREATE INDEX idx_predicciones_sku ON predicciones(sku);
CREATE INDEX idx_predicciones_fecha ON predicciones(fecha_calculo);
CREATE INDEX idx_predicciones_abc ON predicciones(clasificacion_abc);

-- 8. TABLA: metricas_modelo
-- Métricas de accuracy del modelo (backtesting)
CREATE TABLE IF NOT EXISTS metricas_modelo (
    id BIGSERIAL PRIMARY KEY,
    fecha_calculo DATE NOT NULL,

    -- Métricas globales
    total_skus INTEGER,
    mape NUMERIC,  -- Mean Absolute Percentage Error
    mae NUMERIC,   -- Mean Absolute Error
    rmse NUMERIC,  -- Root Mean Squared Error
    bias NUMERIC,  -- Sesgo promedio

    -- Métricas por segmento
    mape_abc_a NUMERIC,
    mape_abc_b NUMERIC,
    mape_abc_c NUMERIC,

    -- Cobertura
    skus_con_prediccion INTEGER,
    skus_sin_datos INTEGER,

    -- Tiempo de ejecución
    tiempo_ejecucion_segundos NUMERIC,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metricas_fecha ON metricas_modelo(fecha_calculo);

-- 9. TABLA: alertas_inventario
-- Alertas automáticas generadas por el sistema
CREATE TABLE IF NOT EXISTS alertas_inventario (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    tipo_alerta TEXT NOT NULL, -- 'stockout_inminente', 'exceso_stock', 'demanda_anomala'
    severidad TEXT NOT NULL, -- 'baja', 'media', 'alta', 'critica'
    mensaje TEXT,
    valor_actual NUMERIC,
    valor_esperado NUMERIC,
    fecha_alerta TIMESTAMPTZ DEFAULT NOW(),
    estado TEXT DEFAULT 'activa', -- 'activa', 'resuelta', 'ignorada'
    fecha_resolucion TIMESTAMPTZ
);

CREATE INDEX idx_alertas_sku ON alertas_inventario(sku);
CREATE INDEX idx_alertas_tipo ON alertas_inventario(tipo_alerta);
CREATE INDEX idx_alertas_estado ON alertas_inventario(estado);

-- 10. VISTA: resumen_inventario
-- Vista consolidada para dashboards
CREATE OR REPLACE VIEW resumen_inventario AS
SELECT
    p.sku,
    s.descripcion,
    p.venta_diaria_p50 as venta_diaria,
    p.stock_actual,
    p.transito_china,
    p.dias_stock_actual,
    p.sugerencia_reposicion,
    p.valor_total_sugerencia,
    p.clasificacion_abc,
    p.clasificacion_xyz,
    p.tendencia,
    p.alertas,
    p.fecha_calculo
FROM predicciones p
LEFT JOIN stock_actual s ON p.sku = s.sku
WHERE p.fecha_calculo = (
    SELECT MAX(fecha_calculo)
    FROM predicciones
    WHERE sku = p.sku
)
ORDER BY p.valor_total_sugerencia DESC;

-- 11. FUNCIÓN: calcular_service_level
-- Calcula el nivel de servicio histórico por SKU
CREATE OR REPLACE FUNCTION calcular_service_level(
    p_sku TEXT,
    p_dias_atras INTEGER DEFAULT 30
)
RETURNS NUMERIC AS $$
DECLARE
    v_dias_total INTEGER;
    v_dias_stockout INTEGER;
    v_service_level NUMERIC;
BEGIN
    -- Contar días totales
    SELECT COUNT(DISTINCT fecha)
    INTO v_dias_total
    FROM ventas_historicas
    WHERE sku = p_sku
    AND fecha >= CURRENT_DATE - p_dias_atras;

    -- Contar días con stock = 0 (aproximación)
    -- En producción, necesitarías histórico de stock diario
    v_dias_stockout := 0;

    -- Calcular service level
    IF v_dias_total > 0 THEN
        v_service_level := ((v_dias_total - v_dias_stockout)::NUMERIC / v_dias_total) * 100;
    ELSE
        v_service_level := NULL;
    END IF;

    RETURN v_service_level;
END;
$$ LANGUAGE plpgsql;

-- 12. ROW LEVEL SECURITY (Para multi-tenant SaaS)
-- Habilitar RLS en todas las tablas
ALTER TABLE ventas_historicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven sus propios datos
-- Nota: Necesitarás agregar columna 'tenant_id' para multi-tenant real
-- CREATE POLICY tenant_isolation ON ventas_historicas
-- FOR ALL USING (tenant_id = auth.uid());

-- 13. TRIGGERS: Actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_timestamp
BEFORE UPDATE ON stock_actual
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DATOS DE EJEMPLO (OPCIONAL - COMENTAR EN PRODUCCIÓN)
-- ============================================

-- Insertar algunos SKUs de ejemplo
-- INSERT INTO stock_actual (sku, descripcion, bodega_c, bodega_e)
-- VALUES
--     ('SKU001', 'Producto de Prueba 1', 100, 50),
--     ('SKU002', 'Producto de Prueba 2', 200, 150);

-- ============================================
-- GRANTS (Permisos)
-- ============================================

-- Dar permisos al usuario anon (para API pública)
GRANT SELECT ON resumen_inventario TO anon;
GRANT SELECT ON predicciones TO anon;

-- Dar permisos completos al service role (para backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE ventas_historicas IS 'Histórico completo de ventas para forecasting';
COMMENT ON TABLE predicciones IS 'Predicciones generadas por modelos ML (actualizadas diariamente)';
COMMENT ON TABLE metricas_modelo IS 'Métricas de accuracy del modelo de forecasting';
COMMENT ON COLUMN predicciones.venta_diaria_p90 IS 'Percentil 90 de venta diaria (escenario pesimista)';
COMMENT ON COLUMN predicciones.stock_seguridad IS 'Stock de seguridad calculado según variabilidad';
