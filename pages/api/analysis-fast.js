// pages/api/analysis-fast.js - Endpoint ultra-rápido para carga inicial del dashboard
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

// Ultra-fast analysis using complete pre-computed cache  
async function getFastAnalysisFromCache(product, config, analysisCache = new Map()) {
  const cacheData = analysisCache.get(product.sku);
  
  // Si hay datos en cache, usarlos directamente
  if (cacheData) {
    // Usar configuración actual para período de stock (30, 60 o 90 días)
    const stockDias = config.stockSaludableMinDias || 30;
    let cantidadSugerida, stockObjetivo, precioPromedio, periodoAnalisis;
    
    // Seleccionar datos según configuración
    if (stockDias <= 30) {
      cantidadSugerida = cacheData.cantidad_sugerida_30d || 0;
      stockObjetivo = cacheData.stock_objetivo_30d || 0;
      precioPromedio = cacheData.precio_promedio_30d || cacheData.precio_promedio_90d || 0;
      periodoAnalisis = '30 días';
    } else if (stockDias <= 60) {
      cantidadSugerida = cacheData.cantidad_sugerida_60d || 0;
      stockObjetivo = cacheData.stock_objetivo_60d || 0;
      precioPromedio = cacheData.precio_promedio_30d || cacheData.precio_promedio_90d || 0;
      periodoAnalisis = '60 días';
    } else {
      cantidadSugerida = cacheData.cantidad_sugerida_90d || 0;
      stockObjetivo = cacheData.stock_objetivo_90d || 0;
      precioPromedio = cacheData.precio_promedio_90d || cacheData.precio_promedio_30d || 0;
      periodoAnalisis = '90 días';
    }
    
    // Recalcular con stock actual real (puede haber cambiado)
    const stockActual = product.stock_actual || 0;
    if (cacheData.venta_diaria > 0) {
      const stockObjetivoActual = Math.round(cacheData.venta_diaria * stockDias);
      cantidadSugerida = Math.max(0, stockObjetivoActual - stockActual);
    }
    
    const valorTotal = precioPromedio * cantidadSugerida;
    
    // Determinar prioridad
    let prioridad = 'BAJA';
    if (valorTotal > 500000) prioridad = 'CRÍTICA';
    else if (valorTotal > 200000) prioridad = 'ALTA';
    else if (valorTotal > 100000) prioridad = 'MEDIA';
    
    return {
      sku: product.sku,
      descripcion: product.descripcion,
      status: product.status,
      stock_actual: stockActual,
      venta_diaria: cacheData.venta_diaria || 0,
      cantidadSugerida: cantidadSugerida,
      impactoEconomico: {
        valorTotal: Math.round(valorTotal),
        precioPromedioReal: Math.round(precioPromedio),
        prioridad: prioridad,
        ventasPotenciales: Math.round(valorTotal),
        estimado: !cacheData.calculo_confiable,
        periodoAnalisis: periodoAnalisis,
        fechaCache: cacheData.ultima_actualizacion
      },
      // Datos adicionales del cache
      fechasAnalisis: cacheData.dias_periodo ? {
        diasPeriodo: cacheData.dias_periodo,
        unidadesVendidas: cacheData.unidades_vendidas_periodo
      } : null,
      essential: true,
      fromCache: true
    };
  }
  
  // Fallback: cálculo básico si no hay cache
  const stockObjetivo = 0.5 * (config.stockSaludableMinDias || 30); // Estimación conservadora
  const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - (product.stock_actual || 0)));
  
  // Fallback: intentar obtener último precio real de venta
  let precioPromedio = 0;
  try {
    const { data: ultimaVenta } = await supabase
      .from('ventas')
      .select('precio_unitario')
      .eq('sku', product.sku)
      .not('precio_unitario', 'is', null)
      .gt('precio_unitario', 0)
      .order('fecha_venta', { ascending: false })
      .limit(1);
    
    if (ultimaVenta && ultimaVenta.length > 0) {
      precioPromedio = ultimaVenta[0].precio_unitario;
    }
    // Si no tiene ventas, precio = 0 (va al final automáticamente)
  } catch (error) {
    console.error(`Error obteniendo precio de venta para ${product.sku}:`, error.message);
    precioPromedio = 0;
  }
  const valorTotal = precioPromedio * cantidadSugerida;
  
  // Determinar prioridad
  let prioridad = 'BAJA';
  if (valorTotal > 500000) prioridad = 'CRÍTICA';
  else if (valorTotal > 200000) prioridad = 'ALTA';
  else if (valorTotal > 100000) prioridad = 'MEDIA';
  
  return {
    sku: product.sku,
    descripcion: product.descripcion,
    status: product.status,
    stock_actual: product.stock_actual || 0,
    venta_diaria: 0.5, // Estimación
    cantidadSugerida: cantidadSugerida,
    impactoEconomico: {
      valorTotal: Math.round(valorTotal),
      precioPromedioReal: Math.round(precioPromedio),
      prioridad: prioridad,
      ventasPotenciales: Math.round(valorTotal),
      estimado: true, // Es estimación
      periodoAnalisis: 'estimado'
    },
    essential: true,
    fromCache: false
  };
}

