-- ================================================
-- SCRIPT DE LIMPIEZA COMPLETA (INCLUYENDO CONFIGURACIÓN)
-- ================================================
-- ⚠️⚠️⚠️ ADVERTENCIA: ESTE SCRIPT ES MÁS AGRESIVO ⚠️⚠️⚠️
--
-- Este script limpia TODO excepto usuarios y roles.
-- Usar solo si quieres empezar completamente desde cero.
--
-- Borra:
--   ✅ Ventas, compras, tránsito, stock
--   ✅ Predicciones, alertas, métricas
--   ✅ Cotizaciones
--   ✅ SKUs excluidos
--   ✅ Packs configurados
--   ✅ SKUs a desconsiderar
--   ✅ Configuración de integraciones
--
-- NO borra:
--   ✅ Usuarios (auth.users)
--   ✅ Roles y permisos (roles, permissions, user_roles)
--   ✅ Configuración del sistema (configuracion_sistema)
--
-- Ejecutar en Supabase SQL Editor
-- ================================================

BEGIN;

-- 1. Datos transaccionales
TRUNCATE TABLE cotizaciones RESTART IDENTITY CASCADE;
TRUNCATE TABLE ventas_historicas RESTART IDENTITY CASCADE;
TRUNCATE TABLE stock_actual CASCADE;
TRUNCATE TABLE predicciones RESTART IDENTITY CASCADE;
TRUNCATE TABLE alertas_inventario RESTART IDENTITY CASCADE;
TRUNCATE TABLE metricas_modelo RESTART IDENTITY CASCADE;

-- 2. Compras y tránsito (ambas variantes de nombre)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compras') THEN
        TRUNCATE TABLE compras RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compras_historicas') THEN
        TRUNCATE TABLE compras_historicas RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transito') THEN
        TRUNCATE TABLE transito RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transito_china') THEN
        TRUNCATE TABLE transito_china RESTART IDENTITY CASCADE;
    END IF;
END $$;

-- 3. Configuración de productos (si quieres resetear todo)
TRUNCATE TABLE skus_excluidos CASCADE;
TRUNCATE TABLE packs RESTART IDENTITY CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'skus_desconsiderar') THEN
        TRUNCATE TABLE skus_desconsiderar CASCADE;
    END IF;
END $$;

-- 4. Integraciones (si quieres reconfigurar Defontana desde cero)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_logs') THEN
        TRUNCATE TABLE sync_logs RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integraciones_config') THEN
        -- NO limpiamos integraciones_config porque contiene las credenciales de Defontana
        -- Si quieres limpiar también esto, descomenta la siguiente línea:
        -- TRUNCATE TABLE integraciones_config CASCADE;
        NULL;
    END IF;
END $$;

-- 5. Verificación final
SELECT
    'ventas_historicas' as tabla,
    COUNT(*) as registros
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
SELECT 'skus_excluidos', COUNT(*) FROM skus_excluidos
UNION ALL
SELECT 'packs', COUNT(*) FROM packs
UNION ALL
SELECT '--- CONSERVADOS ---', 0
UNION ALL
SELECT 'configuracion_sistema', COUNT(*) FROM configuracion_sistema
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
ORDER BY tabla;

COMMIT;

-- ================================================
-- FIN DEL SCRIPT
-- ================================================
