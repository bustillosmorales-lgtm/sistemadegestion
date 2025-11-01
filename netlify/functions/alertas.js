/**
 * Netlify Function: Obtener alertas de inventario
 * GET /api/alertas
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
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

  try {
    const params = event.queryStringParameters || {};
    const tipo_alerta = params.tipo_alerta;
    const severidad = params.severidad;
    const estado = params.estado || 'activa';

    let query = supabase
      .from('alertas_inventario')
      .select('*')
      .eq('estado', estado)
      .order('fecha_alerta', { ascending: false })
      .limit(100);

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
      headers,
      body: JSON.stringify({
        success: true,
        resumen,
        alertas: data
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
