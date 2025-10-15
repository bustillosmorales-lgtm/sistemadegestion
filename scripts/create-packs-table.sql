-- ============================================
-- TABLA: packs
-- Descripción: Define la composición de packs
-- ============================================

CREATE TABLE IF NOT EXISTS packs (
    id SERIAL PRIMARY KEY,
    pack_sku VARCHAR(50) NOT NULL,           -- SKU del pack (ej: PACK0001)
    producto_sku VARCHAR(100) NOT NULL,      -- SKU del producto dentro del pack
    cantidad INTEGER NOT NULL DEFAULT 1,      -- Cantidad del producto en el pack
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT packs_cantidad_positiva CHECK (cantidad > 0),
    CONSTRAINT packs_unique_combination UNIQUE (pack_sku, producto_sku)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_packs_pack_sku ON packs(pack_sku);
CREATE INDEX IF NOT EXISTS idx_packs_producto_sku ON packs(producto_sku);

-- Comentarios
COMMENT ON TABLE packs IS 'Composición de packs de productos (bundles)';
COMMENT ON COLUMN packs.pack_sku IS 'SKU del pack que se vende';
COMMENT ON COLUMN packs.producto_sku IS 'SKU del producto individual dentro del pack';
COMMENT ON COLUMN packs.cantidad IS 'Cantidad de unidades del producto en el pack';

-- ============================================
-- FUNCIÓN: descomponer_venta_pack
-- Descripción: Descompone una venta de pack en ventas individuales
-- ============================================

CREATE OR REPLACE FUNCTION descomponer_venta_pack(
    p_pack_sku VARCHAR,
    p_cantidad_vendida INTEGER,
    p_fecha_venta TIMESTAMP
) RETURNS TABLE (
    sku VARCHAR,
    cantidad INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.producto_sku::VARCHAR as sku,
        (p.cantidad * p_cantidad_vendida)::INTEGER as cantidad
    FROM packs p
    WHERE p.pack_sku = p_pack_sku;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION descomponer_venta_pack IS 'Descompone una venta de pack en productos individuales';

-- ============================================
-- VISTA: ventas_descompuestas
-- Descripción: Ventas con packs descompuestos automáticamente
-- ============================================

CREATE OR REPLACE VIEW ventas_descompuestas AS
WITH ventas_normales AS (
    -- Ventas de productos normales (no packs)
    SELECT
        v.sku,
        v.cantidad,
        v.fecha_venta,
        'producto' as tipo_venta
    FROM ventas v
    WHERE NOT EXISTS (
        SELECT 1 FROM packs p WHERE p.pack_sku = v.sku
    )
),
ventas_packs_descompuestos AS (
    -- Ventas de packs descompuestos en productos individuales
    SELECT
        p.producto_sku as sku,
        (v.cantidad * p.cantidad) as cantidad,
        v.fecha_venta,
        'pack_descompuesto' as tipo_venta
    FROM ventas v
    INNER JOIN packs p ON v.sku = p.pack_sku
)
SELECT * FROM ventas_normales
UNION ALL
SELECT * FROM ventas_packs_descompuestos;

COMMENT ON VIEW ventas_descompuestas IS 'Vista que descompone automáticamente las ventas de packs';

-- ============================================
-- FUNCIÓN: obtener_ventas_diarias_con_packs
-- Descripción: Suma ventas diarias incluyendo packs descompuestos
-- ============================================

CREATE OR REPLACE FUNCTION obtener_ventas_diarias_con_packs(
    p_fecha_inicio DATE,
    p_fecha_fin DATE
) RETURNS TABLE (
    sku VARCHAR,
    fecha DATE,
    cantidad_total BIGINT,
    ventas_directas BIGINT,
    ventas_por_packs BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(vn.sku, vp.sku) as sku,
        COALESCE(vn.fecha, vp.fecha)::DATE as fecha,
        COALESCE(vn.cantidad, 0) + COALESCE(vp.cantidad, 0) as cantidad_total,
        COALESCE(vn.cantidad, 0) as ventas_directas,
        COALESCE(vp.cantidad, 0) as ventas_por_packs
    FROM (
        -- Ventas directas (no packs)
        SELECT
            v.sku,
            v.fecha_venta::DATE as fecha,
            SUM(v.cantidad) as cantidad
        FROM ventas v
        WHERE v.fecha_venta::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
          AND NOT EXISTS (SELECT 1 FROM packs p WHERE p.pack_sku = v.sku)
        GROUP BY v.sku, v.fecha_venta::DATE
    ) vn
    FULL OUTER JOIN (
        -- Ventas de packs descompuestas
        SELECT
            p.producto_sku as sku,
            v.fecha_venta::DATE as fecha,
            SUM(v.cantidad * p.cantidad) as cantidad
        FROM ventas v
        INNER JOIN packs p ON v.sku = p.pack_sku
        WHERE v.fecha_venta::DATE BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY p.producto_sku, v.fecha_venta::DATE
    ) vp ON vn.sku = vp.sku AND vn.fecha = vp.fecha
    ORDER BY fecha DESC, sku;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_ventas_diarias_con_packs IS 'Obtiene ventas diarias con packs descompuestos';

-- ============================================
-- Ejemplos de uso:
-- ============================================

-- Ver composición de un pack:
-- SELECT * FROM packs WHERE pack_sku = 'PACK0001';

-- Descomponer una venta de pack:
-- SELECT * FROM descomponer_venta_pack('PACK0003', 5, '2024-10-15');

-- Ver todas las ventas descompuestas:
-- SELECT * FROM ventas_descompuestas WHERE fecha_venta::DATE = '2024-10-15';

-- Obtener ventas diarias con packs:
-- SELECT * FROM obtener_ventas_diarias_con_packs('2024-10-01', '2024-10-31');
