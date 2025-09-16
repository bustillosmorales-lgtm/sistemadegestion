require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  // Solo aceptar POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const notification = req.body;
    
    console.log('🔔 Webhook recibido de MercadoLibre:', JSON.stringify(notification, null, 2));

    // Responder inmediatamente a MercadoLibre (CRÍTICO)
    res.status(200).send('OK');

    // Validar estructura de la notificación
    if (!notification.topic || !notification.resource) {
      console.error('❌ Notificación inválida: falta topic o resource');
      return;
    }

    // Log inicial del webhook
    await mlService.logWebhook(notification, 'received');

    // Procesar notificación de forma asíncrona
    processNotificationAsync(notification);

  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    // Siempre responder OK a MercadoLibre, incluso en caso de error
    res.status(200).send('OK');
  }
}

// Procesar notificación de forma asíncrona
async function processNotificationAsync(notification) {
  try {
    const { topic, resource, user_id, application_id } = notification;

    console.log(`🔄 Procesando notificación: ${topic} - ${resource}`);

    // Verificar que la notificación es para nuestra aplicación
    if (application_id && application_id !== process.env.ML_CLIENT_ID) {
      console.log('⚠️ Notificación no es para nuestra aplicación');
      await mlService.logWebhook(notification, 'ignored', 'No es para nuestra aplicación');
      return;
    }

    // Procesar según el tipo de notificación
    switch (topic) {
      case 'orders_v2':
      case 'orders':
        await handleOrderNotification(resource, user_id, notification);
        break;
      
      case 'messages':
        await handleMessageNotification(resource, user_id, notification);
        break;
      
      case 'items':
        await handleItemNotification(resource, user_id, notification);
        break;
      
      case 'shipments':
        await handleShipmentNotification(resource, user_id, notification);
        break;
      
      case 'promotions':
        await handlePromotionNotification(resource, user_id, notification);
        break;

      case 'prices':
        await handlePriceNotification(resource, user_id, notification);
        break;

      case 'catalog':
        await handleCatalogNotification(resource, user_id, notification);
        break;
      
      default:
        console.log(`⚠️ Tipo de notificación no manejada: ${topic}`);
        await mlService.logWebhook(notification, 'unhandled', `Tipo no manejado: ${topic}`);
    }

    // Marcar como procesado exitosamente
    await mlService.logWebhook(notification, 'processed');

  } catch (error) {
    console.error('❌ Error procesando notificación:', error);
    await mlService.logWebhook(notification, 'error', error.message);
  }
}

// =================== HANDLERS ESPECÍFICOS ===================

async function handleOrderNotification(resource, user_id, notification) {
  try {
    console.log(`📦 Procesando orden: ${resource}`);

    // Obtener detalles completos de la orden
    const mlOrder = await mlService.getOrderById(resource);
    
    console.log(`📋 Orden ${mlOrder.id} - Estado: ${mlOrder.status}`);

    // Convertir y guardar/actualizar orden
    const orderData = mlService.convertMlOrderToSystemFormat(mlOrder);
    await mlService.saveOrderToSystem(orderData);

    // Manejar acciones específicas según el estado
    await handleOrderStatusActions(mlOrder);

    console.log(`✅ Orden ${mlOrder.id} procesada exitosamente`);

  } catch (error) {
    console.error('❌ Error manejando notificación de orden:', error.response?.data || error.message);
    throw error;
  }
}

