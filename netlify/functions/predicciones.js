/**
 * Netlify Function: Obtener predicciones de inventario (SEGURA)
 * GET /api/predicciones
 * Requiere autenticación JWT
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');
const { prediccionesQuerySchema, validateInput } = require('./lib/validation');

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const origin = event.headers.origin || '';
  const headers = getCorsHeaders(origin);

  // Manejar preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Solo permitir GET
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

  // Agregar headers de rate limit a las respuestas
  const rateLimitHeaders = auth.rateLimit ? {
    'X-RateLimit-Limit': String(auth.rateLimit.limit),
    'X-RateLimit-Remaining': String(auth.rateLimit.remaining),
    'X-RateLimit-Reset': String(auth.rateLimit.resetIn)
  } : {};

  try {
    // Parsear query params
    const params = event.queryStringParameters || {};
    
    // Validar query params
    const validation = validateInput(prediccionesQuerySchema, params);
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

    const sku = validatedParams.sku;
    const clasificacion_abc = validatedParams.clasificacion_abc;
    const limit = validatedParams.limit || 100;
    const offset = validatedParams.offset || 0;

    // Construir query
    let query = supabase
      .from('predicciones')
      .select('*')
      .order('valor_total_sugerencia', { ascending: false });

    // Filtrar por última fecha de cálculo
    const { data: latestDate } = await supabase
      .from('predicciones')
      .select('fecha_calculo')
      .order('fecha_calculo', { ascending: false })
      .limit(1)
      .single();

    if (latestDate) {
      query = query.eq('fecha_calculo', latestDate.fecha_calculo);
    }

    // Aplicar filtros
    if (sku) {
      query = query.eq('sku', sku);
    }

    if (clasificacion_abc) {
      query = query.eq('clasificacion_abc', clasificacion_abc.toUpperCase());
    }

    // Paginación
    query = query.range(offset, offset + limit - 1);

    // Ejecutar query
    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Respuesta exitosa
    return {
      statusCode: 200,
      headers: { ...headers, ...rateLimitHeaders },
      body: JSON.stringify({
        success: true,
        data: data || [],
        count: data?.length || 0,
        total: count,
        pagination: {
          limit,
          offset,
          hasMore: count > offset + limit
        }
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
