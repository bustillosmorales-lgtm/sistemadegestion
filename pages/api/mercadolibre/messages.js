require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('📬 Sincronizando mensajes de MercadoLibre...');
    
    // Verificar autorización
    const mlAuth = await mlService.getValidMlToken();
    if (!mlAuth) {
      return res.status(401).json({
        error: 'No hay autorización válida con MercadoLibre',
        action: 'Necesitas reconectar tu cuenta'
      });
    }

    // Parámetros de consulta
    const {
      limit = 20,
      offset = 0,
      order_id
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: {}
    };

    if (order_id) options.filters.order_id = order_id;

    console.log('📥 Obteniendo mensajes...');
    
    // Obtener mensajes de MercadoLibre
    const messagesResponse = await mlService.getMessages(options);
    const messages = messagesResponse.results || [];
    
    console.log(`📬 Encontrados ${messages.length} mensajes`);

    const syncedMessages = [];
    const errors = [];

    // Procesar cada mensaje
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
        syncedMessages.push({
          id: message.id,
          subject: message.subject,
          from: message.from.nickname,
          date: message.message_date?.created
        });
        
        console.log(`✅ Mensaje ${message.id} sincronizado`);
        
      } catch (messageError) {
        console.error(`❌ Error procesando mensaje ${message.id}:`, messageError.message);
        errors.push({
          message_id: message.id,
          error: messageError.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `${syncedMessages.length} mensajes sincronizados`,
      synced_count: syncedMessages.length,
      total_found: messages.length,
      messages: syncedMessages,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error sincronizando mensajes:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Error al sincronizar mensajes',
      details: process.env.NODE_ENV === 'development' ? 
        (error.response?.data || error.message) : undefined
    });
  }
}