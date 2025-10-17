// scripts/process-import-jobs.js
// Worker para procesar jobs asíncronos en segundo plano
// Ejecutar: node scripts/process-import-jobs.js

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuración
const POLLING_INTERVAL_MS = 10000; // Verificar cada 10 segundos
const MAX_CONCURRENT_JOBS = 3; // Máximo de jobs procesando simultáneamente
const BATCH_SIZE = 100; // Procesar en lotes de 100 filas

// Estado del worker
let isProcessing = false;
let processedCount = 0;
let errorCount = 0;

// =====================================================
// FUNCIÓN PRINCIPAL: Procesar jobs en cola
// =====================================================

async function processJobs() {
  if (isProcessing) {
    console.log('⏸️  Ya hay un procesamiento en curso, esperando...');
    return;
  }

  isProcessing = true;

  try {
    // 1. Buscar jobs pendientes
    const { data: jobs, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(MAX_CONCURRENT_JOBS);

    if (error) {
      console.error('❌ Error buscando jobs:', error.message);
      return;
    }

    if (!jobs || jobs.length === 0) {
      // No hay jobs pendientes
      return;
    }

    console.log(`\n📦 Encontrados ${jobs.length} job(s) pendiente(s)`);

    // 2. Procesar cada job
    for (const job of jobs) {
      try {
        await processJob(job);
        processedCount++;
      } catch (error) {
        console.error(`❌ Error procesando job ${job.id}:`, error.message);
        errorCount++;

        // Marcar job como fallido
        await supabase
          .from('processing_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    }

  } catch (error) {
    console.error('❌ Error en loop principal:', error.message);
  } finally {
    isProcessing = false;
  }
}

// =====================================================
// PROCESAR UN JOB INDIVIDUAL
// =====================================================

async function processJob(job) {
  console.log(`\n🚀 Procesando job: ${job.id}`);
  console.log(`   Tipo: ${job.type}`);
  console.log(`   Archivo: ${job.parameters?.original_filename}`);

  const startTime = Date.now();

  try {
    // 1. Marcar como "processing"
    await supabase
      .from('processing_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // 2. Descargar archivo de Supabase Storage
    console.log('📥 Descargando archivo...');

    // Extraer el path del archivo de la URL
    const url = new URL(job.file_url);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts.slice(pathParts.indexOf('imports')).join('/');

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('job-files')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Error descargando archivo: ${downloadError.message}`);
    }

    console.log('✅ Archivo descargado');

    // 3. Convertir Blob a Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Leer Excel
    console.log('📖 Leyendo Excel...');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = 'Datos';

    if (!workbook.Sheets[sheetName]) {
      throw new Error(`Sheet "Datos" not found in Excel file`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      throw new Error('No data found in Excel file');
    }

    console.log(`📊 Encontradas ${data.length} filas`);

    // 5. Actualizar total_items
    await supabase
      .from('processing_jobs')
      .update({ total_items: data.length })
      .eq('id', job.id);

    // 6. Detectar tipo de acción
    const action = detectAction(data[0]);
    console.log(`🔍 Acción detectada: ${action}`);

    if (action === 'unknown') {
      throw new Error('Unable to detect action type from Excel columns');
    }

    // 7. Procesar cada fila (con actualización de progreso)
    const results = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));

      console.log(`📦 Procesando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.length / BATCH_SIZE)}`);

      for (const row of batch) {
        try {
          const result = await processRow(row, action);
          results.push(result);
        } catch (rowError) {
          results.push({
            sku: row.SKU,
            success: false,
            error: rowError.message
          });
        }
      }

      // Actualizar progreso
      await supabase
        .from('processing_jobs')
        .update({
          processed_items: Math.min(i + BATCH_SIZE, data.length)
        })
        .eq('id', job.id);
    }

    // 8. Invalidar cache después de updates
    try {
      await supabase
        .from('dashboard_analysis_cache')
        .delete()
        .gt('sku', '');
      console.log('✅ Cache invalidado');
    } catch (cacheError) {
      console.warn('⚠️  Error invalidando cache:', cacheError.message);
    }

    // 9. Marcar como completado
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    await supabase
      .from('processing_jobs')
      .update({
        status: 'completed',
        processed_items: data.length,
        results: {
          action: action,
          total: data.length,
          success: successCount,
          errors: errorCount,
          details: results
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`✅ Job completado en ${elapsedTime}s`);
    console.log(`   Éxitos: ${successCount}, Errores: ${errorCount}`);

  } catch (error) {
    console.error(`❌ Error procesando job ${job.id}:`, error.message);
    throw error;
  }
}

// =====================================================
// DETECTAR ACCIÓN POR COLUMNAS DEL EXCEL
// =====================================================

function detectAction(firstRow) {
  const columns = Object.keys(firstRow);

  if (columns.includes('📝 Motivo') && columns.includes('✅ Forzar Cotización')) {
    return 'force_request_quote';
  }
  if (columns.includes('📝 Precio Unitario') && columns.includes('📝 Moneda')) {
    return 'quote';
  }
  if (columns.includes('📝 Precio de Venta a Usar')) {
    return 'analyze';
  }
  if (columns.includes('✅ Aprobar') && columns.includes('📝 Precio Objetivo (Negociar)')) {
    return 'approve';
  }
  if (columns.includes('📝 Proveedor') && columns.includes('📝 Número de Orden')) {
    return 'confirm_purchase';
  }
  if (columns.includes('📝 Notas de Calidad')) {
    return 'confirm_manufacturing';
  }
  if (columns.includes('📝 Número de Contenedor')) {
    return 'confirm_shipping';
  }
  if (columns.includes('✅ Recibido') && columns.includes('📝 Cantidad Recibida')) {
    return 'mark_received';
  }
  if (columns.includes('✅ Acción') && columns.includes('📝 Cantidad a Cotizar')) {
    return 'request_quote';
  }
  if (columns.includes('✅ Desconsiderar')) {
    return 'mark_desconsiderado';
  }

  return 'unknown';
}

// =====================================================
// PROCESAR UNA FILA INDIVIDUAL
// =====================================================

async function processRow(row, action) {
  const sku = row.SKU;

  if (!sku) {
    return { sku: 'N/A', success: false, reason: 'SKU missing' };
  }

  // Verificar si el usuario marcó la acción
  const shouldProcess = checkShouldProcess(row, action);
  if (!shouldProcess) {
    return { sku, success: false, reason: 'No marcado para procesar' };
  }

  // Procesar según la acción (llamar al módulo original)
  // Por ahora, solo actualizamos el status del producto como ejemplo
  try {
    switch (action) {
      case 'request_quote':
        await processRequestQuote(sku, row);
        break;
      case 'force_request_quote':
        await processForceRequestQuote(sku, row);
        break;
      case 'mark_desconsiderado':
        await processMarkDesconsiderado(sku, row);
        break;
      // ... agregar otros casos según necesites
      default:
        throw new Error(`Action ${action} not implemented in worker`);
    }

    return { sku, success: true, action };
  } catch (error) {
    return { sku, success: false, error: error.message };
  }
}

// Verificar si debe procesarse
function checkShouldProcess(row, action) {
  const actionColumns = {
    force_request_quote: '✅ Forzar Cotización',
    request_quote: '✅ Acción',
    quote: '✅ Acción',
    analyze: '✅ Analizar',
    approve: '✅ Aprobar',
    confirm_purchase: '✅ Confirmado',
    mark_desconsiderado: '✅ Desconsiderar'
  };

  const column = actionColumns[action];
  if (!column) return true;

  const value = row[column];
  return value && value.toString().toUpperCase() === 'SI';
}

// Ejemplo de función de procesamiento
async function processRequestQuote(sku, row) {
  const cantidad = parseInt(row['📝 Cantidad a Cotizar']);

  if (!cantidad || cantidad <= 0) {
    throw new Error('Cantidad inválida');
  }

  await supabase
    .from('products')
    .update({
      primary_status: 'QUOTE_REQUESTED',
      status: 'QUOTE_REQUESTED'
    })
    .eq('sku', sku);
}

async function processForceRequestQuote(sku, row) {
  const cantidad = parseInt(row['📝 Cantidad a Cotizar']);
  const motivo = row['📝 Motivo'];

  if (!cantidad || cantidad <= 0) {
    throw new Error('Cantidad inválida');
  }

  if (!motivo) {
    throw new Error('Motivo requerido');
  }

  await supabase
    .from('products')
    .update({
      status: 'QUOTE_REQUESTED',
      request_details: {
        quantityToQuote: cantidad,
        motivo: motivo,
        forced: true,
        timestamp: new Date().toISOString()
      }
    })
    .eq('sku', sku);
}

// Marcar producto como desconsiderado
async function processMarkDesconsiderado(sku, row) {
  console.log(`  ⚠️ Marcando ${sku} como desconsiderado`);

  const { error } = await supabase
    .from('products')
    .update({
      desconsiderado: true
    })
    .eq('sku', sku);

  if (error) {
    throw new Error(`Error actualizando producto: ${error.message}`);
  }
}

// =====================================================
// INICIAR WORKER
// =====================================================

console.log('🚀 Iniciando worker de procesamiento de jobs...');
console.log(`📊 Configuración:`);
console.log(`   - Polling interval: ${POLLING_INTERVAL_MS / 1000}s`);
console.log(`   - Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
console.log(`   - Batch size: ${BATCH_SIZE}`);
console.log('');

// Ejecutar inmediatamente
processJobs();

// Luego ejecutar cada X segundos
const interval = setInterval(processJobs, POLLING_INTERVAL_MS);

// Mostrar estadísticas cada minuto
setInterval(() => {
  console.log(`\n📊 Estadísticas:`);
  console.log(`   Procesados: ${processedCount}`);
  console.log(`   Errores: ${errorCount}`);
}, 60000);

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('\n⚠️  Señal de interrupción recibida');
  console.log(`📊 Estadísticas finales:`);
  console.log(`   Procesados: ${processedCount}`);
  console.log(`   Errores: ${errorCount}`);
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Señal de terminación recibida');
  clearInterval(interval);
  process.exit(0);
});
