/**
 * Obtiene datos crudos de la BD para exportación y validación
 */

const { createClient } = require('@supabase/supabase-js');
const { verificarAutenticacion } = require('./lib/auth');
const { manejarError } = require('./lib/error-handler');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  // Solo permitir GET
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Verificar autenticación
    const authResult = await verificarAutenticacion(event);
    if (!authResult.success) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: authResult.error })
      };
    }

    const { searchParams } = new URL(event.rawUrl);
    const tabla = searchParams.get('tabla');

    if (!tabla) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Parámetro "tabla" requerido' })
      };
    }

    let query;
    let campos;

    switch (tabla) {
      case 'ventas':
        query = supabase
          .from('ventas_historicas')
          .select('empresa, canal, fecha, sku, mlc, descripcion, unidades, precio')
          .order('fecha', { ascending: false })
          .limit(10000); // Últimos 10k registros para no sobrecargar
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
        query = supabase
          .from('compras_historicas')
          .select('sku, fecha_compra')
          .order('fecha_compra', { ascending: false })
          .limit(10000);
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
          body: JSON.stringify({
            error: 'Tabla no válida. Opciones: ventas, stock, transito, compras, packs, desconsiderar'
          })
        };
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        tabla,
        registros: data.length,
        data
      })
    };

  } catch (error) {
    return manejarError(error, 'obtener datos BD');
  }
};
