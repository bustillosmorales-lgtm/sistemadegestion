-- clear-main-tables.sql
-- Script SQL para vaciar las tablas principales del sistema
-- EJECUTAR EN SUPABASE SQL EDITOR

-- Mostrar estadísticas ANTES de limpiar
SELECT 'ANTES DE LIMPIAR - ESTADÍSTICAS:' AS info;

SELECT 
    'products' as tabla,
    COUNT(*) as registros
FROM products
UNION ALL
SELECT 
    'ventas' as tabla,
    COUNT(*) as registros  
FROM ventas
UNION ALL
SELECT 
    'compras' as tabla,
    COUNT(*) as registros
FROM compras
UNION ALL
SELECT 
    'containers' as tabla,
    COUNT(*) as registros
FROM containers
UNION ALL
SELECT 
    'ai_predictions' as tabla,
    COUNT(*) as registros
FROM ai_predictions
UNION ALL
SELECT 
    'temporal_alerts' as tabla,
    COUNT(*) as registros
FROM temporal_alerts
ORDER BY tabla;

-- LIMPIAR TABLAS EN ORDEN ESPECÍFICO (para evitar foreign key conflicts)

-- 1. Limpiar predicciones IA y alertas temporales
DELETE FROM ai_predictions;
DELETE FROM temporal_alerts;

-- 2. Limpiar ventas y compras  
DELETE FROM ventas;
DELETE FROM compras;

-- 3. Limpiar contenedores
DELETE FROM containers;

-- 4. Limpiar productos (al final porque otras tablas pueden referenciarlos)
DELETE FROM products;

-- Mostrar estadísticas DESPUÉS de limpiar
SELECT 'DESPUÉS DE LIMPIAR - ESTADÍSTICAS:' AS info;

SELECT 
    'products' as tabla,
    COUNT(*) as registros
FROM products
UNION ALL
SELECT 
    'ventas' as tabla,
    COUNT(*) as registros  
FROM ventas
UNION ALL
SELECT 
    'compras' as tabla,
    COUNT(*) as registros
FROM compras
UNION ALL
SELECT 
    'containers' as tabla,
    COUNT(*) as registros
FROM containers
UNION ALL
SELECT 
    'ai_predictions' as tabla,
    COUNT(*) as registros
FROM ai_predictions
UNION ALL
SELECT 
    'temporal_alerts' as tabla,
    COUNT(*) as registros
FROM temporal_alerts
ORDER BY tabla;

-- TABLAS PRESERVADAS (NO TOCADAS):
-- - users (usuarios del sistema)
-- - configuration (configuración del sistema)  
-- - reminders (recordatorios)

SELECT 'LIMPIEZA COMPLETADA - Sistema listo para carga fresca de datos' AS resultado;