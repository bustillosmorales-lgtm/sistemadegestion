// pages/api/analysis-fast.js - Endpoint ultra-rápido para carga inicial del dashboard
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

// Fast calculation with simplified price estimation
function getFastAnalysis(product, config, ventaDiariaCalculada = 0) {
  const stockObjetivo = ventaDiariaCalculada * (config.stockSaludableMinDias || 30);
  const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - (product.stock_actual || 0)));
  
  // Estimación rápida de precio promedio (sin consultar BD por velocidad)
  // Usar precio de venta guardado en analysis_details o estimación conservadora
  const precioEstimado = product.analysis_details?.sellingPrice || 5000; // Estimación $5k CLP promedio
  
  // CÁLCULO SIMPLE: Precio Estimado × Cantidad a Reponer  
  const valorTotal = precioEstimado * cantidadSugerida;
  
  // Determinar prioridad
  let prioridad = 'BAJA';
  if (valorTotal > 500000) prioridad = 'CRÍTICA';      // >$500k
  else if (valorTotal > 200000) prioridad = 'ALTA';    // >$200k  
  else if (valorTotal > 100000) prioridad = 'MEDIA';   // >$100k
  
  return {
    sku: product.sku,
    descripcion: product.descripcion,
    status: product.status,
    stock_actual: product.stock_actual || 0,
    venta_diaria: ventaDiariaCalculada,
    cantidadSugerida: cantidadSugerida,
    impactoEconomico: {
      valorTotal: Math.round(valorTotal),
      precioPromedioReal: Math.round(precioEstimado),
      prioridad: prioridad,
      ventasPotenciales: Math.round(valorTotal),
      estimado: true // Marcar como estimación rápida
    },
    // Minimal set of data for fast loading
    essential: true
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
    // 1. Get config from cache or DB
    const configCacheKey = 'config_fast';
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

    // 2. Get products with aggressive pagination (smaller batches for speed)
    const limit = parseInt(req.query.limit) || 15; // Even smaller default
    const offset = parseInt(req.query.offset) || 0;
    
    const productsCacheKey = `products_fast_${offset}_${limit}`;
    let products, count;
    
    const cachedProducts = cache.get(productsCacheKey);
    if (cachedProducts) {
      products = cachedProducts.data;
      count = cachedProducts.count;
      console.log(`⚡ Using cached products for fast load`);
    } else {
      // Only get essential fields for speed
      const { data: productsData, error: productsError, count: productsCount } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('sku', { ascending: true });
        
      if (productsError) throw new Error('Products not found');
      
      products = productsData;
      count = productsCount;
      
      // Cache for 15 minutes
      cache.set(productsCacheKey, { data: products, count: count }, 15 * 60 * 1000);
    }

    // 3. Fast venta diaria calculation
    const allSkus = products.map(p => p.sku);
    const ventaDiariaMap = await getPrecomputedVentaDiaria(allSkus);
    
    // 4. Generate minimal analysis
    const results = [];
    for (const product of products) {
      const ventaDiaria = ventaDiariaMap.get(product.sku) || 0;
      const analysis = getFastAnalysis(product, config, ventaDiaria);
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
    console.log(`⚡ Fast analysis completed in ${processingTime}ms for ${results.length} products`);
    
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
        processingTime: `${processingTime}ms`,
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