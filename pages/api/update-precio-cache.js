// pages/api/update-precio-cache.js - API endpoint para actualizar cache de precios
import { actualizarCacheAnalisisCompleto } from '../../scripts/update-precio-cache.js';
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 120, // 2 minutos para el job completo
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método no permitido. Solo POST.' 
    });
  }
  
  try {
    console.log('🚀 Iniciando actualización de cache de precios vía API...');
    
    // Verificar si hay parámetros específicos
    const { skus, limit } = req.body || {};
    let skusToUpdate = [];
    
    if (skus && Array.isArray(skus)) {
      // Actualizar SKUs específicos
      skusToUpdate = skus;
      console.log(`📝 Actualizando SKUs específicos: ${skusToUpdate.length}`);
    } else {
      // Obtener todos los SKUs o una muestra
      const queryLimit = parseInt(limit) || null;
      const query = supabase
        .from('products')
        .select('sku')
        .not('sku', 'is', null);
      
      if (queryLimit) {
        query.limit(queryLimit);
      }
      
      const { data: products, error: productsError } = await query;
      
      if (productsError) {
        throw new Error('Error obteniendo productos: ' + productsError.message);
      }
      
      skusToUpdate = products.map(p => p.sku);
      console.log(`📝 Total SKUs a actualizar: ${skusToUpdate.length}`);
    }
    
    if (skusToUpdate.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay SKUs para actualizar',
        processed: 0,
        duration: Date.now() - startTime
      });
    }
    
    // Actualizar en lotes para evitar timeouts
    const BATCH_SIZE = 50; // Lotes más pequeños para API
    let totalProcessed = 0;
    
    for (let i = 0; i < skusToUpdate.length; i += BATCH_SIZE) {
      const batch = skusToUpdate.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Procesando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(skusToUpdate.length/BATCH_SIZE)}`);
      
      const success = await actualizarCacheAnalisisCompleto(batch);
      if (success) {
        totalProcessed += batch.length;
      }
      
      // Verificar timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > 110000) { // 110 segundos de límite
        console.log('⚠️ Timeout approaching, stopping batch processing');
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Estadísticas finales
    const { data: stats, error: statsError } = await supabase
      .from('sku_analysis_cache')
      .select('sku, calculo_confiable, venta_diaria')
      .gt('venta_diaria', 0);
    
    const totalWithData = stats ? stats.length : 0;
    const totalConfiables = stats ? stats.filter(s => s.calculo_confiable).length : 0;
    
    console.log(`✅ Cache actualizado: ${totalProcessed} SKUs en ${Math.round(duration/1000)}s`);
    
    return res.status(200).json({
      success: true,
      message: `Cache de análisis completo actualizado exitosamente`,
      processed: totalProcessed,
      totalRequested: skusToUpdate.length,
      totalWithData: totalWithData,
      totalConfiables: totalConfiables,
      confiabilidad: totalWithData > 0 ? `${Math.round((totalConfiables/totalWithData)*100)}%` : '0%',
      duration: `${Math.round(duration/1000)}s`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error actualizando cache de precios:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      processed: 0,
      duration: Date.now() - startTime
    });
  }
}