// scripts/fix-missing-data.js
const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos')
  console.log('Configura estas variables en tu archivo .env.local')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey)

// Cache de SKUs válidos
let validSkus = new Set()

async function loadValidSkus() {
  console.log('📋 Cargando SKUs válidos desde tabla products...')
  
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('sku')
  
  if (error) {
    throw new Error(`Error cargando SKUs: ${error.message}`)
  }
  
  validSkus = new Set(products.map(p => p.sku))
  console.log(`✅ ${validSkus.size} SKUs válidos cargados`)
  
  return validSkus
}

async function processComprasFile() {
  console.log('\n🛒 === PROCESANDO COMPRAS CON SKUs VÁLIDOS ===')
  
  // Descargar archivo
  const { data: fileBuffer } = await supabaseAdmin.storage
    .from('archivos')
    .download('template_compras.xlsx')
  
  const arrayBuffer = await fileBuffer.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet)
  
  console.log(`📊 Total filas en Excel: ${jsonData.length}`)
  
  // Procesar y filtrar por SKUs válidos
  const compras = jsonData.map(row => ({
    sku: row.sku || row.SKU || row.Sku,
    cantidad: parseInt(row.cantidad || 0),
    fecha_compra: new Date().toISOString(),
    fecha_llegada_estimada: null,
    fecha_llegada_real: null,
    status_compra: 'pendiente'
  })).filter(c => c.sku && validSkus.has(c.sku) && c.cantidad > 0)
  
  console.log(`✅ Compras con SKUs válidos: ${compras.length}`)
  console.log(`❌ Compras filtradas por SKU inválido: ${jsonData.length - compras.length}`)
  
  if (compras.length === 0) {
    console.log('⚠️ No hay compras válidas para insertar')
    return
  }
  
  // Insertar en lotes
  const BATCH_SIZE = 100
  let totalInserted = 0
  
  for (let i = 0; i < compras.length; i += BATCH_SIZE) {
    const batch = compras.slice(i, i + BATCH_SIZE)
    console.log(`📝 Insertando lote ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} compras)...`)
    
    const { data: inserted, error } = await supabaseAdmin
      .from('compras')
      .insert(batch)
      .select()
    
    if (error) {
      console.error(`❌ Error en lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error.message)
      // Mostrar algunos SKUs problemáticos
      const problemSkus = batch.slice(0, 5).map(b => b.sku)
      console.log(`   SKUs en este lote: ${problemSkus.join(', ')}`)
    } else {
      totalInserted += inserted?.length || 0
      console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} insertado: ${inserted?.length || 0} registros`)
    }
  }
  
  console.log(`\n📊 COMPRAS - Total insertado: ${totalInserted}/${compras.length}`)
}

async function processVentasFile() {
  console.log('\n💰 === PROCESANDO VENTAS CON SKUs VÁLIDOS ===')
  
  // Descargar archivo
  const { data: fileBuffer } = await supabaseAdmin.storage
    .from('archivos')
    .download('template_ventas.xlsx')
  
  const arrayBuffer = await fileBuffer.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet)
  
  console.log(`📊 Total filas en Excel: ${jsonData.length}`)
  
  // Procesar y filtrar por SKUs válidos
  const ventas = jsonData.map(row => ({
    sku: row.sku || row.SKU || row.Sku,
    cantidad: parseInt(row.cantidad || 0),
    fecha_venta: new Date().toISOString()
  })).filter(v => v.sku && String(v.sku).trim() !== '' && validSkus.has(v.sku) && v.cantidad > 0)
  
  console.log(`✅ Ventas con SKUs válidos: ${ventas.length}`)
  console.log(`❌ Ventas filtradas por SKU inválido: ${jsonData.length - ventas.length}`)
  
  if (ventas.length === 0) {
    console.log('⚠️ No hay ventas válidas para insertar')
    return
  }
  
  // Insertar en lotes
  const BATCH_SIZE = 100
  let totalInserted = 0
  
  for (let i = 0; i < ventas.length; i += BATCH_SIZE) {
    const batch = ventas.slice(i, i + BATCH_SIZE)
    console.log(`📝 Insertando lote ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} ventas)...`)
    
    const { data: inserted, error } = await supabaseAdmin
      .from('ventas')
      .insert(batch)
      .select()
    
    if (error) {
      console.error(`❌ Error en lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error.message)
    } else {
      totalInserted += inserted?.length || 0
      console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} insertado: ${inserted?.length || 0} registros`)
    }
  }
  
  console.log(`\n📊 VENTAS - Total insertado: ${totalInserted}/${ventas.length}`)
}

async function main() {
  try {
    console.log('🔧 REPARANDO DATOS FALTANTES')
    console.log('=============================')
    
    // 1. Cargar SKUs válidos
    await loadValidSkus()
    
    // 2. Procesar compras
    await processComprasFile()
    
    // 3. Procesar ventas  
    await processVentasFile()
    
    // 4. Verificar conteos finales
    console.log('\n📊 CONTEOS FINALES:')
    
    const { count: comprasCount } = await supabaseAdmin
      .from('compras')
      .select('*', { count: 'exact', head: true })
    
    const { count: ventasCount } = await supabaseAdmin
      .from('ventas')  
      .select('*', { count: 'exact', head: true })
    
    console.log(`📋 Compras en DB: ${comprasCount}`)
    console.log(`💰 Ventas en DB: ${ventasCount}`)
    
    console.log('\n🎯 ¡Reparación completada!')
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

main()