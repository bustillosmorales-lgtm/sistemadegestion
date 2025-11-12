-- Deshabilitar RLS y crear políticas para tablas de predicciones
-- Ejecuta este SQL en Supabase SQL Editor

-- 1. Tabla predicciones
ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura pública de predicciones"
ON predicciones FOR SELECT
USING (true);

CREATE POLICY "Permitir escritura con service_role"
ON predicciones FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir actualización con service_role"
ON predicciones FOR UPDATE
USING (true);

CREATE POLICY "Permitir eliminación con service_role"
ON predicciones FOR DELETE
USING (true);

-- 2. Tabla metricas_modelo
ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura pública de métricas"
ON metricas_modelo FOR SELECT
USING (true);

CREATE POLICY "Permitir escritura con service_role metricas"
ON metricas_modelo FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir actualización con service_role metricas"
ON metricas_modelo FOR UPDATE
USING (true);

CREATE POLICY "Permitir eliminación con service_role metricas"
ON metricas_modelo FOR DELETE
USING (true);

-- 3. Tabla alertas_inventario
ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura pública de alertas"
ON alertas_inventario FOR SELECT
USING (true);

CREATE POLICY "Permitir escritura con service_role alertas"
ON alertas_inventario FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir actualización con service_role alertas"
ON alertas_inventario FOR UPDATE
USING (true);

CREATE POLICY "Permitir eliminación con service_role alertas"
ON alertas_inventario FOR DELETE
USING (true);

-- Verificación
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('predicciones', 'metricas_modelo', 'alertas_inventario')
ORDER BY tablename;
