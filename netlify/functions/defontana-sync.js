/**
 * Netlify Function: Sincronización de Ventas desde Defontana
 * POST - Sincronizar ventas desde Defontana
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const startTime = Date.now();

  try {
    const body = JSON.parse(event.body || '{}');
    const { syncType, dateFrom, dateTo } = body;

    // Obtener configuración de Defontana
    const { data: config, error: configError } = await supabase
      .from('integraciones_config')
      .select('*')
      .eq('tipo', 'defontana')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Defontana no está configurado. Configura la integración primero.'
        })
      };
    }

    const { apiKey, companyId, environment } = config.config;
    const baseUrl = environment === 'sandbox'
      ? 'https://sandbox-api.defontana.com'
      : 'https://api.defontana.com';

    console.log(`[Defontana Sync] Iniciando sincronización de ventas desde ${dateFrom} hasta ${dateTo}`);

    // Obtener ventas desde Defontana
    let allSales = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[Defontana Sync] Obteniendo página ${page}...`);

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${companyId}/sales?` +
        `dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page}&pageSize=100`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de Defontana API: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.sales && data.sales.length > 0) {
        allSales = allSales.concat(data.sales);
        hasMore = data.hasMore || false;
        page++;
      } else {
        hasMore = false;
      }

      // Límite de seguridad para evitar loops infinitos
      if (page > 100) {
        console.warn('[Defontana Sync] Límite de páginas alcanzado');
        break;
      }
    }

    console.log(`[Defontana Sync] Total de ventas obtenidas: ${allSales.length}`);

    // Procesar y guardar ventas
    let salesImported = 0;
    let skusUpdated = new Set();

    for (const sale of allSales) {
      try {
        // Extraer información de la venta
        const saleDate = sale.date || sale.saleDate || sale.createdAt;
        const items = sale.items || sale.details || [];

        for (const item of items) {
          const sku = item.sku || item.productCode || item.code;
          const quantity = parseInt(item.quantity || item.qty || 0);
          const unitPrice = parseFloat(item.unitPrice || item.price || 0);

          if (!sku || quantity <= 0) continue;

          // Guardar en tabla de ventas
          const { error: insertError } = await supabase
            .from('ventas')
            .insert({
              sku: sku,
              unidades: quantity,
              precio_unitario: unitPrice,
              fecha_venta: saleDate,
              origen: 'defontana',
              metadata: {
                saleId: sale.id || sale.saleId,
                documentNumber: sale.documentNumber || sale.number,
                customerName: sale.customerName || sale.customer?.name
              }
            });

          if (!insertError) {
            salesImported++;
            skusUpdated.add(sku);
          } else {
            console.error(`Error insertando venta para SKU ${sku}:`, insertError);
          }
        }
      } catch (itemError) {
        console.error('Error procesando venta:', itemError);
      }
    }

    // Registrar log de sincronización
    await supabase
      .from('sync_logs')
      .insert({
        integration: 'defontana',
        sync_type: syncType || 'sales',
        records_imported: salesImported,
        status: 'success',
        metadata: {
          dateFrom,
          dateTo,
          totalSales: allSales.length,
          skusUpdated: Array.from(skusUpdated)
        }
      });

    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[Defontana Sync] Completado en ${timeElapsed}s - ${salesImported} ventas importadas`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        salesImported,
        skusUpdated: skusUpdated.size,
        totalSales: allSales.length,
        timeElapsed: `${timeElapsed}s`
      })
    };

  } catch (error) {
    console.error('[Defontana Sync] Error:', error);

    // Registrar log de error
    await supabase
      .from('sync_logs')
      .insert({
        integration: 'defontana',
        sync_type: 'sales',
        records_imported: 0,
        status: 'error',
        error_message: error.message
      });

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
