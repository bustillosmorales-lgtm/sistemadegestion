-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Para proteger acceso a las tablas
-- ============================================

-- IMPORTANTE: Ejecutar esto en Supabase SQL Editor

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE ventas_historicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE transito_china ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_historicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus_desconsiderar ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_inventario ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas para usuarios autenticados

-- ventas_historicas: Solo lectura para autenticados
CREATE POLICY "ventas_read_authenticated" ON ventas_historicas
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "ventas_insert_authenticated" ON ventas_historicas
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ventas_update_authenticated" ON ventas_historicas
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "ventas_delete_authenticated" ON ventas_historicas
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- stock_actual: Todas las operaciones para autenticados
CREATE POLICY "stock_all_authenticated" ON stock_actual
    FOR ALL
    USING (auth.role() = 'authenticated');

-- transito_china: Todas las operaciones para autenticados
CREATE POLICY "transito_all_authenticated" ON transito_china
    FOR ALL
    USING (auth.role() = 'authenticated');

-- compras_historicas: Todas las operaciones para autenticados
CREATE POLICY "compras_all_authenticated" ON compras_historicas
    FOR ALL
    USING (auth.role() = 'authenticated');

-- packs: Todas las operaciones para autenticados
CREATE POLICY "packs_all_authenticated" ON packs
    FOR ALL
    USING (auth.role() = 'authenticated');

-- skus_desconsiderar: Todas las operaciones para autenticados
CREATE POLICY "skus_desconsiderar_all_authenticated" ON skus_desconsiderar
    FOR ALL
    USING (auth.role() = 'authenticated');

-- predicciones: Solo lectura para autenticados
CREATE POLICY "predicciones_read_authenticated" ON predicciones
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permitir INSERT/UPDATE/DELETE solo para service_role (GitHub Actions)
CREATE POLICY "predicciones_write_service" ON predicciones
    FOR ALL
    USING (auth.role() = 'service_role');

-- alertas_inventario: Solo lectura para autenticados
CREATE POLICY "alertas_read_authenticated" ON alertas_inventario
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permitir INSERT/UPDATE para service_role (GitHub Actions)
CREATE POLICY "alertas_write_service" ON alertas_inventario
    FOR ALL
    USING (auth.role() = 'service_role');

-- 3. Revocar acceso público (anon)
REVOKE ALL ON ventas_historicas FROM anon;
REVOKE ALL ON stock_actual FROM anon;
REVOKE ALL ON transito_china FROM anon;
REVOKE ALL ON compras_historicas FROM anon;
REVOKE ALL ON packs FROM anon;
REVOKE ALL ON skus_desconsiderar FROM anon;
REVOKE ALL ON predicciones FROM anon;
REVOKE ALL ON alertas_inventario FROM anon;

-- 4. Crear función helper para verificar autenticación
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON TABLE ventas_historicas IS 'Histórico de ventas - Acceso solo para usuarios autenticados';
COMMENT ON TABLE predicciones IS 'Predicciones de ML - Lectura para autenticados, escritura para service_role';
COMMENT ON TABLE alertas_inventario IS 'Alertas de inventario - Lectura para autenticados, escritura para service_role';
