const { schedule } = require('@netlify/functions');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Ejecutar cada 5 minutos
exports.handler = schedule('*/5 * * * *', async (event) => {
  console.log('🚀 Netlify Scheduled Function: Procesando jobs...');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Buscar jobs pendientes
    const { data: jobs, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(3);

    if (error) {
      console.error('❌ Error buscando jobs:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }

    if (!jobs || jobs.length === 0) {
      console.log('ℹ️ No hay jobs pendientes');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No pending jobs' })
      };
    }

    console.log(`📦 Encontrados ${jobs.length} job(s) pendiente(s)`);

    // Procesar cada job
    const results = [];
    for (const job of jobs) {
      try {
        const result = await processJob(job);
        results.push(result);
      } catch (error) {
        console.error(`❌ Error procesando job ${job.id}:`, error);
        results.push({ job_id: job.id, error: error.message });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: jobs.length,
        results: results
      })
    };
  } catch (error) {
    console.error('❌ Error general:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
});

async function processJob(job) {
  console.log(`🚀 Procesando job: ${job.id} (${job.type})`);

  try {
    // 1. Marcar como processing
    await supabase
      .from('processing_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // 2. Descargar archivo desde Storage
    console.log(`📥 Descargando archivo: ${job.file_url}`);

    const filePath = job.file_url.split('/job-files/')[1];
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('job-files')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Error descargando archivo: ${downloadError.message}`);
    }

    console.log('✅ Archivo descargado');

    // 3. Leer Excel
    console.log('📖 Leyendo Excel...');
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (!workbook.SheetNames.includes('Datos')) {
      throw new Error('La hoja "Datos" no existe en el archivo Excel');
    }

    const worksheet = workbook.Sheets['Datos'];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Encontradas ${data.length} filas`);

    // 4. Detectar tipo de acción
    const accionType = detectActionType(data);
    console.log(`🔍 Acción detectada: ${accionType}`);

    // 5. Procesar según el tipo
    const results = { success: [], errors: [], skipped: [] };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        const sku = row['SKU'] || row['sku'];
        if (!sku) {
          results.skipped.push({ row: i + 2, reason: 'SKU vacío' });
          continue;
        }

        const accion = (row['✅ Acción'] || row['Acción'] || '').toString().trim().toUpperCase();

        if (accion !== 'SI') {
          results.skipped.push({ sku, row: i + 2, reason: `Acción no es SI: ${accion}` });
          continue;
        }

        // Procesar según el tipo
        if (accionType === 'request_quote') {
          const cantidad = parseInt(row['📝 Cantidad a Cotizar'] || row['Cantidad a Cotizar'] || 0);

          if (cantidad <= 0) {
            results.skipped.push({ sku, row: i + 2, reason: 'Cantidad <= 0' });
            continue;
          }

          // Insertar en purchase_order_details
          const { error: insertError } = await supabase
            .from('purchase_order_details')
            .insert({
              sku: sku,
              quantity_requested: cantidad,
              status: 'pending',
              created_at: new Date().toISOString()
            });

          if (insertError) {
            results.errors.push({ sku, row: i + 2, error: insertError.message });
          } else {
            results.success.push({ sku, cantidad });
          }
        } else {
          results.skipped.push({ sku, row: i + 2, reason: `Tipo de acción desconocido: ${accionType}` });
        }

        // Actualizar progreso cada 10 filas
        if (i % 10 === 0) {
          const progress = Math.round((i / data.length) * 100);
          await supabase
            .from('processing_jobs')
            .update({ progress })
            .eq('id', job.id);
        }
      } catch (rowError) {
        results.errors.push({
          sku: row['SKU'] || row['sku'],
          row: i + 2,
          error: rowError.message
        });
      }
    }

    // 6. Marcar como completado
    console.log(`✅ Job completado: ${results.success.length} éxitos, ${results.errors.length} errores`);

    await supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 100,
        total_items: data.length,
        processed_items: results.success.length,
        results: results
      })
      .eq('id', job.id);

    return {
      job_id: job.id,
      status: 'completed',
      total: data.length,
      success: results.success.length,
      errors: results.errors.length,
      skipped: results.skipped.length
    };
  } catch (error) {
    console.error(`❌ Error procesando job ${job.id}:`, error);

    // Marcar como failed
    await supabase
      .from('processing_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', job.id);

    throw error;
  }
}

function detectActionType(data) {
  if (!data || data.length === 0) {
    return 'unknown';
  }

  const firstRow = data[0];

  // Buscar columnas relacionadas con cotización
  if (
    firstRow.hasOwnProperty('📝 Cantidad a Cotizar') ||
    firstRow.hasOwnProperty('Cantidad a Cotizar') ||
    firstRow.hasOwnProperty('cantidad_a_cotizar')
  ) {
    return 'request_quote';
  }

  // Buscar columnas relacionadas con reposición
  if (
    firstRow.hasOwnProperty('Cantidad a Reponer') ||
    firstRow.hasOwnProperty('cantidad_a_reponer')
  ) {
    return 'restock';
  }

  return 'unknown';
}
