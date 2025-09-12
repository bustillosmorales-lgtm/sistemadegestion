// pages/api/update-cache.js - Endpoint para actualizar el cache de precios
import { supabase } from '../../lib/supabaseClient';

const BATCH_SIZE = 50; // Procesar en lotes más pequeños para evitar timeouts

async function obtenerPrecioProducto(product) {
  try {
    // Si tiene precio sugerido válido, usarlo
    if (product.precio_venta_sugerido && product.precio_venta_sugerido > 0) {
      return {
        precioPromedio: Math.round(product.precio_venta_sugerido),
        totalVentas: 1
      };
    }
    
    // Si no hay precio sugerido pero hay costo FOB, estimar precio con margen
    if (product.costo_fob_rmb && product.costo_fob_rmb > 0) {
      const costoCLP = product.costo_fob_rmb * 130; // Conversión RMB a CLP
      const precioEstimado = costoCLP * 2.5; // Margen típico
      return {
        precioPromedio: Math.round(precioEstimado),
        totalVentas: 0
      };
    }
    
    // Fallback mejorado
    return { precioPromedio: 8000, totalVentas: 0 };
    
  } catch (error) {
    return { precioPromedio: 8000, totalVentas: 0 };
  }
}

async function actualizarCacheLote(products) {
  const cacheUpdates = [];
  
  for (const product of products) {
    const precioData = await obtenerPrecioProducto(product);
    
    // Simular venta diaria basada en características del producto
    let ventaDiaria = 0.5; // Base
    if (product.descripcion?.includes('PACK')) ventaDiaria = 1.2;
    if (product.stock_actual <= 5) ventaDiaria = 0.8; // Menos demanda si poco stock
    
    // Calcular cantidades sugeridas
    const stockObjetivo30d = Math.round(ventaDiaria * 30);
    const stockObjetivo60d = Math.round(ventaDiaria * 60);  
    const stockObjetivo90d = Math.round(ventaDiaria * 90);
    
    const cantidadSugerida30d = Math.max(0, stockObjetivo30d - (product.stock_actual || 0));
    const cantidadSugerida60d = Math.max(0, stockObjetivo60d - (product.stock_actual || 0));
    const cantidadSugerida90d = Math.max(0, stockObjetivo90d - (product.stock_actual || 0));
    
    cacheUpdates.push({
      sku: product.sku,
      precio_promedio_30d: precioData.precioPromedio,
      precio_promedio_90d: precioData.precioPromedio,
      total_ventas_30d: precioData.totalVentas,
      total_ventas_90d: precioData.totalVentas,
      venta_diaria: ventaDiaria,
      cantidad_sugerida_30d: cantidadSugerida30d,
      cantidad_sugerida_60d: cantidadSugerida60d,
      cantidad_sugerida_90d: cantidadSugerida90d,
      stock_objetivo_30d: stockObjetivo30d,
      stock_objetivo_60d: stockObjetivo60d,
      stock_objetivo_90d: stockObjetivo90d,
      stock_actual_cache: product.stock_actual || 0,
      calculo_confiable: precioData.totalVentas > 0,
      ultima_actualizacion: new Date().toISOString()
    });
  }
  
  // Upsert en la base de datos
  const { error } = await supabase
    .from('sku_analysis_cache')
    .upsert(cacheUpdates, { onConflict: 'sku' });
    
  if (error) {
    throw new Error(`Error actualizando cache: ${error.message}`);
  }
  
  return cacheUpdates.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const startTime = Date.now();
  
  try {
    console.log('🚀 Iniciando actualización de cache de precios...');
    
    // Obtener productos con paginación
    let allProducts = [];
    let offset = 0;
    const pageSize = 500;
    
    while (true) {
      const { data: products, error } = await supabase
        .from('products')
        .select('sku, descripcion, stock_actual, precio_venta_sugerido, costo_fob_rmb')
        .not('sku', 'is', null)
        .range(offset, offset + pageSize - 1);
      
      if (error) {
        throw new Error(`Error obteniendo productos: ${error.message}`);
      }
      
      if (!products || products.length === 0) break;
      
      allProducts.push(...products);
      console.log(`📄 Cargados ${allProducts.length} productos...`);
      
      if (products.length < pageSize) break;
      offset += pageSize;
    }
    
    console.log(`📊 Total productos a procesar: ${allProducts.length}`);
    
    // Procesar en lotes
    let processed = 0;
    const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);
    
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`🔄 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} productos)`);
      
      const batchProcessed = await actualizarCacheLote(batch);
      processed += batchProcessed;
      
      // Pausa pequeña entre lotes para no sobrecargar
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const duration = Date.now() - startTime;
    
    // Obtener estadísticas del cache actualizado
    const { data: stats } = await supabase
      .from('sku_analysis_cache')
      .select('calculo_confiable')
      .not('precio_promedio_30d', 'eq', 5000); // Contar los que NO usan 5000
    
    const conNuevosPecios = stats?.length || 0;
    
    console.log(`✅ Cache actualizado exitosamente en ${duration}ms`);
    
    return res.status(200).json({
      success: true,
      message: 'Cache actualizado exitosamente',
      stats: {
        productosProcessados: processed,
        totalProductos: allProducts.length,
        tiempoMs: duration,
        conNuevosPrecios: conNuevosPecios,
        porcentajeActualizado: Math.round((conNuevosPecios / processed) * 100)
      }
    });
    
  } catch (error) {
    console.error('❌ Error actualizando cache:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error actualizando cache de precios'
    });
  }
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  maxDuration: 300, // 5 minutos máximo
}