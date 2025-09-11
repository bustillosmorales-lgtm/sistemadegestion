// scripts/process-storage-files.js
const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')

// Configuración con service key para admin
const supabaseUrl = 'https://ugabltnuwwtbpyqoptdg.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWJsdG51d3d0YnB5cW9wdGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQxMzg2NiwiZXhwIjoyMDcxOTg5ODY2fQ.UadJZDDy1ovJkNJ6EtyIFUasVECrNm4bHPPYXSJqbuE'

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Mapeo de archivos a tablas y procesadores
const FILE_MAPPINGS = {
  'productos_existentes_2025-09-08.xlsx': {
    table: 'products',
    processor: processProductsFile
  },
  'template_compras.xlsx': {
    table: 'compras', 
    processor: processComprasFile
  },
  'template_containers.xlsx': {
    table: 'containers',
    processor: processContainersFile
  },
  'template_ventas.xlsx': {
    table: 'ventas',
    processor: processVentasFile
  }
}

async function downloadFileFromStorage(filename) {
  console.log(`📥 Descargando ${filename} desde Storage...`)
  
  const { data, error } = await supabaseAdmin.storage
    .from('archivos')
    .download(filename)
  
  if (error) {
    throw new Error(`Error descargando ${filename}: ${error.message}`)
  }
  
  return data
}

function parseExcelFile(fileBuffer) {
  console.log(`📋 Parseando archivo Excel...`)
  const workbook = XLSX.read(fileBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet)
  
  console.log(`📊 Encontradas ${jsonData.length} filas de datos`)
  return jsonData
}

async function processProductsFile(data) {
  console.log(`🏷️  Procesando productos...`)
  
  const products = data.map(row => ({
    sku: row.SKU || row.sku || row.Sku,
    descripcion: row.Descripcion || row.descripcion || row.DESCRIPCION,
    stock_actual: parseInt(row.Stock || row.stock_actual || row.STOCK || 0),
    costo_fob_rmb: parseFloat(row.Costo_FOB_RMB || row.costo_fob_rmb || row.COSTO || 0),
    cbm: parseFloat(row.CBM || row.cbm || row.Cbm || 0),
    link: row.Link || row.link || row.LINK || '',
    status: row.Status || row.status || 'activo'
  })).filter(p => p.sku && String(p.sku).trim() !== '') // Solo productos con SKU válido
  
  console.log(`📦 Procesando ${products.length} productos`)
  return { table: 'products', data: products }
}

async function processComprasFile(data) {
  console.log(`🛒 Procesando compras...`)
  
  const compras = data.map(row => ({
    sku: row.SKU || row.sku || row.Sku,
    cantidad: parseInt(row.Cantidad || row.cantidad || row.CANTIDAD || 0),
    fecha_compra: row.Fecha_Compra || row.fecha_compra || row.FECHA_COMPRA || new Date().toISOString(),
    fecha_llegada_estimada: row.Fecha_Llegada_Estimada || row.fecha_llegada_estimada || null,
    fecha_llegada_real: row.Fecha_Llegada_Real || row.fecha_llegada_real || null,
    status_compra: row.Status || row.status_compra || row.STATUS || 'pendiente'
  })).filter(c => c.sku && String(c.sku).trim() !== '') // Solo compras con SKU válido
  
  console.log(`🛒 Procesando ${compras.length} compras`)
  return { table: 'compras', data: compras }
}

async function processContainersFile(data) {
  console.log(`📦 Procesando containers...`)
  
  const containers = data.map(row => ({
    container_number: row.Container_Number || row.container_number || row.CONTAINER || row.Numero_Contenedor,
    container_type: row.Container_Type || row.container_type || row.TYPE || row.Tipo || '20ft',
    max_cbm: parseFloat(row.Max_CBM || row.max_cbm || row.CBM_MAXIMO || row.CBM || 28),
    departure_port: row.Departure_Port || row.departure_port || row.PUERTO_SALIDA || row.Puerto_Origen,
    arrival_port: row.Arrival_Port || row.arrival_port || row.PUERTO_LLEGADA || row.Puerto_Destino,
    estimated_departure: row.Estimated_Departure || row.estimated_departure || row.FECHA_SALIDA_EST,
    estimated_arrival: row.Estimated_Arrival || row.estimated_arrival || row.FECHA_LLEGADA_EST,
    shipping_company: row.Shipping_Company || row.shipping_company || row.NAVIERA || row.Compania,
    notes: row.Notes || row.notes || row.NOTAS || row.Observaciones || ''
  })).filter(c => c.container_number && String(c.container_number).trim() !== '') // Solo containers válidos
  
  console.log(`📦 Procesando ${containers.length} containers`)
  return { table: 'containers', data: containers }
}