// Pre-computed venta diaria lookup for common SKUs
async function getPrecomputedVentaDiaria(skus) {
  const results = new Map();
  
  // Try to get from cache first
  for (const sku of skus) {
    const cached = cache.get(`venta_diaria_${sku}`);
    if (cached) {
      results.set(sku, cached.ventaDiaria || 0);
    } else {
      // Use default value for uncached - will be computed later in background
      results.set(sku, 0.5); // Conservative estimate
    }
  }
  
  return results;
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
  maxDuration: 10, // Fast 10 second timeout
}

// Force cache bust - 2025-09-12 15:35 - Real prices implemented

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Super fast timeout - 8 seconds
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.log('⚠️ Fast endpoint timeout');
      res.status(200).json({
        success: false,
        message: 'Carga rápida - datos básicos',
        productos: [],
        metadata: { fastMode: true, timeout: true }
      });
    }
  }, 8000);
  
  try {
    // 1. Get config from cache or DB (cache cleared for price update)
    const configCacheKey = 'config_fast_v2'; // New version to clear old cache
    let config = cache.get(configCacheKey);
    
    if (!config) {
      const { data: configData, error: configError } = await supabase
        .from('configuration')
        .select('data')
        .eq('id', 1)
        .single();
        
      if (configError) throw new Error('Config not found');
      config = configData.data;
      
      // Cache config for 1 hour
      cache.set(configCacheKey, config, 60 * 60 * 1000);
    }

    // 2. Get products - simplified approach
    const limit = parseInt(req.query.limit) || 15; // Even smaller default
    const offset = parseInt(req.query.offset) || 0;
    
    // Simple direct query - prioritize products with real prices for first page
    let products, count;
    
    if (offset === 0) {
      // First page: get products with real pricing data
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
        .in('sku', ['649762430726-TUR', '649762431419', '649762431624-MAC', '649762430115-AZU', '649762430115-GRI'])
        .limit(limit);
      
      if (productsError) throw new Error('Products query failed');
      
      products = productsData || [];
      
      // Get count
      const { count: totalCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      count = totalCount || 0;
    } else {
      // Other pages: regular query
      const { data: productsData, error: productsError, count: productsCount } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual, precio_venta_sugerido', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('sku', { ascending: true });
      
      if (productsError) throw new Error('Products query failed');
      
      products = productsData || [];
      count = productsCount || 0;
    }

    // 3. Load COMPLETE analysis cache for all SKUs in one query (ULTRA FAST!)
    const allSkus = products.map(p => p.sku);
    const analysisCache = new Map();
    try {
      const { data: cacheAnalysis } = await supabase
        .from('sku_analysis_cache')
        .select(`
          sku, venta_diaria, precio_promedio_30d, precio_promedio_90d,
          cantidad_sugerida_30d, cantidad_sugerida_60d, cantidad_sugerida_90d,
          stock_objetivo_30d, unidades_vendidas_periodo, dias_periodo,
          calculo_confiable, stock_actual_cache, ultima_actualizacion
        `)
        .in('sku', allSkus);
      
      if (cacheAnalysis) {
        cacheAnalysis.forEach(cache => {
          analysisCache.set(cache.sku, cache);
        });
      }
      console.log(`🚀 Cache análisis completo cargado: ${analysisCache.size}/${allSkus.length} SKUs`);
    } catch (error) {
      console.log('⚠️ Error cargando cache análisis, usando cálculos legacy:', error.message);
    }
    
    // 4. Generate analysis from cache (INSTANT!)
    const results = [];
    for (const product of products) {
      const analysis = await getFastAnalysisFromCache(product, config, analysisCache);
      results.push(analysis);
    }
    
    // 5. ORDENAR por valor de impacto económico real (mayor a menor)
    // Priorizar productos con cantidad sugerida > 0 y ordenar por valor total
    results.sort((a, b) => {
      // Si uno tiene cantidad sugerida 0 y el otro no, priorizar el que tiene cantidad > 0
      if (a.cantidadSugerida <= 0 && b.cantidadSugerida > 0) return 1;
      if (b.cantidadSugerida <= 0 && a.cantidadSugerida > 0) return -1;
      
      // Si ambos tienen cantidad 0 o ambos tienen cantidad > 0, ordenar por valor total
      const aValue = a.impactoEconomico?.valorTotal || 0;
      const bValue = b.impactoEconomico?.valorTotal || 0;
      return bValue - aValue; // Orden descendente (mayor a menor)
    });
    
    clearTimeout(timeoutId);
    
    const processingTime = Date.now() - startTime;
    const fromCacheCount = results.filter(r => r.fromCache).length;
    console.log(`🚀 Ultra-fast analysis completed in ${processingTime}ms for ${results.length} products (${fromCacheCount} from cache)`);
    
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
        ultraFastMode: true, // Indica uso de cache expandido
        processingTime: `${processingTime}ms`,
        fromCacheCount: fromCacheCount,
        cacheHitRatio: `${Math.round((fromCacheCount/results.length)*100)}%`,
        cacheStats: cache.getStats()
      }
    });
    
  } catch (error) {
    console.error('Error en API analysis-fast:', error);
    clearTimeout(timeoutId);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error en carga rápida: ' + error.message,
        fastMode: true 
      });
    }
  }
}