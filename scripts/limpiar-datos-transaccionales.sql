-- ================================================
-- SCRIPT DE LIMPIEZA DE DATOS TRANSACCIONALES
-- ================================================
-- Este script limpia solo los datos de operación diaria,
-- manteniendo la configuración del sistema intacta.
--
-- ⚠️ IMPORTANTE: Este script borra:
--   ✅ Ventas históricas
--   ✅ Compras históricas
--   ✅ Tránsito de China
--   ✅ Stock actual
--   ✅ Predicciones
--   ✅ Alertas de inventario
--   ✅ Métricas del modelo
--   ✅ Cotizaciones
--
-- ❌ NO borra (se mantiene):
--   ✅ Configuración del sistema
--   ✅ Usuarios y roles
--   ✅ SKUs excluidos
--   ✅ Packs configurados
--   ✅ SKUs a desconsiderar
--   ✅ Integraciones (Defontana)
--   ✅ Logs de sincronización
--
-- Ejecutar en Supabase SQL Editor
-- ================================================

BEGIN;

-- 1. Limpiar cotizaciones
TRUNCATE TABLE cotizaciones RESTART IDENTITY CASCADE;

-- 2. Limpiar ventas históricas
TRUNCATE TABLE ventas_historicas RESTART IDENTITY CASCADE;

-- 3. Limpiar compras históricas
-- Puede ser "compras" o "compras_historicas" dependiendo de tu esquema
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compras') THEN
        TRUNCATE TABLE compras RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compras_historicas') THEN
        TRUNCATE TABLE compras_historicas RESTART IDENTITY CASCADE;
    END IF;
END $$;

-- 4. Limpiar tránsito de China
-- Puede ser "transito" o "transito_china"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transito') THEN
        TRUNCATE TABLE transito RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transito_china') THEN
        TRUNCATE TABLE transito_china RESTART IDENTITY CASCADE;
    END IF;
END $$;

-- 5. Limpiar stock actual
TRUNCATE TABLE stock_actual CASCADE;

-- 6. Limpiar predicciones
TRUNCATE TABLE predicciones RESTART IDENTITY CASCADE;

-- 7. Limpiar alertas de inventario
TRUNCATE TABLE alertas_inventario RESTART IDENTITY CASCADE;

-- 8. Limpiar métricas del modelo
TRUNCATE TABLE metricas_modelo RESTART IDENTITY CASCADE;

-- 9. Limpiar logs de sincronización (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_logs') THEN
        TRUNCATE TABLE sync_logs RESTART IDENTITY CASCADE;
    END IF;
END $$;

-- 10. Verificación final
SELECT
    'ventas_historicas' as tabla,
    COUNT(*) as registros_restantes
FROM ventas_historicas
UNION ALL
SELECT 'cotizaciones', COUNT(*) FROM cotizaciones
UNION ALL
SELECT 'predicciones', COUNT(*) FROM predicciones
UNION ALL
SELECT 'stock_actual', COUNT(*) FROM stock_actual
UNION ALL
SELECT 'alertas_inventario', COUNT(*) FROM alertas_inventario
UNION ALL
SELECT 'metricas_modelo', COUNT(*) FROM metricas_modelo
UNION ALL
SELECT '--- CONFIGURACIÓN (NO LIMPIADA) ---', 0
UNION ALL
SELECT 'configuracion_sistema', COUNT(*) FROM configuracion_sistema
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'skus_excluidos', COUNT(*) FROM skus_excluidos
UNION ALL
SELECT 'packs', COUNT(*) FROM packs
ORDER BY tabla;

COMMIT;

-- ================================================
-- FIN DEL SCRIPT
-- ================================================
-- Si todas las tablas transaccionales muestran 0 registros
-- y las de configuración mantienen sus datos, ¡todo está perfecto!
