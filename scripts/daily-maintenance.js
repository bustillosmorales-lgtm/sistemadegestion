// scripts/daily-maintenance.js
// Script de mantenimiento diario automatizado
// Ejecuta refresh de vista materializada y población de cache

const { supabase } = require('../lib/supabaseClient');

async function dailyMaintenance() {
  console.log('🔧 Iniciando mantenimiento diario del dashboard...\n');
  const startTime = Date.now();

  try {
    // PASO 1: Refrescar vista materializada
    console.log('📊 PASO 1: Refrescando vista materializada...');
    const { error: refreshError } = await supabase.rpc('refresh_venta_diaria_mv');

    if (refreshError) {
      console.error('❌ Error al refrescar vista materializada:', refreshError);
      process.exit(1);
    }

    const { count: totalSkus } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*', { count: 'exact', head: true });

    const { count: confiables } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*', { count: 'exact', head: true })
      .eq('calculo_confiable', true);

    console.log(`✅ Vista materializada actualizada: ${totalSkus} SKUs (${confiables} confiables)\n`);

    // PASO 2: Poblar cache de dashboard
    console.log('💾 PASO 2: Poblando cache de dashboard...');

    // Obtener configuración
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    const config = configData?.data || {};
    const stockSaludableMinDias = config.stockSaludableMinDias || 30;
    const tiempoEntrega = config.tiempoEntrega || 60;
    const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
    const leadTimeDias = tiempoEntrega + tiempoFabricacion;

    // Obtener todos los productos (con paginación)
    let allProducts = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: productsBatch } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
        .range(offset, offset + batchSize - 1);

      if (!productsBatch || productsBatch.length === 0) {
        hasMore = false;
        break;
      }

      allProducts = [...allProducts, ...productsBatch];

      if (productsBatch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    // Obtener venta diaria (con paginación)
    let allVentaDiariaData = [];
    let ventaOffset = 0;
    let hasMoreVenta = true;

    while (hasMoreVenta) {
      const { data: ventaBatch } = await supabase
        .from('sku_venta_diaria_mv')
        .select('*')
        .range(ventaOffset, ventaOffset + batchSize - 1);

      if (!ventaBatch || ventaBatch.length === 0) {
        hasMoreVenta = false;
        break;
      }

      allVentaDiariaData = [...allVentaDiariaData, ...ventaBatch];

      if (ventaBatch.length < batchSize) {
        hasMoreVenta = false;
      } else {
        ventaOffset += batchSize;
      }
    }

    const ventaDiariaMap = new Map();
    allVentaDiariaData?.forEach(row => {
      ventaDiariaMap.set(row.sku, {
        ventaDiaria: row.venta_diaria,
        confiable: row.calculo_confiable
      });
    });

    // Obtener stock en tránsito
    const { data: stockEnTransitoData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .eq('status_compra', 'en_transito');

    const stockEnTransitoMap = new Map();
    stockEnTransitoData?.forEach(item => {
      const current = stockEnTransitoMap.get(item.sku) || 0;
      stockEnTransitoMap.set(item.sku, current + (item.cantidad || 0));
    });

    // Calcular cache entries
    const cacheEntries = [];
    let productsWithData = 0;
    let productsWithoutData = 0;

    for (const product of allProducts) {
      const ventaDiariaInfo = ventaDiariaMap.get(product.sku);
      const precioVenta = product.precio_venta_sugerido || 0;

      if (!ventaDiariaInfo || !ventaDiariaInfo.confiable) {
        cacheEntries.push({
          sku: product.sku,
          descripcion: product.descripcion,
          status: product.status,
          stock_actual: product.stock_actual || 0,
          venta_diaria: 0,
          venta_diaria_calculada: false,
          datos_insuficientes: true,
          en_transito: stockEnTransitoMap.get(product.sku) || 0,
          cantidad_sugerida: null,
          stock_objetivo: null,
          stock_proyectado_llegada: null,
          consumo_durante_lead_time: null,
          lead_time_dias: leadTimeDias,
          impacto_economico: {
            valorTotal: 0,
            precioPromedioReal: 0,
            prioridad: 'N/A',
            mensaje: '⚠️ Datos insuficientes para cálculo'
          },
          essential: true,
          from_cache: true,
          config_usado: config,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        productsWithoutData++;
        continue;
      }

      const ventaDiaria = ventaDiariaInfo.ventaDiaria;
      const stockActual = product.stock_actual || 0;
      const stockEnTransito = stockEnTransitoMap.get(product.sku) || 0;

      const stockObjetivo = Math.round(ventaDiaria * stockSaludableMinDias);
      const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
      const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

      let cantidadSugerida = 0;
      if (precioVenta > 0) {
        if (stockProyectadoLlegada < 0) {
          cantidadSugerida = stockObjetivo;
        } else {
          cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
        }
      }

      const valorTotal = precioVenta * cantidadSugerida;

      cacheEntries.push({
        sku: product.sku,
        descripcion: product.descripcion,
        status: product.status,
        stock_actual: stockActual,
        venta_diaria: ventaDiaria,
        venta_diaria_calculada: true,
        datos_insuficientes: false,
        en_transito: stockEnTransito,
        cantidad_sugerida: cantidadSugerida,
        stock_objetivo: stockObjetivo,
        stock_proyectado_llegada: stockProyectadoLlegada,
        consumo_durante_lead_time: consumoDuranteLeadTime,
        lead_time_dias: leadTimeDias,
        impacto_economico: {
          valorTotal: Math.round(valorTotal),
          precioPromedioReal: Math.round(precioVenta),
          prioridad: valorTotal > 500000 ? 'CRÍTICA' :
                     valorTotal > 200000 ? 'ALTA' :
                     valorTotal > 100000 ? 'MEDIA' : 'BAJA'
        },
        essential: true,
        from_cache: true,
        config_usado: config,
        calculated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      productsWithData++;
    }

    // Limpiar cache antiguo
    await supabase
      .from('dashboard_analysis_cache')
      .delete()
      .neq('id', 0);

    // Insertar nuevos datos en lotes
    const insertBatchSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < cacheEntries.length; i += insertBatchSize) {
      const batch = cacheEntries.slice(i, i + insertBatchSize);

      const { error } = await supabase
        .from('dashboard_analysis_cache')
        .insert(batch);

      if (error) {
        console.error(`❌ Error en lote ${i}-${i+insertBatchSize}:`, error.message);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`✅ Cache poblado: ${totalInserted} productos (${productsWithData} con datos)\n`);

    // RESUMEN FINAL
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MANTENIMIENTO DIARIO COMPLETADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Vista materializada: ${totalSkus} SKUs`);
    console.log(`💾 Cache poblado: ${totalInserted} productos`);
    console.log(`✅ Con datos confiables: ${productsWithData}`);
    console.log(`⚠️  Datos insuficientes: ${productsWithoutData}`);
    console.log(`⏱️  Tiempo total: ${duration}s`);
    console.log(`📅 Próxima ejecución: ${nextRun.toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error en mantenimiento diario:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  dailyMaintenance();
}

module.exports = dailyMaintenance;
