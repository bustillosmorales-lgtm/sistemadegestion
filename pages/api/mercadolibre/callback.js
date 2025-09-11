require('dotenv').config();
const mlService = require('../../../lib/mercadolibre-service');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { code, state, error: authError } = req.query;
    
    // Verificar si hubo error en la autorización
    if (authError) {
      console.error('❌ Error en autorización ML:', authError);
      return res.status(400).json({ 
        error: 'Error en autorización',
        details: authError
      });
    }
    
    // Verificar que se recibió el código
    if (!code) {
      console.error('❌ Código de autorización no recibido');
      return res.status(400).json({ 
        error: 'Código de autorización no recibido' 
      });
    }

    console.log('🔄 Intercambiando código por tokens con PKCE...');

    // Recuperar code_verifier usando el state (sessionId)
    const sessionId = state;
    if (!sessionId) {
      throw new Error('Session ID (state) no recibido para PKCE');
    }

    const supabase = require('../../../lib/supabase');
    const { data: pkceSession, error: pkceError } = await supabase
      .from('oauth_pkce_sessions')
      .select('code_verifier')
      .eq('session_id', sessionId)
      .single();

    if (pkceError || !pkceSession) {
      console.error('❌ PKCE session no encontrada:', pkceError);
      throw new Error('Sesión PKCE expirada o no válida');
    }

    // Intercambiar código por tokens usando PKCE
    const tokenData = await mlService.exchangeCodeForTokensWithPKCE(code, pkceSession.code_verifier);

    // Limpiar la sesión PKCE usada
    await supabase
      .from('oauth_pkce_sessions')
      .delete()
      .eq('session_id', sessionId);
    
    const { access_token, refresh_token, user_id, expires_in, scope } = tokenData;
    
    // Calcular fecha de expiración
    const expires_at = new Date(Date.now() + (expires_in * 1000));

    // Guardar tokens en la base de datos
    await mlService.saveTokensToDatabase({
      user_id,
      access_token,
      refresh_token,
      expires_at,
      scope: scope || 'read write'
    });

    console.log('✅ Conexión con MercadoLibre establecida exitosamente');
    console.log(`📊 Usuario ML ID: ${user_id}`);
    console.log(`⏰ Token expira: ${expires_at.toLocaleString()}`);

    // Obtener información básica del usuario para confirmar
    try {
      const userInfo = await mlService.getUserInfo();
      console.log(`👤 Usuario conectado: ${userInfo.nickname} (${userInfo.email})`);
      
      res.status(200).json({
        success: true,
        message: 'Conexión exitosa con MercadoLibre Chile',
        user: {
          id: userInfo.id,
          nickname: userInfo.nickname,
          email: userInfo.email,
          country_id: userInfo.country_id,
          site_id: userInfo.site_id
        },
        connection: {
          expires_at: expires_at.toISOString(),
          expires_in: expires_in,
          scope: scope
        }
      });
      
    } catch (userError) {
      console.warn('⚠️ No se pudo obtener info del usuario, pero tokens guardados');
      res.status(200).json({
        success: true,
        message: 'Conexión exitosa con MercadoLibre Chile',
        user_id: user_id,
        expires_at: expires_at.toISOString(),
        expires_in: expires_in,
        scope: scope
      });
    }

  } catch (error) {
    console.error('❌ Error en callback ML:', error.response?.data || error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Determinar el tipo de error específico
    let errorDetails = 'Error interno del servidor';
    if (error.response?.data) {
      errorDetails = error.response.data;
      console.error('❌ MercadoLibre API Error:', JSON.stringify(error.response.data, null, 2));
    } else if (error.message) {
      errorDetails = error.message;
      console.error('❌ Error message:', error.message);
    }
    
    res.status(500).json({
      error: 'Error al establecer conexión con MercadoLibre',
      details: errorDetails,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        response: error.response?.data,
        code: error.code
      } : undefined
    });
  }
}