async function handleOrderStatusActions(mlOrder) {
  try {
    const orderId = mlOrder.id;
    const status = mlOrder.status;
    const buyerNickname = mlOrder.buyer.nickname;

    console.log(`🎯 Ejecutando acciones para orden ${orderId} en estado: ${status}`);

    switch (status) {
      case 'confirmed':
        console.log(`🆕 Nueva orden confirmada: ${orderId} de ${buyerNickname}`);
        await createSystemNotification({
          type: 'new_order',
          title: 'Nueva orden confirmada',
          message: `Orden #${orderId} de ${buyerNickname} por $${mlOrder.total_amount}`,
          data: { order_id: orderId, amount: mlOrder.total_amount },
          priority: 'high'
        });
        break;

      case 'payment_required':
        console.log(`💰 Orden requiere pago: ${orderId}`);
        await createSystemNotification({
          type: 'payment_required',
          title: 'Pago pendiente',
          message: `Orden #${orderId} requiere confirmación de pago`,
          data: { order_id: orderId }
        });
        break;

      case 'payment_in_process':
        console.log(`⏳ Pago en proceso: ${orderId}`);
        await createSystemNotification({
          type: 'payment_processing',
          title: 'Pago en proceso',
          message: `El pago de la orden #${orderId} está siendo procesado`,
          data: { order_id: orderId }
        });
        break;

      case 'paid':
        console.log(`✅ Orden pagada: ${orderId}`);
        await createSystemNotification({
          type: 'order_paid',
          title: 'Orden pagada',
          message: `¡Orden #${orderId} ha sido pagada! Lista para envío`,
          data: { order_id: orderId },
          priority: 'high'
        });
        break;

      case 'shipped':
        console.log(`🚚 Orden enviada: ${orderId}`);
        await createSystemNotification({
          type: 'order_shipped',
          title: 'Orden enviada',
          message: `Orden #${orderId} ha sido despachada`,
          data: { order_id: orderId }
        });
        break;

      case 'delivered':
        console.log(`📦 Orden entregada: ${orderId}`);
        await createSystemNotification({
          type: 'order_delivered',
          title: 'Orden entregada',
          message: `¡Orden #${orderId} fue entregada exitosamente!`,
          data: { order_id: orderId },
          priority: 'high'
        });
        break;

      case 'cancelled':
        console.log(`❌ Orden cancelada: ${orderId}`);
        await createSystemNotification({
          type: 'order_cancelled',
          title: 'Orden cancelada',
          message: `Orden #${orderId} ha sido cancelada`,
          data: { order_id: orderId },
          priority: 'medium'
        });
        break;

      default:
        console.log(`📝 Estado de orden actualizado: ${status} para orden ${orderId}`);
    }
  } catch (error) {
    console.error('❌ Error ejecutando acciones de estado:', error);
  }
}

async function handleMessageNotification(resource, user_id, notification) {
  try {
    console.log(`💬 Procesando mensaje: ${resource}`);

    const message = await mlService.getMessageById(resource);
    
    // Convertir y guardar mensaje
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

    // Crear notificación del sistema
    await createSystemNotification({
      type: 'new_message',
      title: 'Nuevo mensaje',
      message: `Mensaje de ${message.from.nickname}: ${message.subject}`,
      data: { 
        message_id: message.id,
        from: message.from.nickname,
        order_id: message.context?.order_id 
      },
      priority: 'medium'
    });

    console.log(`✅ Mensaje ${message.id} procesado exitosamente`);

  } catch (error) {
    console.error('❌ Error manejando notificación de mensaje:', error.response?.data || error.message);
    throw error;
  }
}

async function handleItemNotification(resource, user_id, notification) {
  try {
    console.log(`🏷️ Procesando item: ${resource}`);

    const item = await mlService.getItemById(resource);
    
    // Convertir y guardar item
    const itemData = {
      external_id: item.id,
      title: item.title,
      category_id: item.category_id,
      price: item.price,
      currency_id: item.currency_id,
      available_quantity: item.available_quantity,
      sold_quantity: item.sold_quantity,
      condition: item.condition,
      listing_type_id: item.listing_type_id,
      status: item.status,
      permalink: item.permalink,
      thumbnail: item.thumbnail,
      pictures: item.pictures || [],
      attributes: item.attributes || [],
      variations: item.variations || [],
      shipping_info: item.shipping || {},
      seller_info: item.seller_id ? { id: item.seller_id } : {},
      raw_data: item
    };

    await mlService.saveItemToSystem(itemData);

    // Notificar cambios importantes
    if (item.status === 'paused') {
      await createSystemNotification({
        type: 'item_paused',
        title: 'Producto pausado',
        message: `El producto "${item.title}" ha sido pausado`,
        data: { item_id: item.id },
        priority: 'medium'
      });
    } else if (item.available_quantity === 0) {
      await createSystemNotification({
        type: 'item_out_of_stock',
        title: 'Producto sin stock',
        message: `El producto "${item.title}" se quedó sin stock`,
        data: { item_id: item.id },
        priority: 'high'
      });
    }

    console.log(`✅ Item ${item.id} procesado exitosamente`);

  } catch (error) {
    console.error('❌ Error manejando notificación de item:', error.response?.data || error.message);
    throw error;
  }
}

