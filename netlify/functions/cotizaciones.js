/**
 * Netlify Function: Gestión de cotizaciones (SEGURA)
 * GET /api/cotizaciones - Obtener cotizaciones con filtros
 * POST /api/cotizaciones - Crear nueva cotización
 * PUT /api/cotizaciones/:id - Actualizar cotización
 * DELETE /api/cotizaciones/:id - Eliminar cotización
 * Requiere autenticación JWT
 */

const { createClient } = require('@supabase/supabase-js');
const { withAuth } = require('./lib/middleware');
const { cotizacionesQuerySchema, cotizacionPostSchema, cotizacionPutSchema, validateInput } = require('./lib/validation');

// Usar SERVICE_KEY para bypasear límite de 1000 registros
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Helper: Verifica si un SKU existe en stock_actual y lo crea si no existe
 * @param {string} sku - SKU a verificar/crear
 * @param {string} descripcion - Descripción del producto (opcional)
 * @returns {Promise<{success: boolean, created: boolean, error?: string}>}
 */
async function ensureSKUExists(sku, descripcion = null) {
  try {
    // 1. Verificar si el SKU ya existe
    const { data: existingSKU, error: checkError } = await supabase
      .from('stock_actual')
      .select('sku')
      .eq('sku', sku)
      .single();

    // Si existe, retornar success
    if (existingSKU) {
      return { success: true, created: false };
    }

    // Si no existe (error de no encontrado), crearlo
    if (checkError && checkError.code === 'PGRST116') {
      // Crear el SKU con datos mínimos
      const { error: insertError } = await supabase
        .from('stock_actual')
        .insert([{
          sku: sku,
          descripcion: descripcion || `Producto ${sku}`,
          bodega_c: 0,
          bodega_d: 0,
          bodega_e: 0,
          bodega_f: 0,
          bodega_h: 0,
          bodega_j: 0
        }]);

      if (insertError) {
        console.error('[ensureSKUExists] Error creando SKU:', insertError);
        return {
          success: false,
          created: false,
          error: `No se pudo crear el SKU: ${insertError.message}`
        };
      }

      console.log(`[ensureSKUExists] SKU ${sku} creado automáticamente`);
      return { success: true, created: true };
    }

    // Otro tipo de error
    console.error('[ensureSKUExists] Error verificando SKU:', checkError);
    return {
      success: false,
      created: false,
      error: `Error verificando SKU: ${checkError?.message}`
    };

  } catch (error) {
    console.error('[ensureSKUExists] Error inesperado:', error);
    return {
      success: false,
      created: false,
      error: `Error inesperado: ${error.message}`
    };
  }
}

exports.handler = withAuth(async (event, context, auth) => {
  try {
    // GET: Obtener cotizaciones
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};

      const validation = validateInput(cotizacionesQuerySchema, params);
      if (!validation.success) {
        return {
          statusCode: 400,
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
                    body: JSON.stringify({
            success: false,
            error: 'Invalid input',
            details: validation.errors
          })
        };
      }
      const validatedData = validation.data;

      // NUEVO: Asegurar que el SKU existe en stock_actual antes de crear la cotización
      const skuCheck = await ensureSKUExists(
        validatedData.sku,
        validatedData.descripcion
      );

      if (!skuCheck.success) {
        console.error('[POST] No se pudo asegurar existencia del SKU:', skuCheck.error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: skuCheck.error || 'No se pudo crear/verificar el SKU en la base de datos'
          })
        };
      }

      // Log si se creó un nuevo SKU
      if (skuCheck.created) {
        console.log(`[POST] SKU ${validatedData.sku} creado automáticamente para cotización`);
      }

      const { data, error } = await supabase
        .from('cotizaciones')
        .insert([validatedData])
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 201,
                body: JSON.stringify({
          success: true,
          cotizacion: data,
          sku_created: skuCheck.created // Informar si se creó el SKU
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

      // Filtrar campos null antes de actualizar
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null) {
          delete updateData[key];
        }
      });

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
            // NUEVO: Asegurar que el SKU existe antes de crear el tránsito
            const skuCheck = await ensureSKUExists(
              cotizacion.sku,
              cotizacion.descripcion
            );

            if (skuCheck.created) {
              console.log(`[PUT] SKU ${cotizacion.sku} creado automáticamente al cargar a contenedor`);
            }

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

      if (error) {
        console.error('[PUT] Error de Supabase:', error);
        throw error;
      }

      return {
        statusCode: 200,
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
                body: JSON.stringify({
          success: true,
          message: 'Cotización eliminada'
        })
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error en cotizaciones:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
});
