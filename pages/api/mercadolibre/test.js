require('dotenv').config();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar variables de entorno necesarias
    const envChecks = {
      ml_client_id: process.env.ML_CLIENT_ID,
      ml_client_secret: process.env.ML_CLIENT_SECRET,
      ml_redirect_uri: process.env.ML_REDIRECT_URI,
      supabase_url: process.env.SUPABASE_URL,
      supabase_anon_key: process.env.SUPABASE_ANON_KEY
    };

    const missingVars = Object.entries(envChecks)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingVars.length > 0) {
      return res.status(500).json({
        error: 'Variables de entorno faltantes',
        missing: missingVars,
        action: 'Configura las variables de entorno en .env.local'
      });
    }

    // Verificar configuración de MercadoLibre
    const mlConfig = {
      client_id: process.env.ML_CLIENT_ID,
      redirect_uri: process.env.ML_REDIRECT_URI,
      api_base: process.env.ML_API_BASE || 'https://api.mercadolibre.com',
      auth_base: process.env.ML_AUTH_BASE || 'https://auth.mercadolibre.cl',
      country: process.env.ML_COUNTRY || 'CL'
    };

    // Verificar conexión a Supabase
    const supabase = require('../../../lib/supabase');
    const { data, error } = await supabase
      .from('ml_auth')
      .select('id')
      .limit(1);

    if (error) {
      return res.status(500).json({
        error: 'Error conectando a Supabase',
        details: error.message,
        action: 'Verifica las credenciales de Supabase y que las tablas estén creadas'
      });
    }

    // Todo está configurado correctamente
    res.status(200).json({
      success: true,
      message: '✅ Integración MercadoLibre configurada correctamente',
      configuration: {
        ml_client_id: mlConfig.client_id,
        ml_country: mlConfig.country,
        ml_redirect_uri: mlConfig.redirect_uri,
        supabase_connected: true,
        api_endpoints: {
          auth: '/api/mercadolibre/auth',
          callback: '/api/mercadolibre/callback',
          status: '/api/mercadolibre/status',
          sync_orders: '/api/mercadolibre/sync-orders',
          webhooks: '/api/webhooks/mercadolibre'
        }
      },
      next_steps: [
        '1. Configura las URLs en MercadoLibre Developers',
        '2. Ejecuta las tablas SQL en Supabase (scripts/supabase-setup.sql)',
        '3. Inicia autorización con /api/mercadolibre/auth',
        '4. Configura webhooks en MercadoLibre'
      ]
    });

  } catch (error) {
    console.error('❌ Error en test de configuración:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}