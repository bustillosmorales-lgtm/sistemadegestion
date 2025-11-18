/**
 * Netlify Function: Sincronización de Ventas desde Defontana
 * POST /.netlify/functions/defontana-sync
 * Requiere autenticación JWT
 */

const { createClient } = require('@supabase/supabase-js');
const { withAuth } = require('./lib/middleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DEFONTANA_BASE_URL = 'https://replapi.defontana.com';

/**
 * Authenticate with Defontana API using EmailLogin endpoint
 */
async function authenticateDefontana(email, password) {
  const params = new URLSearchParams({ email, password });

  const response = await fetch(`${DEFONTANA_BASE_URL}/api/Auth/EmailLogin?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Defontana auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Get sales from Defontana API
 * Note: endpoint is GetSalebyDate (lowercase 'b')
 * Parameters are initialDate and endingDate (not startDate/endDate)
 */
async function getSalesFromDefontana(token, initialDate, endingDate) {
  const params = new URLSearchParams({ initialDate, endingDate });

  const response = await fetch(
    `${DEFONTANA_BASE_URL}/api/Sale/GetSalebyDate?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Defontana API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.exceptionMessage || data.message || 'Error desconocido de Defontana');
  }

  return data;
}

exports.handler = withAuth(async (event, context, auth) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { dateFrom, dateTo } = body;

    // Validar fechas
    if (!dateFrom || !dateTo) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Fechas requeridas: dateFrom y dateTo'
        })
      };
    }

    // Obtener configuración de Defontana desde configuracion_sistema
    const { data: configData, error: configError } = await supabase
      .from('configuracion_sistema')
      .select('clave, valor')
      .in('clave', ['defontana_email', 'defontana_password', 'defontana_activo']);

    if (configError || !configData || configData.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Defontana no está configurado. Configura la integración primero.'
        })
      };
    }

    // Crear map de configuración
    const configMap = {};
    configData.forEach(item => {
      configMap[item.clave] = item.valor;
    });

    // Validar que Defontana esté activo
    if (configMap.defontana_activo !== 'true') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Defontana está desactivado. Actívalo en Configuración.'
        })
      };
    }

    const email = configMap.defontana_email;
    const password = configMap.defontana_password;

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Credenciales de Defontana incompletas.'
        })
      };
    }

    console.log(`[Defontana Sync] Iniciando sincronización desde ${dateFrom} hasta ${dateTo}`);

    // 1. Autenticar con Defontana
    const token = await authenticateDefontana(email, password);
    console.log('[Defontana Sync] Autenticación exitosa');

    // 2. Obtener ventas desde Defontana
    const salesResponse = await getSalesFromDefontana(token, dateFrom, dateTo);
    const saleList = salesResponse.saleList || [];

    console.log(`[Defontana Sync] ${salesResponse.totalItems || 0} documentos de venta obtenidos`);

    // 3. Procesar y guardar ventas
    let salesImported = 0;
    let documentsProcessed = 0;
    let skusUpdated = new Set();
    let errors = [];

    if (!saleList || saleList.length === 0) {
      console.log('[Defontana Sync] No se encontraron ventas en el rango de fechas');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          salesImported: 0,
          skusUpdated: 0,
          totalSales: 0,
          message: 'No se encontraron ventas en el rango de fechas especificado'
        })
      };
    }

    // Procesar cada documento de venta
    for (const saleDoc of saleList) {
      documentsProcessed++;

      try {
        const emissionDate = saleDoc.emissionDate ? saleDoc.emissionDate.split('T')[0] : null;
        const details = saleDoc.details || [];

        // Cada documento puede tener múltiples líneas de detalle (productos)
        for (const detail of details) {
          try {
            // Campos según documentación: code (SKU), count (cantidad), price (precio)
            const sku = detail.code;
            const quantity = parseFloat(detail.count || 0);
            const unitPrice = parseFloat(detail.price || 0);
            const description = detail.comment || detail.code || '';

            // Validar datos mínimos
            if (!sku || quantity <= 0) {
              console.log(`[Defontana Sync] Saltando detalle sin SKU o cantidad: ${JSON.stringify(detail)}`);
              continue;
            }

            // Insertar en ventas_historicas
            const { error: insertError } = await supabase
              .from('ventas_historicas')
              .insert({
                empresa: 'Defontana',
                canal: 'Defontana',
                fecha: emissionDate,
                sku: sku,
                mlc: null,
                descripcion: description,
                unidades: quantity,
                precio: unitPrice
              });

            if (!insertError) {
              salesImported++;
              skusUpdated.add(sku);
            } else {
              // Si el error es por duplicado, no es crítico
              if (insertError.code === '23505') {
                console.log(`[Defontana Sync] Venta duplicada para SKU ${sku} en fecha ${emissionDate} - ignorada`);
              } else {
                console.error(`[Defontana Sync] Error insertando venta para SKU ${sku}:`, insertError);
                errors.push({
                  sku,
                  folio: saleDoc.firstFolio,
                  error: insertError.message
                });
              }
            }
          } catch (detailError) {
            console.error('[Defontana Sync] Error procesando detalle:', detailError);
            errors.push({
              folio: saleDoc.firstFolio,
              error: detailError.message
            });
          }
        }
      } catch (docError) {
        console.error('[Defontana Sync] Error procesando documento:', docError);
        errors.push({
          folio: saleDoc.firstFolio,
          error: docError.message
        });
      }
    }

    console.log(`[Defontana Sync] Procesados ${documentsProcessed} documentos, ${salesImported} líneas de venta importadas`);

    // 4. Registrar log de sincronización
    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    await supabase
      .from('sync_logs')
      .insert({
        integration: 'defontana',
        sync_type: 'sales',
        records_imported: salesImported,
        status: 'success',
        metadata: {
          dateFrom,
          dateTo,
          totalDocuments: documentsProcessed,
          totalItems: salesResponse.totalItems || 0,
          skusUpdated: Array.from(skusUpdated),
          errors: errors.length > 0 ? errors : undefined
        }
      });

    console.log(`[Defontana Sync] ✅ Completado en ${timeElapsed}s - ${salesImported} líneas de venta importadas de ${documentsProcessed} documentos`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        salesImported,
        documentsProcessed,
        skusUpdated: skusUpdated.size,
        totalItems: salesResponse.totalItems || 0,
        timeElapsed: `${timeElapsed}s`,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Primeros 10 errores
      })
    };

  } catch (error) {
    console.error('[Defontana Sync] ❌ Error:', error);

    // Registrar log de error
    await supabase
      .from('sync_logs')
      .insert({
        integration: 'defontana',
        sync_type: 'sales',
        records_imported: 0,
        status: 'error',
        error_message: error.message,
        metadata: {
          stack: error.stack
        }
      });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
});
