// pages/api/background-analyzer.js - Procesador background para cache de dashboard
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  maxDuration: 30, // Permitir hasta 30 segundos para procesamiento
}

export default async function handler(req, res) {
  console.log('🔄 Background analyzer started');
  const startTime = Date.now();

  try {
    const { action = 'full_recalculation', priority = 'normal' } = req.body || {};

    // 1. Limpiar cache expirado primero
    await supabase.rpc('clean_expired_dashboard_cache');
    console.log('🧹 Expired cache cleaned');

    // 2. Obtener configuración actual
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    if (configError) throw new Error('Config not found');
    const config = configData.data;

    // 3. Obtener todos los productos (en batches para eficiencia)
    const batchSize = 100;
    let offset = 0;
    let allResults = [];

    while (true) {
      console.log(`📊 Processing batch starting at offset ${offset}`);

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
        .range(offset, offset + batchSize - 1)
        .order('sku');

      if (productsError) throw new Error('Products query failed');
      if (!products || products.length === 0) break;

      // 4. Obtener stock en tránsito una sola vez por batch
      const skus = products.map(p => p.sku);
      const { data: comprasData } = await supabase
        .from('compras')
        .select('sku, cantidad')
        .eq('status_compra', 'en_transito')
        .in('sku', skus);

      const stockEnTransitoMap = {};
      if (comprasData) {
        comprasData.forEach(compra => {
          if (!stockEnTransitoMap[compra.sku]) {
            stockEnTransitoMap[compra.sku] = 0;
          }
          stockEnTransitoMap[compra.sku] += compra.cantidad || 0;
        });
      }

      // 5. Obtener venta diaria desde cache existente
      const { data: cacheVentasData } = await supabase
        .from('sku_analysis_cache')
        .select('sku, venta_diaria')
        .in('sku', skus);

      const ventaDiariaMap = {};
      if (cacheVentasData) {
        cacheVentasData.forEach(cache => {
          ventaDiariaMap[cache.sku] = cache.venta_diaria || 0.1;
        });
      }

      // 6. Procesar productos en este batch
      const batchResults = [];

      for (const product of products) {
        const stockActual = product.stock_actual || 0;
        const precioReal = product.precio_venta_sugerido || 0;
        const stockEnTransito = stockEnTransitoMap[product.sku] || 0;
        const ventaDiaria = ventaDiariaMap[product.sku] || 0.1;
        const ventaDiariaCalculada = !!ventaDiariaMap[product.sku];

        // Cálculos usando configuración
        const stockDias = config.stockSaludableMinDias || 30;
        const stockObjetivo = Math.round(ventaDiaria * stockDias);
        const tiempoEntrega = config.tiempoEntrega || 60;
        const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
        const leadTimeDias = tiempoEntrega + tiempoFabricacion;
        const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
        const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

        // Cantidad sugerida
        let cantidadSugerida = 0;
        if (stockProyectadoLlegada < 0) {
          cantidadSugerida = stockObjetivo;
        } else {
          cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
        }

        const valorTotal = precioReal * cantidadSugerida;

        // Prioridad
        let prioridad = 'BAJA';
        if (valorTotal > 500000) prioridad = 'CRÍTICA';
        else if (valorTotal > 200000) prioridad = 'ALTA';
        else if (valorTotal > 100000) prioridad = 'MEDIA';

        const impactoEconomico = {
          valorTotal: Math.round(valorTotal),
          precioPromedioReal: Math.round(precioReal),
          prioridad: prioridad,
          ventasPotenciales: Math.round(valorTotal),
          estimado: false,
          periodoAnalisis: `${stockDias} días`,
          fechaCache: new Date().toISOString(),
          ventaDiariaEsCalculoReal: ventaDiariaCalculada
        };

        batchResults.push({
          sku: product.sku,
          descripcion: product.descripcion,
          status: product.status,
          stock_actual: stockActual,
          venta_diaria: ventaDiaria,
          venta_diaria_calculada: ventaDiariaCalculada,
          en_transito: stockEnTransito,
          cantidad_sugerida: cantidadSugerida,
          stock_objetivo: stockObjetivo,
          stock_proyectado_llegada: stockProyectadoLlegada,
          consumo_durante_lead_time: consumoDuranteLeadTime,
          lead_time_dias: leadTimeDias,
          impacto_economico: impactoEconomico,
          config_usado: config,
          essential: true,
          from_cache: true,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
        });
      }

      // 7. Guardar batch en cache usando upsert
      for (const result of batchResults) {
        await supabase
          .from('dashboard_analysis_cache')
          .upsert(result, { onConflict: 'sku' });
      }

      allResults.push(...batchResults);
      offset += batchSize;

      // Log de progreso
      console.log(`✅ Processed batch: ${batchResults.length} products`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`🎉 Background analysis completed: ${allResults.length} products processed in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      processed: allResults.length,
      processingTime: `${processingTime}ms`,
      action: action,
      priority: priority,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Background analyzer error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}