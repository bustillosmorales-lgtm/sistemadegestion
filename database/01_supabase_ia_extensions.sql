-- ========================================
-- EXTENSIONES SUPABASE PARA SISTEMA IA
-- Ejecutar en Supabase SQL Editor
-- ========================================

-- 1. EXTENSIÓN TABLA PRODUCTS PARA IA
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sugerencia_reposicion_ia INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS confianza_prediccion_ia DECIMAL(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS logica_explicacion_ia JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS temporalidad_prediccion TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS alertas_temporales JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ultima_prediccion_ia TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. TABLA PREDICCIONES IA HISTÓRICO
CREATE TABLE IF NOT EXISTS ai_predictions (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    fecha_prediccion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cantidad_predicha INTEGER NOT NULL,
    confianza DECIMAL(3,2) NOT NULL,
    evento_objetivo TEXT, -- "cyberday_mayo_2025", "navidad_2024", etc
    temporalidad_target DATE NOT NULL,
    factores_aplicados JSONB NOT NULL,
    logica_detallada JSONB NOT NULL,
    resultado_real INTEGER DEFAULT NULL,
    precision_calculada DECIMAL(5,2) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT ai_predictions_sku_fkey FOREIGN KEY (sku) 
        REFERENCES products(sku) ON DELETE CASCADE
);

-- 3. TABLA EVENTOS DE STOCK (DIAGNÓSTICOS)
CREATE TABLE IF NOT EXISTS stock_events_analysis (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    evento_tipo TEXT CHECK (evento_tipo IN ('quiebre_stock', 'exceso_stock', 'alerta_temporal')),
    fecha_evento DATE NOT NULL,
    
    -- Contexto del evento
    stock_durante_evento INTEGER,
    dias_cobertura_durante INTEGER,
    venta_diaria_promedio DECIMAL(10,2),
    venta_maxima_periodo INTEGER,
    categoria_producto TEXT,
    
    -- Diagnóstico IA
    causa_principal TEXT,
    factores_contribuyentes JSONB,
    confianza_diagnostico DECIMAL(3,2),
    evidencia_detectada JSONB,
    patron_detectado BOOLEAN DEFAULT FALSE,
    recomendaciones_ia JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT stock_events_sku_fkey FOREIGN KEY (sku) 
        REFERENCES products(sku) ON DELETE CASCADE
);

-- 4. TABLA PATRONES ESTACIONALES CHILENOS
CREATE TABLE IF NOT EXISTS seasonal_patterns_chile (
    id BIGSERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    evento_tipo TEXT NOT NULL, -- 'navidad', 'cyberday', 'fiestas_patrias', etc
    periodo_inicio TEXT NOT NULL, -- 'diciembre', 'mayo', 'septiembre'
    periodo_fin TEXT,
    factor_multiplicador DECIMAL(5,2) NOT NULL,
    confianza DECIMAL(3,2) NOT NULL,
    datos_historicos_cantidad INTEGER NOT NULL,
    canal_principal TEXT DEFAULT 'mercadolibre',
    notas TEXT,
    activo BOOLEAN DEFAULT TRUE,
    ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(categoria, evento_tipo, periodo_inicio)
);

-- 5. TABLA FEEDBACK HUMANO PARA IA
CREATE TABLE IF NOT EXISTS ai_human_feedback (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL,
    sku TEXT NOT NULL,
    feedback_tipo TEXT CHECK (feedback_tipo IN ('correccion', 'validacion', 'rechazo', 'mejora')),
    cantidad_original INTEGER NOT NULL,
    cantidad_corregida INTEGER,
    motivo_feedback TEXT,
    usuario_email TEXT,
    confianza_usuario INTEGER CHECK (confianza_usuario BETWEEN 1 AND 10),
    notas_adicionales TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT ai_feedback_prediction_fkey FOREIGN KEY (prediction_id) 
        REFERENCES ai_predictions(id) ON DELETE CASCADE
);

-- 6. TABLA ALERTAS TEMPORALES ACTIVAS
CREATE TABLE IF NOT EXISTS temporal_alerts (
    id BIGSERIAL PRIMARY KEY,
    evento_nombre TEXT NOT NULL, -- "CyberDay Mayo 2025"
    evento_tipo TEXT NOT NULL,   -- "cyberday", "navidad", "fiestas_patrias"
    fecha_evento DATE NOT NULL,
    fecha_limite_orden DATE NOT NULL,
    fecha_alerta_30d DATE NOT NULL,
    fecha_alerta_14d DATE NOT NULL,
    fecha_alerta_3d DATE NOT NULL,
    
    productos_afectados INTEGER DEFAULT 0,
    valor_riesgo_usd DECIMAL(12,2) DEFAULT 0,
    status_alerta TEXT CHECK (status_alerta IN ('planificacion', 'urgente', 'critico', 'vencido')) DEFAULT 'planificacion',
    
    configuracion_utilizada JSONB, -- Config que se usó para calcular fechas
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABLA CONVERSACIONES CHATBOT
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    sku TEXT,
    usuario_email TEXT,
    
    mensaje_usuario TEXT NOT NULL,
    respuesta_ia TEXT NOT NULL,
    contexto_conversacion JSONB,
    intent_detectado TEXT,
    confianza_respuesta DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chat_conversations_sku_fkey FOREIGN KEY (sku) 
        REFERENCES products(sku) ON DELETE SET NULL
);

-- 8. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_ai_predictions_sku_fecha ON ai_predictions(sku, fecha_prediccion DESC);
CREATE INDEX IF NOT EXISTS idx_stock_events_sku_fecha ON stock_events_analysis(sku, fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_seasonal_patterns_categoria ON seasonal_patterns_chile(categoria, evento_tipo);
CREATE INDEX IF NOT EXISTS idx_temporal_alerts_fecha ON temporal_alerts(fecha_evento, activo);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session ON ai_chat_conversations(session_id, created_at DESC);

-- 9. DATOS INICIALES - PATRONES ESTACIONALES CHILE
INSERT INTO seasonal_patterns_chile (categoria, evento_tipo, periodo_inicio, periodo_fin, factor_multiplicador, confianza, datos_historicos_cantidad, notas) VALUES

-- NAVIDAD (Diciembre)
('Juegos y Juguetes', 'navidad', 'diciembre', 'diciembre', 3.50, 0.95, 180, 'Pico máximo diciembre, inicio noviembre'),
('Hogar y Muebles', 'navidad', 'diciembre', 'diciembre', 2.20, 0.85, 150, 'Decoración navideña, regalos hogar'),
('Electrónicos', 'navidad', 'diciembre', 'diciembre', 2.80, 0.90, 200, 'Regalos tecnológicos peak navidad'),
('Deportes y Fitness', 'navidad', 'diciembre', 'enero', 1.60, 0.75, 120, 'Propósitos año nuevo'),

-- FIESTAS PATRIAS (Septiembre)
('Hogar y Muebles', 'fiestas_patrias', 'septiembre', 'septiembre', 2.80, 0.92, 160, 'Asados, decoración patriótica'),
('Jardín', 'fiestas_patrias', 'agosto', 'septiembre', 2.40, 0.88, 100, 'Preparación asados, jardín'),
('Vehículos', 'fiestas_patrias', 'septiembre', 'septiembre', 1.40, 0.70, 80, 'Viajes fiestas patrias'),

-- DÍA DEL NIÑO (Agosto)
('Juegos y Juguetes', 'dia_nino', 'agosto', 'agosto', 4.20, 0.94, 200, 'Peak máximo año para juguetes'),
('Deportes y Fitness', 'dia_nino', 'agosto', 'agosto', 1.80, 0.82, 90, 'Deportes infantiles'),

-- DÍA DE LA MADRE (Mayo)
('Belleza y Cuidado Personal', 'dia_madre', 'mayo', 'mayo', 2.60, 0.88, 110, 'Cosméticos, perfumes peak mayo'),
('Joyas', 'dia_madre', 'mayo', 'mayo', 3.80, 0.90, 95, 'Joyas regalo día madre'),
('Hogar y Muebles', 'dia_madre', 'mayo', 'mayo', 1.50, 0.75, 85, 'Regalos decoración hogar'),

-- DÍA DEL PADRE (Junio)  
('Vehículos', 'dia_padre', 'junio', 'junio', 1.70, 0.78, 70, 'Accesorios auto, herramientas'),
('Deportes y Fitness', 'dia_padre', 'junio', 'junio', 1.90, 0.80, 85, 'Deportes, fitness regalos padre'),
('Electrónicos', 'dia_padre', 'junio', 'junio', 1.60, 0.75, 90, 'Tecnología regalo padre'),

-- CYBERDAY (Mayo, Septiembre, Noviembre)
('Electrónicos', 'cyberday', 'mayo', 'mayo', 6.50, 0.95, 250, 'Peak máximo electrónicos CyberDay'),
('Hogar y Muebles', 'cyberday', 'mayo', 'mayo', 3.20, 0.88, 180, 'Aprovechamiento descuentos hogar'),
('Deportes y Fitness', 'cyberday', 'mayo', 'mayo', 2.80, 0.85, 140, 'Equipamiento deportivo ofertas'),
('Belleza y Cuidado Personal', 'cyberday', 'mayo', 'mayo', 2.40, 0.82, 120, 'Cosméticos ofertas CyberDay'),

-- BLACK FRIDAY (Noviembre)
('Electrónicos', 'black_friday', 'noviembre', 'noviembre', 8.20, 0.96, 300, 'Peak absoluto año electrónicos'),
('Hogar y Muebles', 'black_friday', 'noviembre', 'noviembre', 4.50, 0.92, 220, 'Electrodomésticos, muebles peak'),
('Deportes y Fitness', 'black_friday', 'noviembre', 'noviembre', 3.60, 0.89, 180, 'Equipamiento deportivo peak'),
('Juegos y Juguetes', 'black_friday', 'noviembre', 'noviembre', 4.80, 0.91, 190, 'Anticipación navidad + ofertas'),

-- REGRESO A CLASES (Marzo)
('Electrónicos', 'regreso_clases', 'febrero', 'marzo', 2.10, 0.84, 140, 'Computadores, tablets estudiantes'),
('Deportes y Fitness', 'regreso_clases', 'febrero', 'marzo', 1.80, 0.78, 100, 'Deportes escolares'),

-- VERANO (Diciembre-Febrero)
('Deportes y Fitness', 'verano', 'diciembre', 'febrero', 2.50, 0.87, 160, 'Equipamiento deportivo verano'),
('Jardín', 'verano', 'noviembre', 'enero', 2.20, 0.83, 130, 'Piscinas, jardín, verano'),

-- VACACIONES INVIERNO (Julio)
('Juegos y Juguetes', 'vacaciones_invierno', 'julio', 'julio', 1.80, 0.76, 90, 'Entretenimiento vacaciones'),
('Electrónicos', 'vacaciones_invierno', 'julio', 'julio', 1.60, 0.72, 80, 'Entretenimiento digital vacaciones')

ON CONFLICT (categoria, evento_tipo, periodo_inicio) DO UPDATE SET
    factor_multiplicador = EXCLUDED.factor_multiplicador,
    confianza = EXCLUDED.confianza,
    ultima_actualizacion = NOW();

-- 10. ALERTAS TEMPORALES AUTOMÁTICAS 2025
INSERT INTO temporal_alerts (evento_nombre, evento_tipo, fecha_evento, fecha_limite_orden, fecha_alerta_30d, fecha_alerta_14d, fecha_alerta_3d, activo) VALUES

-- EVENTOS CRÍTICOS 2025
('Día de la Madre 2025', 'dia_madre', '2025-05-11', '2025-02-10', '2025-01-11', '2025-01-27', '2025-02-07', TRUE),
('CyberDay Mayo 2025', 'cyberday', '2025-05-15', '2025-02-14', '2025-01-15', '2025-01-31', '2025-02-11', TRUE),
('Día del Padre 2025', 'dia_padre', '2025-06-15', '2025-03-16', '2025-02-14', '2025-03-02', '2025-03-13', TRUE),
('Vacaciones Invierno 2025', 'vacaciones_invierno', '2025-07-15', '2025-04-15', '2025-03-16', '2025-04-01', '2025-04-12', TRUE),
('Día del Niño 2025', 'dia_nino', '2025-08-10', '2025-05-11', '2025-04-11', '2025-04-27', '2025-05-08', TRUE),
('Fiestas Patrias 2025', 'fiestas_patrias', '2025-09-18', '2025-06-19', '2025-05-20', '2025-06-05', '2025-06-16', TRUE),
('CyberDay Septiembre 2025', 'cyberday', '2025-09-22', '2025-06-23', '2025-05-24', '2025-06-09', '2025-06-20', TRUE),
('Black Friday 2025', 'black_friday', '2025-11-28', '2025-08-29', '2025-07-30', '2025-08-15', '2025-08-26', TRUE),
('CyberDay Noviembre 2025', 'cyberday', '2025-11-24', '2025-08-25', '2025-07-26', '2025-08-11', '2025-08-22', TRUE),
('Navidad 2025', 'navidad', '2025-12-25', '2025-09-25', '2025-08-26', '2025-09-11', '2025-09-22', TRUE),
('Regreso Clases 2026', 'regreso_clases', '2026-03-02', '2025-12-02', '2025-11-02', '2025-11-18', '2025-11-29', TRUE)

ON CONFLICT DO NOTHING;

-- 11. FUNCIONES ÚTILES
CREATE OR REPLACE FUNCTION get_active_alerts()
RETURNS TABLE(
    evento_nombre TEXT,
    dias_restantes INTEGER,
    status_alerta TEXT,
    productos_afectados INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.evento_nombre,
        (ta.fecha_limite_orden - CURRENT_DATE)::INTEGER as dias_restantes,
        ta.status_alerta,
        ta.productos_afectados
    FROM temporal_alerts ta
    WHERE ta.activo = TRUE
      AND ta.fecha_evento > CURRENT_DATE
    ORDER BY ta.fecha_limite_orden ASC;
END;
$$ LANGUAGE plpgsql;

-- 12. FUNCIÓN LIMPIEZA AUTOMÁTICA
CREATE OR REPLACE FUNCTION cleanup_old_ai_data()
RETURNS void AS $$
BEGIN
    -- Limpiar predicciones mayores a 1 año
    DELETE FROM ai_predictions WHERE fecha_prediccion < NOW() - INTERVAL '1 year';
    
    -- Limpiar eventos de stock mayores a 6 meses  
    DELETE FROM stock_events_analysis WHERE fecha_evento < CURRENT_DATE - INTERVAL '6 months';
    
    -- Limpiar conversaciones chatbot mayores a 3 meses
    DELETE FROM ai_chat_conversations WHERE created_at < NOW() - INTERVAL '3 months';
    
    -- Desactivar alertas temporales vencidas
    UPDATE temporal_alerts SET activo = FALSE WHERE fecha_evento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 13. COMENTARIOS PARA DOCUMENTACIÓN
COMMENT ON TABLE ai_predictions IS 'Histórico predicciones IA para tracking precisión y mejora continua';
COMMENT ON TABLE stock_events_analysis IS 'Diagnósticos automáticos de eventos de stock (quiebres, excesos)';
COMMENT ON TABLE seasonal_patterns_chile IS 'Patrones estacionales específicos mercado chileno y MercadoLibre';
COMMENT ON TABLE temporal_alerts IS 'Sistema alertas temporales eventos críticos con 30 días anticipación';
COMMENT ON TABLE ai_human_feedback IS 'Feedback humano para mejora continua algoritmos IA';
COMMENT ON TABLE ai_chat_conversations IS 'Histórico conversaciones chatbot IA para análisis y mejora';

-- ✅ SCRIPT COMPLETADO - BASE DE DATOS PREPARADA PARA SISTEMA IA COMPLETO