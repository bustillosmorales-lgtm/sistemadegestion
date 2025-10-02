-- sql/setup-daily-cron.sql
-- Configuración de pg_cron para mantenimiento diario automático del dashboard
-- Ejecutar en Supabase SQL Editor

-- 1. Habilitar extensión pg_cron (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Eliminar job anterior si existe (para evitar duplicados)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'dashboard-daily-maintenance'
  ) THEN
    PERFORM cron.unschedule('dashboard-daily-maintenance');
  END IF;
END $$;

-- 3. Crear función para poblar cache de dashboard
CREATE OR REPLACE FUNCTION populate_dashboard_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_config jsonb;
  v_stock_saludable_min_dias integer;
  v_tiempo_entrega integer;
  v_tiempo_fabricacion integer;
  v_lead_time_dias integer;
  v_product record;
  v_venta_diaria_info record;
  v_stock_en_transito integer;
  v_precio_venta numeric;
  v_stock_actual integer;
  v_stock_objetivo integer;
  v_consumo_lead_time integer;
  v_stock_proyectado integer;
  v_cantidad_sugerida integer;
  v_valor_total numeric;
  v_prioridad text;
  v_total_inserted integer := 0;
BEGIN
  -- Obtener configuración
  SELECT data INTO v_config
  FROM configuration
  WHERE id = 1;

  v_stock_saludable_min_dias := COALESCE((v_config->>'stockSaludableMinDias')::integer, 30);
  v_tiempo_entrega := COALESCE((v_config->>'tiempoEntrega')::integer, 60);
  v_tiempo_fabricacion := COALESCE((v_config->>'tiempoPromedioFabricacion')::integer, 30);
  v_lead_time_dias := v_tiempo_entrega + v_tiempo_fabricacion;

  -- Limpiar cache antiguo
  DELETE FROM dashboard_analysis_cache WHERE id > 0;

  -- Iterar sobre todos los productos
  FOR v_product IN
    SELECT sku, descripcion, status, stock_actual, precio_venta_sugerido
    FROM products
  LOOP
    -- Obtener venta diaria de la vista materializada
    SELECT venta_diaria, calculo_confiable
    INTO v_venta_diaria_info
    FROM sku_venta_diaria_mv
    WHERE sku = v_product.sku;

    -- Obtener stock en tránsito
    SELECT COALESCE(SUM(cantidad), 0)
    INTO v_stock_en_transito
    FROM compras
    WHERE sku = v_product.sku
      AND status_compra = 'en_transito';

    v_precio_venta := COALESCE(v_product.precio_venta_sugerido, 0);
    v_stock_actual := COALESCE(v_product.stock_actual, 0);

    -- Si no hay datos confiables, marcar como insuficiente
    IF v_venta_diaria_info IS NULL OR NOT v_venta_diaria_info.calculo_confiable THEN
      INSERT INTO dashboard_analysis_cache (
        sku, descripcion, status, stock_actual, venta_diaria, venta_diaria_calculada,
        datos_insuficientes, en_transito, cantidad_sugerida, stock_objetivo,
        stock_proyectado_llegada, consumo_durante_lead_time, lead_time_dias,
        impacto_economico, essential, from_cache, config_usado, expires_at
      ) VALUES (
        v_product.sku,
        v_product.descripcion,
        v_product.status,
        v_stock_actual,
        0,
        false,
        true,
        v_stock_en_transito,
        NULL,
        NULL,
        NULL,
        NULL,
        v_lead_time_dias,
        jsonb_build_object(
          'valorTotal', 0,
          'precioPromedioReal', 0,
          'prioridad', 'N/A',
          'mensaje', '⚠️ Datos insuficientes para cálculo'
        ),
        true,
        true,
        v_config,
        NOW() + INTERVAL '24 hours'
      );
      v_total_inserted := v_total_inserted + 1;
      CONTINUE;
    END IF;

    -- Calcular métricas
    v_stock_objetivo := ROUND(v_venta_diaria_info.venta_diaria * v_stock_saludable_min_dias);
    v_consumo_lead_time := ROUND(v_venta_diaria_info.venta_diaria * v_lead_time_dias);
    v_stock_proyectado := v_stock_actual + v_stock_en_transito - v_consumo_lead_time;

    -- Calcular cantidad sugerida
    v_cantidad_sugerida := 0;
    IF v_precio_venta > 0 THEN
      IF v_stock_proyectado < 0 THEN
        v_cantidad_sugerida := v_stock_objetivo;
      ELSE
        v_cantidad_sugerida := GREATEST(0, v_stock_objetivo - v_stock_proyectado);
      END IF;
    END IF;

    v_valor_total := v_precio_venta * v_cantidad_sugerida;

    -- Determinar prioridad
    IF v_valor_total > 500000 THEN
      v_prioridad := 'CRÍTICA';
    ELSIF v_valor_total > 200000 THEN
      v_prioridad := 'ALTA';
    ELSIF v_valor_total > 100000 THEN
      v_prioridad := 'MEDIA';
    ELSE
      v_prioridad := 'BAJA';
    END IF;

    -- Insertar en cache
    INSERT INTO dashboard_analysis_cache (
      sku, descripcion, status, stock_actual, venta_diaria, venta_diaria_calculada,
      datos_insuficientes, en_transito, cantidad_sugerida, stock_objetivo,
      stock_proyectado_llegada, consumo_durante_lead_time, lead_time_dias,
      impacto_economico, essential, from_cache, config_usado, calculated_at, expires_at
    ) VALUES (
      v_product.sku,
      v_product.descripcion,
      v_product.status,
      v_stock_actual,
      v_venta_diaria_info.venta_diaria,
      true,
      false,
      v_stock_en_transito,
      v_cantidad_sugerida,
      v_stock_objetivo,
      v_stock_proyectado,
      v_consumo_lead_time,
      v_lead_time_dias,
      jsonb_build_object(
        'valorTotal', ROUND(v_valor_total),
        'precioPromedioReal', ROUND(v_precio_venta),
        'prioridad', v_prioridad
      ),
      true,
      true,
      v_config,
      NOW(),
      NOW() + INTERVAL '24 hours'
    );
    v_total_inserted := v_total_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Cache poblado con % productos', v_total_inserted;
