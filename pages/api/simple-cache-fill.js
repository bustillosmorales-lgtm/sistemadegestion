// pages/api/simple-cache-fill.js - Llenar cache de forma simple
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
  maxDuration: 15,
}

export default async function handler(req, res) {
  console.log('🔄 Simple cache fill started');
  const startTime = Date.now();

  try {
    // 1. Get config
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    if (configError) throw new Error('Config not found');
    const config = configData.data;

    // 2. Get first 50 products to fill cache quickly
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
      .limit(50)
      .order('sku');

    if (productsError) throw new Error('Products query failed');
    console.log(`📦 Processing ${products?.length || 0} products`);

    // 3. Get stock en tránsito
    const skus = (products || []).map(p => p.sku);
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

    // 4. Calculate real-time venta diaria using analysis module
    console.log('🔄 Calculating real-time venta diaria for dashboard cache...');

    // Import analysis module for real-time calculations
    const analysisModule = await import('./analysis.js');
    const ventaDiariaResults = await analysisModule.calculateVentaDiariaBatch(products || []);

    const ventaDiariaMap = {};
    for (const product of products || []) {
      const result = ventaDiariaResults.get(product.sku);
      if (result && result.ventaDiaria > 0) {
        ventaDiariaMap[product.sku] = result.ventaDiaria;
      } else {
        ventaDiariaMap[product.sku] = 0.1; // Fallback
      }
    }

    // 5. Process and insert into cache
    const cacheEntries = [];
    for (const product of products || []) {
      const stockActual = product.stock_actual || 0;
      const precioReal = product.precio_venta_sugerido || 0;
      const stockEnTransito = stockEnTransitoMap[product.sku] || 0;
      const ventaDiaria = ventaDiariaMap[product.sku] || 0.1;
      const ventaDiariaCalculada = !!ventaDiariaMap[product.sku];

      // Calculations
      const stockDias = config.stockSaludableMinDias || 30;
      const stockObjetivo = Math.round(ventaDiaria * stockDias);
      const tiempoEntrega = config.tiempoEntrega || 60;
      const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
      const leadTimeDias = tiempoEntrega + tiempoFabricacion;
      const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
      const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

      let cantidadSugerida = 0;
      if (stockProyectadoLlegada < 0) {
        cantidadSugerida = stockObjetivo;
      } else {
        cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
      }

      const valorTotal = precioReal * cantidadSugerida;

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

      cacheEntries.push({
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
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      });
    }

    // 6. Batch insert into cache
    const { error: insertError } = await supabase
      .from('dashboard_analysis_cache')
      .upsert(cacheEntries, { onConflict: 'sku' });

    if (insertError) throw new Error('Cache insert failed: ' + insertError.message);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Cache filled with ${cacheEntries.length} entries in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      processed: cacheEntries.length,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Simple cache fill error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}