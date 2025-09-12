// pages/api/analysis-fast.js - Endpoint ultra-rápido para carga inicial del dashboard
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

// Fast calculation with minimal complexity - for initial dashboard load
function getFastAnalysis(product, config, ventaDiariaCalculada = 0) {
  const stockObjetivo = ventaDiariaCalculada * (config.stockSaludableMinDias || 30);
  const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - (product.stock_actual || 0)));
  
  // Cálculo rápido de impacto (simplificado para velocidad)
  const gananciaEstimada = cantidadSugerida * 2000; // Estimación conservadora
  const urgencia = ventaDiariaCalculada > 1 ? ventaDiariaCalculada * 1000 : 500;
  const impactoRapido = gananciaEstimada + urgencia;
  
  return {
    sku: product.sku,
    descripcion: product.descripcion,
    status: product.status,
    stock_actual: product.stock_actual || 0,
    venta_diaria: ventaDiariaCalculada,
    cantidadSugerida: cantidadSugerida,
    impactoEconomico: {
      valorTotal: Math.round(impactoRapido),
      prioridad: impactoRapido > 50000 ? 'ALTA' : impactoRapido > 20000 ? 'MEDIA' : 'BAJA'
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
    
    // 5. ORDENAR por valor de impacto económico (mayor a menor)
    results.sort((a, b) => {
      const aValue = a.cantidadSugerida > 0 ? (a.impactoEconomico?.valorTotal || 0) : -1;
      const bValue = b.cantidadSugerida > 0 ? (b.impactoEconomico?.valorTotal || 0) : -1;
      return bValue - aValue;
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