async function handleShipmentNotification(resource, user_id, notification) {
  try {
    console.log(`🚚 Procesando envío: ${resource}`);

    const shipment = await mlService.getShipmentById(resource);
    
    // Convertir y guardar envío
    const shipmentData = {
      external_id: shipment.id.toString(),
      order_id: shipment.order_id?.toString() || null,
      status: shipment.status,
      substatus: shipment.substatus,
      mode: shipment.mode,
      shipping_option_id: shipment.shipping_option?.id || null,
      date_created: shipment.date_created,
      last_updated: shipment.last_updated,
      cost: shipment.cost,
      currency_id: shipment.currency_id,
      receiver_address: shipment.receiver_address || {},
      sender_address: shipment.sender_address || {},
      tracking_number: shipment.tracking_number,
      tracking_method: shipment.tracking_method,
      service_id: shipment.service_id,
      comments: shipment.comments,
      raw_data: shipment
    };

    await mlService.saveShipmentToSystem(shipmentData);

    // Notificar cambios importantes de envío
    if (shipment.status === 'ready_to_ship') {
      await createSystemNotification({
        type: 'shipment_ready',
        title: 'Envío listo',
        message: `Envío #${shipment.id} listo para despachar`,
        data: { shipment_id: shipment.id, order_id: shipment.order_id },
        priority: 'high'
      });
    } else if (shipment.status === 'delivered') {
      await createSystemNotification({
        type: 'shipment_delivered',
        title: 'Envío entregado',
        message: `¡Envío #${shipment.id} fue entregado exitosamente!`,
        data: { shipment_id: shipment.id, order_id: shipment.order_id },
        priority: 'medium'
      });
    }

    console.log(`✅ Envío ${shipment.id} procesado exitosamente`);

  } catch (error) {
    console.error('❌ Error manejando notificación de envío:', error.response?.data || error.message);
    throw error;
  }
}

async function handlePromotionNotification(resource, user_id, notification) {
  try {
    console.log(`🎉 Procesando promoción: ${resource}`);

    // Las promociones pueden tener diferentes endpoints según el tipo
    // Por ahora logeamos la notificación para análisis futuro
    await createSystemNotification({
      type: 'promotion_update',
      title: 'Actualización de promoción',
      message: `Promoción ${resource} actualizada`,
      data: { promotion_id: resource },
      priority: 'low'
    });

    console.log(`✅ Promoción ${resource} procesada`);

  } catch (error) {
    console.error('❌ Error manejando notificación de promoción:', error);
    throw error;
  }
}

async function handlePriceNotification(resource, user_id, notification) {
  try {
    console.log(`💰 Procesando cambio de precio: ${resource}`);

    await createSystemNotification({
      type: 'price_update',
      title: 'Cambio de precio',
      message: `Precio actualizado para producto ${resource}`,
      data: { item_id: resource },
      priority: 'medium'
    });

    console.log(`✅ Cambio de precio ${resource} procesado`);

  } catch (error) {
    console.error('❌ Error manejando notificación de precio:', error);
    throw error;
  }
}

async function handleCatalogNotification(resource, user_id, notification) {
  try {
    console.log(`📋 Procesando cambio de catálogo: ${resource}`);

    await createSystemNotification({
      type: 'catalog_update',
      title: 'Actualización de catálogo',
      message: `Catálogo ${resource} actualizado`,
      data: { catalog_id: resource },
      priority: 'low'
    });

    console.log(`✅ Cambio de catálogo ${resource} procesado`);

  } catch (error) {
    console.error('❌ Error manejando notificación de catálogo:', error);
    throw error;
  }
}

// Función auxiliar para crear notificaciones del sistema
async function createSystemNotification(notificationData) {
  try {
    const supabase = require('../../../lib/supabase');
    
    const { data, error } = await supabase
      .from('system_notifications')
      .insert({
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        priority: notificationData.priority || 'normal',
        expires_at: notificationData.expires_at || null
      });

    if (error) throw error;
    
    console.log(`🔔 Notificación del sistema creada: ${notificationData.title}`);
    return data;
  } catch (error) {
    console.error('❌ Error creando notificación del sistema:', error);
  }
}