require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🔄 Iniciando sincronización completa de MercadoLibre...');
    
    // Verificar autorización
    const mlAuth = await mlService.getValidMlToken();
    if (!mlAuth) {
      return res.status(401).json({
        error: 'No hay autorización válida con MercadoLibre',
        action: 'Necesitas reconectar tu cuenta'
      });
    }

    const results = {
      orders: { synced: 0, errors: 0 },
      messages: { synced: 0, errors: 0 },
      started_at: new Date().toISOString(),
      completed_at: null
    };

    try {
      // 1. Sincronizar órdenes
      console.log('📦 Sincronizando órdenes...');
      const ordersResponse = await mlService.getOrders({ limit: 50 });
      const orders = ordersResponse.results || [];
      
      for (const mlOrder of orders) {
        try {
          const orderData = mlService.convertMlOrderToSystemFormat(mlOrder);
          await mlService.saveOrderToSystem(orderData);
          results.orders.synced++;
        } catch (error) {
          console.error(`Error procesando orden ${mlOrder.id}:`, error.message);
          results.orders.errors++;
        }
      }

      // 2. Sincronizar mensajes
      console.log('📬 Sincronizando mensajes...');
      const messagesResponse = await mlService.getMessages({ limit: 30 });
      const messages = messagesResponse.results || [];
      
      for (const message of messages) {
        try {
          const messageData = {
            external_id: message.id.toString(),
            order_id: message.context?.order_id || null,
            from_user_id: message.from.user_id,
            to_user_id: message.to?.user_id || null,
            subject: message.subject,
            message_text: message.text,
            message_date: message.message_date?.created,
            status: message.status,
            moderation_status: message.moderation_status,
            site_id: message.site_id,
            attachments: message.attachments || [],
            raw_data: message
          };

          await mlService.saveMessageToSystem(messageData);
          results.messages.synced++;
        } catch (error) {
          console.error(`Error procesando mensaje ${message.id}:`, error.message);
          results.messages.errors++;
        }
      }

      results.completed_at = new Date().toISOString();
      
      console.log('✅ Sincronización completa finalizada');
      console.log(`📊 Órdenes: ${results.orders.synced} sincronizadas, ${results.orders.errors} errores`);
      console.log(`📊 Mensajes: ${results.messages.synced} sincronizados, ${results.messages.errors} errores`);

      res.status(200).json({
        success: true,
        message: 'Sincronización completa finalizada',
        results: results,
        summary: {
          total_synced: results.orders.synced + results.messages.synced,
          total_errors: results.orders.errors + results.messages.errors,
          duration: new Date(results.completed_at) - new Date(results.started_at)
        }
      });

    } catch (syncError) {
      results.completed_at = new Date().toISOString();
      throw syncError;
    }

  } catch (error) {
    console.error('❌ Error en sincronización completa:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Error en sincronización completa',
      details: process.env.NODE_ENV === 'development' ? 
        (error.response?.data || error.message) : undefined,
      partial_results: results
    });
  }
}