async function processVentasFile(data) {
  console.log(`💰 Procesando ventas...`)
  
  const ventas = data.map(row => ({
    sku: row.SKU || row.sku || row.Sku,
    cantidad: parseInt(row.Cantidad || row.cantidad || row.CANTIDAD || 0),
    fecha_venta: row.Fecha_Venta || row.fecha_venta || row.FECHA_VENTA || new Date().toISOString()
  })).filter(v => v.sku && String(v.sku).trim() !== '' && v.cantidad > 0) // Solo ventas válidas
  
  console.log(`💰 Procesando ${ventas.length} ventas`)
  return { table: 'ventas', data: ventas }
}

async function insertDataIntoTable(table, data) {
  console.log(`📝 Insertando ${data.length} registros en tabla ${table}...`)
  
  if (data.length === 0) {
    console.log(`⚠️  No hay datos para insertar en ${table}`)
    return { success: true, inserted: 0, errors: [] }
  }
  
  // Insertar en lotes para evitar timeouts
  const BATCH_SIZE = 100
  const results = []
  
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)
    console.log(`📝 Insertando lote ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} registros)...`)
    
    const { data: inserted, error } = await supabaseAdmin
      .from(table)
      .upsert(batch, { onConflict: table === 'products' ? 'sku' : (table === 'containers' ? 'container_number' : 'id') })
      .select()
    
    if (error) {
      console.error(`❌ Error en lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error.message)
      results.push({ batch: Math.floor(i/BATCH_SIZE) + 1, error: error.message, count: 0 })
    } else {
      console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} insertado exitosamente (${inserted?.length || batch.length} registros)`)
      results.push({ batch: Math.floor(i/BATCH_SIZE) + 1, error: null, count: inserted?.length || batch.length })
    }
  }
  
  const totalInserted = results.reduce((sum, r) => sum + r.count, 0)
  const errors = results.filter(r => r.error).map(r => r.error)
  
  return {
    success: errors.length === 0,
    inserted: totalInserted,
    errors: errors,
    totalBatches: results.length
  }
}

async function processAllFiles() {
  try {
    console.log('🚀 Iniciando procesamiento de archivos desde Storage...\n')
    
    // Listar archivos en Storage
    const { data: files } = await supabaseAdmin.storage.from('archivos').list()
    console.log(`📁 Archivos en Storage: ${files?.map(f => f.name).join(', ')}`)
    
    const results = []
    
    for (const [filename, config] of Object.entries(FILE_MAPPINGS)) {
      console.log(`\n📋 === PROCESANDO ${filename} ===`)
      
      try {
        // 1. Descargar archivo
        const fileBuffer = await downloadFileFromStorage(filename)
        const arrayBuffer = await fileBuffer.arrayBuffer()
        
        // 2. Parsear Excel
        const excelData = parseExcelFile(new Uint8Array(arrayBuffer))
        
        // 3. Procesar datos específicos
        const { table, data } = await config.processor(excelData)
        
        // 4. Insertar en tabla
        const insertResult = await insertDataIntoTable(table, data)
        
        results.push({
          filename,
          table,
          totalRows: excelData.length,
          processedRows: data.length,
          insertedRows: insertResult.inserted,
          success: insertResult.success,
          errors: insertResult.errors
        })
        
        console.log(`✅ ${filename} procesado: ${insertResult.inserted}/${data.length} registros insertados`)
        
      } catch (error) {
        console.error(`❌ Error procesando ${filename}:`, error.message)
        results.push({
          filename,
          table: config.table,
          error: error.message,
          success: false
        })
      }
    }
    
    // Resumen final
    console.log('\n📊 === RESUMEN FINAL ===')
    const totalSuccess = results.filter(r => r.success).length
    const totalFiles = results.length
    
    results.forEach(r => {
      if (r.success) {
        console.log(`✅ ${r.filename} → ${r.table}: ${r.insertedRows} registros`)
      } else {
        console.log(`❌ ${r.filename} → ${r.table}: ERROR - ${r.error}`)
      }
    })
    
    console.log(`\n🎯 Procesamiento completado: ${totalSuccess}/${totalFiles} archivos exitosos`)
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

// Ejecutar el procesamiento
processAllFiles()