require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🔄 Iniciando sincronización de órdenes...');
    
    // Verificar autorización
    const mlAuth = await mlService.getValidMlToken();
    if (!mlAuth) {
      return res.status(401).json({
        error: 'No hay autorización válida con MercadoLibre',
        action: 'Necesitas reconectar tu cuenta'
      });
    }

    // Parámetros de consulta opcionales
    const {
      limit = 50,
      offset = 0,
      status,
      date_from,
      date_to,
      sort = 'date_desc'
    } = req.query;

    // Configurar filtros
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
      filters: {}
    };

    if (status) options.filters.order_status = status;
    if (date_from) options.filters['order.date_created.from'] = date_from;
    if (date_to) options.filters['order.date_created.to'] = date_to;

    console.log('📥 Obteniendo órdenes de MercadoLibre...');
    console.log(`📊 Parámetros: limit=${limit}, offset=${offset}, sort=${sort}`);

    // Obtener órdenes de MercadoLibre
    const ordersResponse = await mlService.getOrders(options);
    const mlOrders = ordersResponse.results || [];
    
    console.log(`📦 Encontradas ${mlOrders.length} órdenes de ${ordersResponse.paging?.total || 0} total`);

    if (mlOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No se encontraron órdenes para sincronizar',
        synced_count: 0,
        total_found: 0,
        orders: []
      });
    }

    const syncedOrders = [];
    const errors = [];

    // Procesar cada orden
    for (const mlOrder of mlOrders) {
      try {
        console.log(`🔄 Procesando orden ${mlOrder.id}...`);
        
        // Convertir formato ML a formato interno
        const orderData = mlService.convertMlOrderToSystemFormat(mlOrder);
        
        // Guardar en la base de datos
        const savedOrder = await mlService.saveOrderToSystem(orderData);
        syncedOrders.push({
          id: mlOrder.id,
          status: mlOrder.status,
          total_amount: mlOrder.total_amount,
          date_created: mlOrder.date_created,
          buyer_nickname: mlOrder.buyer.nickname
        });
        
        console.log(`✅ Orden ${mlOrder.id} sincronizada`);
        
      } catch (orderError) {
        console.error(`❌ Error procesando orden ${mlOrder.id}:`, orderError.message);
        errors.push({
          order_id: mlOrder.id,
          error: orderError.message
        });
      }
    }

    // Estadísticas de sincronización
    const stats = {
      total_found: ordersResponse.paging?.total || mlOrders.length,
      processed: mlOrders.length,
      synced_successfully: syncedOrders.length,
      errors: errors.length,
      has_more: ordersResponse.paging ? 
        (ordersResponse.paging.offset + ordersResponse.paging.limit) < ordersResponse.paging.total : 
        false
    };

    console.log('📊 Sincronización completada:');
    console.log(`✅ Exitosas: ${stats.synced_successfully}`);
    console.log(`❌ Errores: ${stats.errors}`);
    console.log(`📄 Más páginas disponibles: ${stats.has_more}`);

    res.status(200).json({
      success: true,
      message: `Sincronización completada: ${stats.synced_successfully}/${stats.processed} órdenes`,
      stats,
      orders: syncedOrders,
      errors: errors.length > 0 ? errors : undefined,
      pagination: ordersResponse.paging
    });

  } catch (error) {
    console.error('❌ Error en sincronización de órdenes:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Error al sincronizar órdenes',
      details: process.env.NODE_ENV === 'development' ? 
        (error.response?.data || error.message) : 
        'Error interno del servidor'
    });
  }
}