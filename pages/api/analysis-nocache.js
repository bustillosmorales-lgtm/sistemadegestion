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
    
    if (offset === 0) {
      // First page: get products with real pricing data
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('sku, descripcion, status, stock_actual, precio_venta_sugerido')
        .not('precio_venta_sugerido', 'is', null)
        .gt('precio_venta_sugerido', 0)
        .order('precio_venta_sugerido', { ascending: false })
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

    // 3. Generate analysis with REAL PRICES
    const results = [];
    for (const product of products) {
      const stockActual = product.stock_actual || 0;
      const precioReal = product.precio_venta_sugerido || 0;
      
      // Calculate suggested quantity
      const stockDias = config.stockSaludableMinDias || 30;
      const stockObjetivo = stockDias; // Simple calculation
      const cantidadSugerida = Math.max(0, stockObjetivo - stockActual);
      
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
        venta_diaria: cantidadSugerida > 0 ? 1 : 0.1, // Estimated
        cantidadSugerida: cantidadSugerida,
        impactoEconomico: {
          valorTotal: Math.round(valorTotal),
          precioPromedioReal: Math.round(precioReal),
          prioridad: prioridad,
          ventasPotenciales: Math.round(valorTotal),
          estimado: false, // These are REAL prices
          periodoAnalisis: `${stockDias} días`,
          fechaCache: new Date().toISOString()
        },
        essential: true,
        fromCache: false
      });
    }
    
    // 4. Sort by economic impact (highest first)
    results.sort((a, b) => {
      // Prioritize products with quantity > 0 and high value
      if (a.cantidadSugerida <= 0 && b.cantidadSugerida > 0) return 1;
      if (b.cantidadSugerida <= 0 && a.cantidadSugerida > 0) return -1;
      
      const aValue = a.impactoEconomico?.valorTotal || 0;
      const bValue = b.impactoEconomico?.valorTotal || 0;
      return bValue - aValue; // Descending order
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