END;
$$;

-- 4. Programar ejecución diaria a las 3 AM (hora de Chile)
-- Nota: pg_cron usa UTC, así que 3 AM Chile = 6 AM UTC (aproximado, ajustar según DST)
SELECT cron.schedule(
  'dashboard-daily-maintenance',
  '0 6 * * *', -- 6 AM UTC = ~3 AM Chile
  $$
  -- Paso 1: Refrescar vista materializada
  REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;

  -- Paso 2: Poblar cache de dashboard
  SELECT populate_dashboard_cache();
  $$
);

-- 5. Verificar que el cron job se creó correctamente
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'dashboard-daily-maintenance';

-- 6. Ver historial de ejecuciones (últimas 10)
SELECT
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'dashboard-daily-maintenance')
ORDER BY start_time DESC
LIMIT 10;

-- COMANDOS ÚTILES:

-- Ejecutar manualmente el mantenimiento (para testing):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY sku_venta_diaria_mv;
-- SELECT populate_dashboard_cache();

-- Desactivar el cron job temporalmente:
-- UPDATE cron.job SET active = false WHERE jobname = 'dashboard-daily-maintenance';

-- Reactivar el cron job:
-- UPDATE cron.job SET active = true WHERE jobname = 'dashboard-daily-maintenance';

-- Eliminar el cron job completamente:
-- SELECT cron.unschedule('dashboard-daily-maintenance');

-- Cambiar horario del cron job:
-- SELECT cron.schedule(
--   'dashboard-daily-maintenance',
--   '0 3 * * *', -- Nueva hora
--   $$...$$ -- Mismo comando
-- );
