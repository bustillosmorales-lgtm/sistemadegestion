// pages/api/dashboard-stats.js - Vista rápida por status sin cargar productos individuales
import { supabase } from '../../lib/supabaseClient';
import cache from '../../lib/cache';

export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 10,
}

export default async function handler(req, res) {
  const startTime = Date.now();
  const forceRefresh = req.query.nocache === 'true';

  try {
    // Buscar en cache primero (salvo que se fuerce refresh)
    const cacheKey = 'dashboard_stats_summary';
    const cachedStats = !forceRefresh ? cache.get(cacheKey) : null;
    
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

    // Consulta súper eficiente - solo contar por status con paginación
    let allStatusCounts = [];
    let pageSize = 1000;
    let currentPage = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: statusPage, error: statusError } = await supabase
        .from('products')
        .select('status, sku, descripcion, stock_actual, desconsiderado')
        .not('status', 'is', null)
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      if (statusError) {
        throw new Error('Error obteniendo conteos por status: ' + statusError.message);
      }

      if (statusPage && statusPage.length > 0) {
        allStatusCounts = allStatusCounts.concat(statusPage);

        if (statusPage.length < pageSize) {
          hasMore = false;
        } else {
          currentPage++;
        }
      } else {
        hasMore = false;
      }
    }

    const statusCounts = allStatusCounts;
    console.log(`📊 Total productos analizados: ${statusCounts.length}`);

    // Obtener recordatorios desde la tabla replenishment_reminders
    const { data: remindersData, error: remindersError } = await supabase
      .from('replenishment_reminders')
      .select('*')
      .eq('is_active', true)
      .order('reminder_date', { ascending: true });

    if (remindersError) {
      console.error('⚠️ Error obteniendo recordatorios:', remindersError);
    }

    const today = new Date().toISOString().split('T')[0];
    const activeReminders = (remindersData || []).filter(r => r.reminder_date > today);
    const reminderSkus = new Set(activeReminders.map(r => r.sku));

    console.log(`🔍 DEBUG: Recordatorios activos desde tabla: ${activeReminders.length}`);

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

    const reminderProducts = activeReminders.map(r => ({
      sku: r.sku,
      descripcion: r.product_description,
      stock_actual: null,
      remind_me_date: r.reminder_date,
      remind_me_comments: r.notes || ''
    }));

    let disregardedCount = 0;
    const disregardedProducts = [];

    (statusCounts || []).forEach(product => {
      const status = product.status;

      // Contar desconsiderados
      if (product.desconsiderado) {
        disregardedCount++;
        disregardedProducts.push({
          sku: product.sku,
          descripcion: product.descripcion,
          stock_actual: product.stock_actual
        });
      }

      // Filtrar recordatorios y desconsiderados de NEEDS_REPLENISHMENT
      if (status === 'NEEDS_REPLENISHMENT') {
        // No contar si tiene recordatorio activo
        if (reminderSkus.has(product.sku)) {
          return;
        }
        // No contar si está desconsiderado
        if (product.desconsiderado) {
          return;
        }
      }

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
        noActionNeeded: statusTotals['NO_REPLENISHMENT_NEEDED'],
        reminders: activeReminders.length,
        disregarded: disregardedCount
      },
      statusBreakdown: statusTotals,
      examples: examples,
      reminderProducts: reminderProducts,
      disregardedProducts: disregardedProducts,
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