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
        .select('status, sku, descripcion, stock_actual')
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

    // Definir today al inicio para asegurar disponibilidad
    const today = new Date().toISOString().split('T')[0];

    // Obtener recordatorios desde la tabla replenishment_reminders
    const { data: remindersData, error: remindersError } = await supabase
      .from('replenishment_reminders')
      .select('*')
      .eq('is_active', true)
      .order('reminder_date', { ascending: true});

    if (remindersError) {
      console.error('⚠️ Error obteniendo recordatorios:', remindersError);
    }

    const activeReminders = (remindersData || []).filter(r => r.reminder_date > today);
    const reminderSkus = new Set(activeReminders.map(r => r.sku));

    console.log(`🔍 DEBUG: Recordatorios activos desde tabla: ${activeReminders.length}`);

    // Obtener información de órdenes parciales
    const { data: partialOrdersData, error: partialOrdersError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual, primary_status, has_active_orders, total_cantidad_en_proceso')
      .eq('has_active_orders', true)
      .not('primary_status', 'in', '(RECEIVED,CANCELLED)');

    let partialOrdersCount = 0;
    const partialOrdersProducts = [];

    if (!partialOrdersError && partialOrdersData) {
      // Aquí necesitaríamos consultar purchase_orders para ver si son órdenes parciales
      // Por ahora simplemente contamos productos con órdenes activas
      partialOrdersCount = partialOrdersData.length;
      partialOrdersProducts.push(...partialOrdersData.map(p => ({
        sku: p.sku,
        descripcion: p.descripcion,
        stock_actual: p.stock_actual,
        status: p.primary_status,
        totalEnProceso: p.total_cantidad_en_proceso
      })));
    }

    console.log(`🔍 DEBUG: Productos con órdenes activas: ${partialOrdersCount}`);

    // Obtener productos desconsiderados (límite aumentado para mostrar todos)
    const { data: disregardedData, error: disregardedError } = await supabase
      .from('products')
      .select('sku, descripcion, stock_actual')
      .eq('desconsiderado', true)
      .limit(5000); // Límite alto para mostrar todos los desconsiderados

    let disregardedCount = 0;
    const disregardedProducts = [];

    if (!disregardedError && disregardedData) {
      disregardedCount = disregardedData.length;
      disregardedProducts.push(...disregardedData);
    }

    console.log(`🔍 DEBUG: Productos desconsiderados: ${disregardedCount}`);

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

    (statusCounts || []).forEach(product => {
      const status = product.status;

      // Filtrar recordatorios de NEEDS_REPLENISHMENT
      if (status === 'NEEDS_REPLENISHMENT') {
        // No contar si tiene recordatorio activo
        if (reminderSkus.has(product.sku)) {
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
        disregarded: disregardedCount,
        activeOrders: partialOrdersCount
      },
      statusBreakdown: statusTotals,
      examples: examples,
      reminderProducts: reminderProducts,
      disregardedProducts: disregardedProducts,
      activeOrdersProducts: partialOrdersProducts,
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