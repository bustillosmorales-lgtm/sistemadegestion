// pages/api/analysis-paginated.js - Análisis con paginación completa
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

    // 2. Get products with proper pagination
    const limit = parseInt(req.query.limit) || 15;
    const offset = parseInt(req.query.offset) || 0;

    console.log(`📊 Fetching products: limit=${limit}, offset=${offset}`);

    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (countError) throw new Error('Count query failed');
    console.log(`📈 Total products in database: ${totalCount}`);

    // Get products for this page
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
      .range(offset, offset + limit - 1)
      .order('sku', { ascending: true });

    if (productsError) throw new Error('Products query failed');
    console.log(`📦 Retrieved ${products?.length || 0} products for this page`);

    // 3. Get all stock en tránsito for this batch
    const skus = (products || []).map(p => p.sku);
    const { data: allComprasData } = await supabase
      .from('compras')
      .select('sku, cantidad')
      .eq('status_compra', 'en_transito')
      .in('sku', skus);

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

    // 4. Get venta diaria from cache
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

    // 5. Process products
    const results = [];

    for (const product of products || []) {
      const stockActual = product.stock_actual || 0;
      const precioReal = product.precio_venta_sugerido || 0;
      const stockEnTransito = stockEnTransitoMap[product.sku] || 0;
      const ventaDiaria = ventaDiariaMap[product.sku] || 0.1;
      const ventaDiariaCalculada = !!ventaDiariaMap[product.sku];

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
          estimado: false,
          periodoAnalisis: `${stockDias} días`,
          fechaCache: new Date().toISOString(),
          ventaDiariaEsCalculoReal: ventaDiariaCalculada
        },
        essential: true,
        fromCache: false
      });
    }

    // 6. Sort by economic impact
    results.sort((a, b) => {
      const aValue = a.impactoEconomico?.valorTotal || 0;
      const bValue = b.impactoEconomico?.valorTotal || 0;
      const aPrice = a.impactoEconomico?.precioPromedioReal || 0;
      const bPrice = b.impactoEconomico?.precioPromedioReal || 0;

      // Products with no price (0) go to the end
      if (aPrice === 0 && bPrice > 0) return 1;
      if (bPrice === 0 && aPrice > 0) return -1;

      // Among products with prices, order by economic impact
      if (aValue !== bValue) return bValue - aValue;

      // If same economic impact, order by price
      return bPrice - aPrice;
    });

    const processingTime = Date.now() - startTime;
    const hasMore = offset + limit < totalCount;

    console.log(`✅ Processed ${results.length} products, hasMore: ${hasMore} (${offset + limit}/${totalCount})`);

    return res.status(200).json({
      results,
      configActual: config,
      metadata: {
        total: totalCount,
        offset: offset,
        limit: limit,
        processed: results.length,
        hasMore: hasMore,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit),
        paginationMode: true,
        processingTime: `${processingTime}ms`,
        fromCacheCount: results.filter(r => r.ventaDiariaCalculada).length,
        cacheHitRatio: results.length > 0 ? Math.round((results.filter(r => r.ventaDiariaCalculada).length / results.length) * 100) + '%' : '0%',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en API analysis-paginated:', error);

    return res.status(500).json({
      error: 'Error en análisis: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}