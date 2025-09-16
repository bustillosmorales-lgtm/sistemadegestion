// pages/api/dashboard-stats.js - Vista rápida por status sin cargar productos individuales
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 8, // Súper rápido - 8 segundos máximo
}

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Buscar en cache primero
    const cacheKey = 'dashboard_stats_summary';
    const cachedStats = cache.get(cacheKey);
    
    if (cachedStats) {
      console.log('⚡ Usando estadísticas desde cache');
      return res.status(200).json({
        success: true,
        stats: cachedStats,
        metadata: {
          fromCache: true,
          processingTime: `${Date.now() - startTime}ms`
        }
      });
    }
    
    console.log('📊 Calculando estadísticas por status...');
    
    // Consulta súper eficiente - solo contar por status
    const { data: statusCounts, error: statusError } = await supabase
      .from('products')
      .select('status')
      .not('status', 'is', null);
    
    if (statusError) {
      throw new Error('Error obteniendo conteos por status: ' + statusError.message);
    }
    
    // Procesar conteos por status
    const statusStats = {};
    const statusTotals = {
      'NEEDS_REPLENISHMENT': 0,
      'QUOTE_REQUESTED': 0, 
      'QUOTED': 0,
      'QUOTED_PRICE_MODIFIED': 0,
      'ANALYZING': 0,
      'PURCHASE_APPROVED': 0,
      'PURCHASE_CONFIRMED': 0,
      'MANUFACTURED': 0,
      'SHIPPED': 0,
      'NO_REPLENISHMENT_NEEDED': 0,
      'QUOTE_REJECTED': 0
    };
    
    // Contar productos por status
    (statusCounts || []).forEach(product => {
      const status = product.status;
      if (statusTotals.hasOwnProperty(status)) {
        statusTotals[status]++;
      } else {
        // Status desconocidos o legacy
        statusTotals[status] = (statusTotals[status] || 0) + 1;
      }
    });
    
    // Calcular estadísticas adicionales
    const totalProducts = statusCounts?.length || 0;
    const activeWorkflow = statusTotals['NEEDS_REPLENISHMENT'] + 
                          statusTotals['QUOTE_REQUESTED'] + 
                          statusTotals['QUOTED'] + 
                          statusTotals['ANALYZING'] + 
                          statusTotals['PURCHASE_APPROVED'] + 
                          statusTotals['PURCHASE_CONFIRMED'] + 
                          statusTotals['MANUFACTURED'];
    
    const inTransit = statusTotals['PURCHASE_CONFIRMED'] + 
                     statusTotals['MANUFACTURED'] + 
                     statusTotals['SHIPPED'];
    
    const needsAttention = statusTotals['QUOTE_REQUESTED'] + 
                          statusTotals['QUOTED'] + 
                          statusTotals['ANALYZING'] + 
                          statusTotals['PURCHASE_APPROVED'];
    
    // Obtener algunos ejemplos rápidos para cada status
    const examples = {};
    const priorityStatuses = ['NEEDS_REPLENISHMENT', 'QUOTE_REQUESTED', 'QUOTED', 'ANALYZING'];
    
    for (const status of priorityStatuses) {
      if (statusTotals[status] > 0) {
        const { data: examples_data } = await supabase
          .from('products')
          .select('sku, descripcion, stock_actual')
          .eq('status', status)
          .limit(3);
        
        examples[status] = examples_data || [];
      }
    }
    
    // Estructura de respuesta
    const stats = {
      summary: {
        totalProducts: totalProducts,
        activeWorkflow: activeWorkflow,
        inTransit: inTransit,
        needsAttention: needsAttention,
        noActionNeeded: statusTotals['NO_REPLENISHMENT_NEEDED']
      },
      statusBreakdown: statusTotals,
      examples: examples,
      workflowProgress: {
        pending: statusTotals['NEEDS_REPLENISHMENT'],
        inProcess: statusTotals['QUOTE_REQUESTED'] + statusTotals['QUOTED'] + statusTotals['ANALYZING'],
        approved: statusTotals['PURCHASE_APPROVED'] + statusTotals['PURCHASE_CONFIRMED'],
        manufacturing: statusTotals['MANUFACTURED'],
        shipped: statusTotals['SHIPPED'],
        completed: statusTotals['NO_REPLENISHMENT_NEEDED']
      }
    };
    
    // Cachear por 5 minutos (datos cambian poco)
    cache.set(cacheKey, stats, 5 * 60 * 1000);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Estadísticas calculadas en ${processingTime}ms`);
    
    return res.status(200).json({
      success: true,
      stats: stats,
      metadata: {
        fromCache: false,
        processingTime: `${processingTime}ms`,
        totalProducts: totalProducts
      }
    });
    
  } catch (error) {
    console.error('❌ Error en dashboard-stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stats: null
    });
  }
}