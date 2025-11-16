/**
 * Netlify Function: Configuración de Defontana
 * GET - Verificar si está configurado
 * POST - Guardar configuración
 * DELETE - Eliminar configuración
 */

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, getCorsHeaders } = require('./lib/auth');

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
    return {
      statusCode: auth.rateLimitExceeded ? 429 : 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: auth.error
      })
    };
  }

  try {
    // GET: Verificar configuración
    if (event.httpMethod === 'GET') {
      const { data: config, error } = await supabase
        .from('integraciones_config')
        .select('*')
        .eq('tipo', 'defontana')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      // Obtener estadísticas de sincronización
      const { data: syncStats } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('integration', 'defontana')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          configured: !!config,
          lastSync: syncStats?.created_at || null,
          totalSales: syncStats?.records_imported || 0
        })
      };
    }

    // POST: Guardar configuración
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { apiKey, companyId, environment } = body;

      if (!apiKey || !companyId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'API Key y Company ID son obligatorios'
          })
        };
      }

      // Validar conexión con Defontana antes de guardar
      try {
        const testResponse = await fetch(`https://api.defontana.com/api/v1/companies/${companyId}/health`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!testResponse.ok) {
          throw new Error('Credenciales inválidas o empresa no encontrada');
        }
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'No se pudo conectar a Defontana. Verifica tus credenciales.'
          })
        };
      }

      // Guardar configuración (encriptada en producción real)
      const { data, error } = await supabase
        .from('integraciones_config')
        .upsert({
          tipo: 'defontana',
          config: {
            apiKey: apiKey, // En producción, encriptar esto
            companyId: companyId,
            environment: environment || 'production'
          },
          activo: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tipo'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Configuración guardada correctamente',
          configured: true
        })
      };
    }

    // DELETE: Eliminar configuración
    if (event.httpMethod === 'DELETE') {
      const { error } = await supabase
        .from('integraciones_config')
        .delete()
        .eq('tipo', 'defontana');

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Configuración eliminada'
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error en defontana-config:', error);
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
