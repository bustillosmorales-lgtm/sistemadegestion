import axios from 'axios';
import supabase from './supabase';
import ML_CONFIG from './mercadolibre-config';

class MercadoLibreService {
  constructor() {
    this.config = ML_CONFIG;
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'sistemadegestion.net/1.0'
      }
    });
  }

  // =================== AUTENTICACIÓN ===================

  async saveTokensToDatabase(tokens) {
    try {
      const { data, error } = await supabase
        .from('ml_auth')
        .upsert({
          user_id: tokens.user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          scope: tokens.scope || 'read write',
          token_type: tokens.token_type || 'Bearer',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      
      console.log('✅ Tokens guardados exitosamente');
      return data;
    } catch (error) {
      console.error('❌ Error guardando tokens:', error);
      throw error;
    }
  }

  async getValidMlToken() {
    try {
      const { data: mlAuth, error } = await supabase
        .from('ml_auth')
        .select('*')
        .single();

      if (error || !mlAuth) {
        console.log('⚠️ No hay autenticación de ML disponible');
        return null;
      }

      const now = new Date();
      const expiresAt = new Date(mlAuth.expires_at);

      if (now >= expiresAt) {
        console.log('🔄 Token expirado, refrescando...');
        const newTokens = await this.refreshMlToken(mlAuth.refresh_token);
        
        if (newTokens) {
          const updatedAuth = await this.saveTokensToDatabase({
            user_id: mlAuth.user_id,
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || mlAuth.refresh_token,
            expires_at: new Date(Date.now() + (newTokens.expires_in * 1000)),
            scope: newTokens.scope || mlAuth.scope
          });
          
          return {
            ...mlAuth,
            access_token: newTokens.access_token
          };
        } else {
          console.error('❌ No se pudo refrescar el token');
          return null;
        }
      }

      return mlAuth;
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
      return null;
    }
  }

  async refreshMlToken(refresh_token) {
    try {
      const response = await this.axiosInstance.post(this.config.endpoints.token, {
        grant_type: 'refresh_token',
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
        refresh_token: refresh_token
      });

      console.log('✅ Token refrescado exitosamente');
      return response.data;
    } catch (error) {
      console.error('❌ Error refrescando token:', error.response?.data || error.message);
      return null;
    }
  }

  async exchangeCodeForTokens(code) {
    try {
      const response = await this.axiosInstance.post(this.config.endpoints.token, {
        grant_type: 'authorization_code',
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
        code: code,
        redirect_uri: this.config.redirect_uri
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error intercambiando código por tokens:', error.response?.data || error.message);
      throw error;
    }
  }

  // =================== ÓRDENES ===================

  async getOrders(options = {}) {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const params = {
        seller: mlAuth.user_id,
        sort: options.sort || 'date_desc',
        limit: options.limit || 50,
        offset: options.offset || 0,
        ...options.filters
      };

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.orders}/search`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` },
          params: params
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo órdenes:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOrderById(orderId) {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.orders}/${orderId}`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`❌ Error obteniendo orden ${orderId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async saveOrderToSystem(orderData) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .upsert({
          external_id: orderData.external_id,
          platform: orderData.platform,
          total_amount: orderData.total_amount,
          currency_id: orderData.currency_id,
          status: orderData.status,
          status_detail: orderData.status_detail,
          date_created: orderData.date_created,
          date_closed: orderData.date_closed,
          last_updated: orderData.last_updated,
          expiration_date: orderData.expiration_date,
          buyer_data: orderData.buyer_data,
          seller_data: orderData.seller_data,
          shipping_data: orderData.shipping_data,
          payment_data: orderData.payment_data,
          items: orderData.items,
          tags: orderData.tags,
          feedback: orderData.feedback,
          context: orderData.context,
          raw_data: orderData.raw_data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'external_id'
        });

      if (error) throw error;

      console.log(`✅ Orden ${orderData.external_id} guardada exitosamente`);
      return data;
    } catch (error) {
      console.error('❌ Error guardando orden:', error);
      throw error;
    }
  }

  convertMlOrderToSystemFormat(mlOrder) {
    return {
      external_id: mlOrder.id.toString(),
      platform: 'mercadolibre',
      total_amount: mlOrder.total_amount,
      currency_id: mlOrder.currency_id,
      status: mlOrder.status,
      status_detail: mlOrder.status_detail?.description || null,
      date_created: mlOrder.date_created,
      date_closed: mlOrder.date_closed,
      last_updated: mlOrder.last_updated,
      expiration_date: mlOrder.expiration_date,
      buyer_data: {
        id: mlOrder.buyer.id,
        nickname: mlOrder.buyer.nickname,
        email: mlOrder.buyer.email,
        phone: mlOrder.buyer.phone ? {
          area_code: mlOrder.buyer.phone.area_code,
          number: mlOrder.buyer.phone.number,
          extension: mlOrder.buyer.phone.extension
        } : null,
        first_name: mlOrder.buyer.first_name,
        last_name: mlOrder.buyer.last_name,
        billing_info: mlOrder.buyer.billing_info || null
      },
      seller_data: {
        id: mlOrder.seller.id,
        nickname: mlOrder.seller.nickname,
        email: mlOrder.seller.email
      },
      shipping_data: mlOrder.shipping ? {
        id: mlOrder.shipping.id,
        mode: mlOrder.shipping.mode,
        method: mlOrder.shipping.method,
        status: mlOrder.shipping.status,
        cost: mlOrder.shipping.cost,
        currency_id: mlOrder.shipping.currency_id,
        receiver_address: mlOrder.shipping.receiver_address,
        sender_address: mlOrder.shipping.sender_address
      } : null,
      payment_data: mlOrder.payments?.length > 0 ? mlOrder.payments.map(payment => ({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        payment_method_id: payment.payment_method_id,
        payment_type_id: payment.payment_type_id,
        transaction_amount: payment.transaction_amount,
        currency_id: payment.currency_id,
        date_created: payment.date_created,
        date_last_modified: payment.date_last_modified
      })) : null,
      items: mlOrder.order_items.map(item => ({
        id: item.item.id,
        title: item.item.title,
        category_id: item.item.category_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        currency_id: item.currency_id,
        variation_id: item.item.variation_id,
        variation_attributes: item.item.variation_attributes || []
      })),
      tags: mlOrder.tags || [],
      feedback: {
        purchase: mlOrder.feedback?.purchase || null,
        sale: mlOrder.feedback?.sale || null
      },
      context: {
        channel: mlOrder.context?.channel || null,
        site: mlOrder.context?.site || null,
        flows: mlOrder.context?.flows || []
      },
      raw_data: mlOrder
    };
  }

  // =================== MENSAJES ===================

  async getMessages(options = {}) {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const params = {
        limit: options.limit || 50,
        offset: options.offset || 0,
        ...options.filters
      };

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.messages}/inbox`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` },
          params: params
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo mensajes:', error.response?.data || error.message);
      throw error;
    }
  }

  async getMessageById(messageId) {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.messages}/${messageId}`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`❌ Error obteniendo mensaje ${messageId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async saveMessageToSystem(messageData) {
    try {
      const { data, error } = await supabase
        .from('ml_messages')
        .upsert({
          external_id: messageData.external_id,
          order_id: messageData.order_id,
          from_user_id: messageData.from_user_id,
          to_user_id: messageData.to_user_id,
          subject: messageData.subject,
          message_text: messageData.message_text,
          message_date: messageData.message_date,
          status: messageData.status,
          moderation_status: messageData.moderation_status,
          site_id: messageData.site_id,
          attachments: messageData.attachments,
          raw_data: messageData.raw_data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'external_id'
        });

      if (error) throw error;

      console.log(`✅ Mensaje ${messageData.external_id} guardado exitosamente`);
      return data;
    } catch (error) {
      console.error('❌ Error guardando mensaje:', error);
      throw error;
    }
  }

  // =================== ITEMS/PRODUCTOS ===================

  async getItemById(itemId) {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.items}/${itemId}`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`❌ Error obteniendo item ${itemId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async saveItemToSystem(itemData) {
    try {
      const { data, error } = await supabase
        .from('ml_items')
        .upsert({
          external_id: itemData.external_id,
          title: itemData.title,
          category_id: itemData.category_id,
          price: itemData.price,
          currency_id: itemData.currency_id,
          available_quantity: itemData.available_quantity,
          sold_quantity: itemData.sold_quantity,
          condition: itemData.condition,
          listing_type_id: itemData.listing_type_id,
          status: itemData.status,
          permalink: itemData.permalink,
          thumbnail: itemData.thumbnail,
          pictures: itemData.pictures,
          attributes: itemData.attributes,
          variations: itemData.variations,
          shipping_info: itemData.shipping_info,
          seller_info: itemData.seller_info,
          raw_data: itemData.raw_data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'external_id'
        });

      if (error) throw error;

      console.log(`✅ Item ${itemData.external_id} guardado exitosamente`);
      return data;
    } catch (error) {
      console.error('❌ Error guardando item:', error);
      throw error;
    }
  }

  // =================== SHIPMENTS/ENVÍOS ===================

  async getShipmentById(shipmentId) {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.shipments}/${shipmentId}`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`❌ Error obteniendo envío ${shipmentId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async saveShipmentToSystem(shipmentData) {
    try {
      const { data, error } = await supabase
        .from('ml_shipments')
        .upsert({
          external_id: shipmentData.external_id,
          order_id: shipmentData.order_id,
          status: shipmentData.status,
          substatus: shipmentData.substatus,
          mode: shipmentData.mode,
          shipping_option_id: shipmentData.shipping_option_id,
          date_created: shipmentData.date_created,
          last_updated: shipmentData.last_updated,
          cost: shipmentData.cost,
          currency_id: shipmentData.currency_id,
          receiver_address: shipmentData.receiver_address,
          sender_address: shipmentData.sender_address,
          tracking_number: shipmentData.tracking_number,
          tracking_method: shipmentData.tracking_method,
          service_id: shipmentData.service_id,
          comments: shipmentData.comments,
          raw_data: shipmentData.raw_data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'external_id'
        });

      if (error) throw error;

      console.log(`✅ Envío ${shipmentData.external_id} guardado exitosamente`);
      return data;
    } catch (error) {
      console.error('❌ Error guardando envío:', error);
      throw error;
    }
  }

  // =================== UTILIDADES ===================

  async logWebhook(webhook, status = 'pending', error = null) {
    try {
      const { data, error: dbError } = await supabase
        .from('webhook_logs')
        .insert({
          topic: webhook.topic,
          resource: webhook.resource,
          user_id: webhook.user_id,
          application_id: webhook.application_id,
          status: status,
          error_message: error,
          raw_data: webhook,
          processed_at: status === 'processed' ? new Date().toISOString() : null
        });

      if (dbError) throw dbError;
      return data;
    } catch (error) {
      console.error('❌ Error logging webhook:', error);
    }
  }

  async getUserInfo() {
    try {
      const mlAuth = await this.getValidMlToken();
      if (!mlAuth) throw new Error('No hay autorización válida');

      const response = await this.axiosInstance.get(
        `${this.config.endpoints.users}/${mlAuth.user_id}`,
        {
          headers: { 'Authorization': `Bearer ${mlAuth.access_token}` }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo información del usuario:', error.response?.data || error.message);
      throw error;
    }
  }

  getAuthUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      state: Math.random().toString(36).substring(7) // Estado aleatorio para seguridad
    });

    return `${this.config.endpoints.auth}?${params.toString()}`;
  }

  getAuthUrlWithPKCE(codeChallenge, sessionId) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: sessionId // Usamos sessionId como state para recuperar el code_verifier
    });

    return `${this.config.endpoints.auth}?${params.toString()}`;
  }

  async exchangeCodeForTokensWithPKCE(code, codeVerifier) {
    try {
      const response = await this.axiosInstance.post(this.config.endpoints.token, {
        grant_type: 'authorization_code',
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
        code: code,
        redirect_uri: this.config.redirect_uri,
        code_verifier: codeVerifier
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error intercambiando código por tokens (PKCE):', error.response?.data || error.message);
      throw error;
    }
  }
}

export default new MercadoLibreService();