/**
 * Netlify Function: Gestión de cotizaciones (SEGURA)
 * GET /api/cotizaciones - Obtener cotizaciones con filtros
 * POST /api/cotizaciones - Crear nueva cotización
 * PUT /api/cotizaciones/:id - Actualizar cotización
 * DELETE /api/cotizaciones/:id - Eliminar cotización
 * Requiere autenticación JWT
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');
const { cotizacionesQuerySchema, cotizacionPostSchema, cotizacionPutSchema, validateInput } = require('./lib/validation');

// Usar SERVICE_KEY para bypasear límite de 1000 registros
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  const origin = event.headers.origin || '';
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
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
    // GET: Obtener cotizaciones
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      const validation = validateInput(cotizacionesQuerySchema, params);
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

      const { estado, sku } = validatedParams;

      let query = supabase
        .from('cotizaciones')
        .select('*')
        .order('fecha_cotizacion', { ascending: false })
        .limit(50000)
        // No mostrar items ya cargados en contenedor
        .is('fecha_carga_contenedor', null);

      if (estado) {
        query = query.eq('estado', estado);
      }

      if (sku) {
        query = query.ilike('sku', `%${sku}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Resumen por estado
      const resumen = {
        pendiente: data.filter(c => c.estado === 'pendiente').length,
        aprobada: data.filter(c => c.estado === 'aprobada').length,
        rechazada: data.filter(c => c.estado === 'rechazada').length,
        recibida: data.filter(c => c.estado === 'recibida').length,
        total: data.length
      };

      return {
        statusCode: 200,
        headers: { ...headers, ...rateLimitHeaders },
        body: JSON.stringify({
          success: true,
          resumen,
          cotizaciones: data
        })
      };
    }

    // POST: Crear cotización
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      const validation = validateInput(cotizacionPostSchema, body);
      if (!validation.success) {
        return {
          statusCode: 400,
          headers: { ...headers, ...rateLimitHeaders },
          body: JSON.stringify({
            success: false,
            error: 'Invalid input',
            details: validation.errors
          })
        };
      }
      const validatedData = validation.data;

      const { data, error } = await supabase
        .from('cotizaciones')
        .insert([validatedData])
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 201,
        headers: { ...headers, ...rateLimitHeaders },
        body: JSON.stringify({
          success: true,
          cotizacion: data
        })
      };
    }

    // PUT: Actualizar cotización
    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const pathParts = event.path.split('/');
      const id = pathParts[pathParts.length - 1];

      if (!id || isNaN(parseInt(id))) {
        return {
          statusCode: 400,
          headers: { ...headers, ...rateLimitHeaders },
          body: JSON.stringify({
            success: false,
            error: 'Invalid ID'
          })
        };
      }

      const validation = validateInput(cotizacionPutSchema, body);
      if (!validation.success) {
        return {
          statusCode: 400,
          headers: { ...headers, ...rateLimitHeaders },
          body: JSON.stringify({
            success: false,
            error: 'Invalid input',
            details: validation.errors
          })
        };
      }
      const validatedData = validation.data;

      // Procesar flags de fecha (convertir booleans a timestamps)
      const updateData = { ...validatedData };
      if (updateData.fecha_confirmacion_compra === true) {
        updateData.fecha_confirmacion_compra = new Date().toISOString();
      } else {
        delete updateData.fecha_confirmacion_compra;
      }

      if (updateData.fecha_carga_contenedor === true) {
        updateData.fecha_carga_contenedor = new Date().toISOString();
        // Cuando se carga en contenedor y hay número, crear registro en tránsito
        if (updateData.numero_contenedor) {
          // Obtener datos de la cotización para crear tránsito
          const { data: cotizacion } = await supabase
            .from('cotizaciones')
            .select('sku, cantidad_cotizar, descripcion')
            .eq('id', parseInt(id))
            .single();

          if (cotizacion) {
            // Crear registro en transito_china
            await supabase
              .from('transito_china')
              .insert({
                sku: cotizacion.sku,
                unidades: cotizacion.cantidad_cotizar,
                estado: 'en_transito',
                numero_contenedor: updateData.numero_contenedor,
                descripcion: cotizacion.descripcion || null,
                fecha_contenedor: updateData.fecha_carga_contenedor.split('T')[0], // Solo la fecha
                origen: 'cotizacion'
              });
          }
        }
      } else {
        delete updateData.fecha_carga_contenedor;
      }

      const { data, error } = await supabase
        .from('cotizaciones')
        .update(updateData)
        .eq('id', parseInt(id))
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { ...headers, ...rateLimitHeaders },
        body: JSON.stringify({
          success: true,
          cotizacion: data
        })
      };
    }

    // DELETE: Eliminar cotización
    if (event.httpMethod === 'DELETE') {
      const pathParts = event.path.split('/');
      const id = pathParts[pathParts.length - 1];

      if (!id || isNaN(parseInt(id))) {
        return {
          statusCode: 400,
          headers: { ...headers, ...rateLimitHeaders },
          body: JSON.stringify({
            success: false,
            error: 'Invalid ID'
          })
        };
      }

      const { error } = await supabase
        .from('cotizaciones')
        .delete()
        .eq('id', parseInt(id));

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { ...headers, ...rateLimitHeaders },
        body: JSON.stringify({
          success: true,
          message: 'Cotización eliminada'
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error en cotizaciones:', error);
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
