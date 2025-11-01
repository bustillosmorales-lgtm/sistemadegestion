/**
 * Netlify Function: Obtener predicciones de inventario
 * GET /api/predicciones
 * GET /api/predicciones/:sku
 */

const { createClient } = require('@supabase/supabase-js');

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Headers CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
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

  try {
    // Parsear query params
    const params = event.queryStringParameters || {};
    const sku = params.sku;
    const clasificacion_abc = params.clasificacion_abc;
    const limit = parseInt(params.limit || '100');
    const offset = parseInt(params.offset || '0');

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
      headers,
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
    console.error('Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
