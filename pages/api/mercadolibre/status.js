require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🔍 Verificando estado de conexión con MercadoLibre...');
    
    // Obtener token válido (incluye refresh automático si es necesario)
    const mlAuth = await mlService.getValidMlToken();
    
    if (!mlAuth) {
      console.log('❌ No hay conexión activa con MercadoLibre');
      return res.status(200).json({
        connected: false,
        message: 'No hay conexión activa con MercadoLibre',
        action: 'Necesitas autorizar la aplicación'
      });
    }

    // Probar la conexión haciendo una llamada a la API
    try {
      const userInfo = await mlService.getUserInfo();
      
      console.log(`✅ Conexión activa: ${userInfo.nickname}`);
      
      res.status(200).json({
        connected: true,
        user: {
          id: userInfo.id,
          nickname: userInfo.nickname,
          email: userInfo.email,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          country_id: userInfo.country_id,
          site_id: userInfo.site_id,
          user_type: userInfo.user_type,
          registration_date: userInfo.registration_date
        },
        connection: {
          expires_at: mlAuth.expires_at,
          scope: mlAuth.scope,
          last_updated: mlAuth.updated_at
        }
      });
      
    } catch (apiError) {
      console.error('❌ Error al verificar API:', apiError.response?.data || apiError.message);
      
      // Token existe pero no funciona - posiblemente revocado
      res.status(200).json({
        connected: false,
        error: 'Token inválido o revocado',
        message: 'La conexión existe pero no es válida',
        action: 'Necesitas reautorizar la aplicación'
      });
    }

  } catch (error) {
    console.error('❌ Error verificando estado:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}