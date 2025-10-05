// pages/api/analysis-nocache.js - Endpoint NUEVO sin cache para dashboard
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
  maxDuration: 10,
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Headers anti-cache agresivos
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  
  try {
    // 1. Get config
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();
      
    if (configError) throw new Error('Config not found');
    const config = configData.data;

    // 2. Get products - prioritize those with real prices
    const limit = parseInt(req.query.limit) || 15;
    const offset = parseInt(req.query.offset) || 0;
    
    let products, count;
    
    // Get products efficiently - no complex queries
    const { data: productsData, error: productsError, count: productsCount } = await supabase
      .from('products')
      .select('sku, descripcion, status, stock_actual, precio_venta_sugerido', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('sku', { ascending: true });
    
    if (productsError) throw new Error('Products query failed');
    
    products = productsData || [];
    count = productsCount || 0;

    // 3. Generate analysis with REAL PRICES using correct logic
    const results = [];

    // Get all stock en tránsito in one query for efficiency
    const { data: allComprasData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .eq('status_compra', 'en_transito');

    // Create map for quick lookup
    const stockEnTransitoMap = {};
    if (allComprasData) {
      allComprasData.forEach(compra => {
        if (!stockEnTransitoMap[compra.sku]) {
          stockEnTransitoMap[compra.sku] = 0;
        }
        stockEnTransitoMap[compra.sku] += compra.cantidad || 0;
      });
    }

    for (const product of products) {
      const stockActual = product.stock_actual || 0;
      const precioReal = product.precio_venta_sugerido || 0;
      const stockEnTransito = stockEnTransitoMap[product.sku] || 0;

      // Get venta diaria from cache or indicate calculation not available
      let ventaDiaria = null;
      let ventaDiariaCalculada = false;
      try {
        const { data: cacheData } = await supabase
          .from('sku_analysis_cache')
          .select('venta_diaria')
          .eq('sku', product.sku)
          .single();

        if (cacheData && cacheData.venta_diaria > 0) {
          ventaDiaria = cacheData.venta_diaria;
          ventaDiariaCalculada = true;
        }
      } catch (cacheError) {
        // Cache not available
      }

      // If no venta diaria available, use minimum fallback but indicate it's not calculated
      if (!ventaDiariaCalculada) {
        ventaDiaria = 0.1; // Minimum fallback to avoid division by zero
      }

      // Calculate with correct logic using configuration
      const stockDias = config.stockSaludableMinDias || 30;
      const stockObjetivo = Math.round(ventaDiaria * stockDias);
      const tiempoEntrega = config.tiempoEntrega || 60;
      const tiempoFabricacion = config.tiempoPromedioFabricacion || 30;
      const leadTimeDias = tiempoEntrega + tiempoFabricacion;
      const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);
      const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

      // Apply correct cantidad sugerida logic
      let cantidadSugerida = 0;
      if (stockProyectadoLlegada < 0) {
        cantidadSugerida = stockObjetivo;
      } else {
        cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
      }
      
      const valorTotal = precioReal * cantidadSugerida;
      
      // Determine priority
      let prioridad = 'BAJA';
      if (valorTotal > 500000) prioridad = 'CRÍTICA';
      else if (valorTotal > 200000) prioridad = 'ALTA';
      else if (valorTotal > 100000) prioridad = 'MEDIA';
      
      results.push({
        sku: product.sku,
        descripcion: product.descripcion,
        status: product.status,
        stock_actual: stockActual,
        venta_diaria: ventaDiaria,
        ventaDiariaCalculada: ventaDiariaCalculada,
        enTransito: stockEnTransito,
        cantidadSugerida: cantidadSugerida,
        stockObjetivo: stockObjetivo,
        stockProyectadoLlegada: stockProyectadoLlegada,
        consumoDuranteLeadTime: consumoDuranteLeadTime,
        leadTimeDias: leadTimeDias,
        impactoEconomico: {
          valorTotal: Math.round(valorTotal),
          precioPromedioReal: Math.round(precioReal),
          prioridad: prioridad,
          ventasPotenciales: Math.round(valorTotal),
          estimado: false, // These are REAL prices
          periodoAnalisis: `${stockDias} días`,
          fechaCache: new Date().toISOString(),
          ventaDiariaEsCalculoReal: ventaDiariaCalculada
        },
        essential: true,
        fromCache: false
      });
    }
    
    // 4. Sort by economic impact (PERFECT ordering logic)
    results.sort((a, b) => {
      const aValue = a.impactoEconomico?.valorTotal || 0;
      const bValue = b.impactoEconomico?.valorTotal || 0;
      const aPrice = a.impactoEconomico?.precioPromedioReal || 0;
      const bPrice = b.impactoEconomico?.precioPromedioReal || 0;
      
      // 1. Products with no price (0) go to the end
      if (aPrice === 0 && bPrice > 0) return 1;
      if (bPrice === 0 && aPrice > 0) return -1;
      
      // 2. Among products with prices, order by economic impact (valor total)
      if (aValue !== bValue) return bValue - aValue;
      
      // 3. If same economic impact, order by price (higher first)
      return bPrice - aPrice;
    });
    
    const processingTime = Date.now() - startTime;
    
    return res.status(200).json({ 
      results, 
      configActual: config,
      metadata: {
        total: count,
        offset: offset,
        limit: limit,
        processed: results.length,
        hasMore: offset + limit < count,
        fastMode: true,
        realPricesMode: true, // Flag to indicate real prices
        processingTime: `${processingTime}ms`,
        fromCacheCount: 0,
        cacheHitRatio: '0%',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error en API analysis-nocache:', error);
    
    return res.status(500).json({ 
      error: 'Error en análisis: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}