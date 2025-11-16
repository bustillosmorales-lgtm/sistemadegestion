/**
 * Netlify Function: Obtener predicciones de inventario (SEGURA)
 * GET /api/predicciones
 * Requiere autenticación JWT
 *
 * ACTUALIZACIÓN: Ajusta sugerencias restando cotizaciones pendientes/aprobadas en tiempo real
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');
const { prediccionesQuerySchema, validateInput } = require('./lib/validation');

// Inicializar Supabase con SERVICE_KEY para bypasear límites
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
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
    const limit = validatedParams.limit || 10000; // Aumentar límite por defecto
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

    // NUEVO: Ajustar sugerencias restando cotizaciones pendientes/aprobadas
    // Esto asegura que las sugerencias estén actualizadas en tiempo real
    const { data: cotizaciones } = await supabase
      .from('cotizaciones')
      .select('sku, cantidad_cotizar, estado')
      .in('estado', ['pendiente', 'aprobada'])
      .is('fecha_carga_contenedor', null); // Solo las que no están en tránsito

    // Agrupar cotizaciones por SKU
    const cotizacionesPorSku = {};
    if (cotizaciones) {
      for (const cotizacion of cotizaciones) {
        if (!cotizacionesPorSku[cotizacion.sku]) {
          cotizacionesPorSku[cotizacion.sku] = 0;
        }
        cotizacionesPorSku[cotizacion.sku] += cotizacion.cantidad_cotizar || 0;
      }
    }

    // Ajustar sugerencias restando cotizaciones
    const dataAjustada = (data || []).map(prediccion => {
      const cantidadCotizada = cotizacionesPorSku[prediccion.sku] || 0;

      if (cantidadCotizada > 0) {
        // Restar cotizaciones de la sugerencia
        const sugerenciaAjustada = Math.max(0, prediccion.sugerencia_reposicion - cantidadCotizada);

        return {
          ...prediccion,
          sugerencia_reposicion: sugerenciaAjustada,
          sugerencia_reposicion_original: prediccion.sugerencia_reposicion,
          cantidad_cotizada: cantidadCotizada,
          valor_total_sugerencia: Math.round(sugerenciaAjustada * (prediccion.precio_unitario || 0))
        };
      }

      return prediccion;
    });

    // Respuesta exitosa
    return {
      statusCode: 200,
      headers: { ...headers, ...rateLimitHeaders },
      body: JSON.stringify({
        success: true,
        data: dataAjustada,
        count: dataAjustada?.length || 0,
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
