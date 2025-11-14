/**
 * Netlify Function: Obtener alertas de inventario (SEGURA)
 * GET /api/alertas
 * Requiere autenticación JWT
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');
const { alertasQuerySchema, validateInput } = require('./lib/validation');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const origin = event.headers.origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verificar autenticación
  const auth = await verifyAuth(event);
  if (!auth.authenticated) {
    const statusCode = auth.rateLimitExceeded ? 429 : 401;
    return {
      statusCode,
      headers: {
        ...headers,
        ...(auth.rateLimit ? {
          'X-RateLimit-Limit': String(auth.rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(auth.rateLimit.resetIn),
          'Retry-After': String(auth.retryAfter || 60)
        } : {})
      },
      body: JSON.stringify({
        success: false,
        error: auth.error
      })
    };
  }

  // Agregar headers de rate limit
  const rateLimitHeaders = auth.rateLimit ? {
    'X-RateLimit-Limit': String(auth.rateLimit.limit),
    'X-RateLimit-Remaining': String(auth.rateLimit.remaining),
    'X-RateLimit-Reset': String(auth.rateLimit.resetIn)
  } : {};

  try {
    const params = event.queryStringParameters || {};
    
    const validation = validateInput(alertasQuerySchema, params);
    if (!validation.success) {
      return {
        statusCode: 400,
        headers: { ...headers, ...rateLimitHeaders },
        body: JSON.stringify({
          success: false,
          error: 'Invalid parameters',
          details: validation.errors
        })
      };
    }
    const validatedParams = validation.data;

    const tipo_alerta = validatedParams.tipo_alerta;
    const severidad = validatedParams.severidad;
    const estado = validatedParams.estado || 'activa';

    let query = supabase
      .from('alertas_inventario')
      .select('*')
      .eq('estado', estado)
      .order('fecha_alerta', { ascending: false })
      .limit(50000); // Supabase tiene límite por defecto de 1000

    if (tipo_alerta) {
      query = query.eq('tipo_alerta', tipo_alerta);
    }

    if (severidad) {
      query = query.eq('severidad', severidad);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Agrupar por severidad
    const resumen = {
      critica: data.filter(a => a.severidad === 'critica').length,
      alta: data.filter(a => a.severidad === 'alta').length,
      media: data.filter(a => a.severidad === 'media').length,
      baja: data.filter(a => a.severidad === 'baja').length,
      total: data.length
    };

    return {
      statusCode: 200,
      headers: { ...headers, ...rateLimitHeaders },
      body: JSON.stringify({
        success: true,
        resumen,
        alertas: data
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...headers, ...rateLimitHeaders },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
