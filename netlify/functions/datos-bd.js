/**
 * Obtiene datos crudos de la BD para exportación y validación
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');
const { handleError } = require('./lib/error-handler');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsHeaders = getCorsHeaders(origin);

  // Manejar preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Solo permitir GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Verificar autenticación
    const auth = await verifyAuth(event);
    if (!auth.authenticated) {
      const statusCode = auth.rateLimitExceeded ? 429 : 401;
      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({
          error: auth.error,
          ...(auth.rateLimitExceeded && { retryAfter: auth.retryAfter })
        })
      };
    }

    // Obtener parámetro de query string
    const tabla = event.queryStringParameters?.tabla;

    if (!tabla) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Parámetro "tabla" requerido' })
      };
    }

    console.log(`[datos-bd] Solicitando tabla: ${tabla}`);

    let query;

    switch (tabla) {
      case 'ventas':
        // Reducir a 2000 para evitar timeout
        query = supabase
          .from('ventas_historicas')
          .select('empresa, canal, fecha, sku, mlc, descripcion, unidades, precio')
          .order('fecha', { ascending: false })
          .limit(2000);
        break;

      case 'stock':
        query = supabase
          .from('stock_actual')
          .select('sku, descripcion, bodega_c, bodega_d, bodega_e, bodega_f, bodega_h, bodega_j')
          .order('sku');
        break;

      case 'transito':
        query = supabase
          .from('transito_china')
          .select('sku, unidades, estado')
          .order('sku');
        break;

      case 'compras':
        // Reducir a 2000 para evitar timeout
        query = supabase
          .from('compras_historicas')
          .select('sku, fecha_compra')
          .order('fecha_compra', { ascending: false })
          .limit(2000);
        break;

      case 'packs':
        query = supabase
          .from('packs')
          .select('sku_pack, sku_componente, cantidad')
          .order('sku_pack');
        break;

      case 'desconsiderar':
        query = supabase
          .from('skus_desconsiderar')
          .select('sku')
          .order('sku');
        break;

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Tabla no válida. Opciones: ventas, stock, transito, compras, packs, desconsiderar'
          })
        };
    }

    console.log(`[datos-bd] Ejecutando query para tabla: ${tabla}`);
    const { data, error } = await query;

    if (error) {
      console.error(`[datos-bd] Error en query:`, error);
      throw error;
    }

    console.log(`[datos-bd] Query exitosa. Registros: ${data?.length || 0}`);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        tabla,
        registros: data?.length || 0,
        data: data || []
      })
    };

  } catch (error) {
    console.error('[datos-bd] Error general:', error);
    return handleError(error, corsHeaders);
  }
};
