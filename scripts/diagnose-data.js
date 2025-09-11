// scripts/diagnose-data.js
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

async function diagnoseFile(filename, tableName) {
  console.log(`\n🔍 === DIAGNOSTICANDO ${filename} ===`)
  
  try {
    // Descargar archivo
    const { data: fileBuffer } = await supabaseAdmin.storage
      .from('archivos')
      .download(filename)
    
    const arrayBuffer = await fileBuffer.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    
    console.log(`📋 Total de filas en Excel: ${jsonData.length}`)
    
    // Mostrar estructura de las primeras 3 filas
    console.log(`\n📊 Estructura de datos (primeras 3 filas):`)
    jsonData.slice(0, 3).forEach((row, i) => {
      console.log(`\nFila ${i + 1}:`)
      Object.keys(row).forEach(key => {
        console.log(`   ${key}: "${row[key]}"`)
      })
    })
    
    // Analizar problemas específicos según el tipo
    if (tableName === 'compras') {
      console.log(`\n🛒 Análisis específico de COMPRAS:`)
      
      const filasConSku = jsonData.filter(row => row.SKU || row.sku || row.Sku)
      console.log(`- Filas con SKU: ${filasConSku.length}`)
      
      const filasConSkuValido = jsonData.filter(row => {
        const sku = row.SKU || row.sku || row.Sku
        return sku && String(sku).trim() !== ''
      })
      console.log(`- Filas con SKU válido: ${filasConSkuValido.length}`)
      
      // Mostrar ejemplos de SKUs problemáticos
      const problemRows = jsonData.filter(row => {
        const sku = row.SKU || row.sku || row.Sku
        return !sku || String(sku).trim() === ''
      }).slice(0, 5)
      
      if (problemRows.length > 0) {
        console.log(`\n❌ Ejemplos de filas SIN SKU válido:`)
        problemRows.forEach((row, i) => {
          console.log(`   Fila ${i + 1}: SKU="${row.SKU || row.sku || row.Sku}" (${typeof(row.SKU || row.sku || row.Sku)})`)
        })
      }
      
    } else if (tableName === 'ventas') {
      console.log(`\n💰 Análisis específico de VENTAS:`)
      
      const filasConSku = jsonData.filter(row => row.SKU || row.sku || row.Sku)
      console.log(`- Filas con SKU: ${filasConSku.length}`)
      
      const filasConCantidad = jsonData.filter(row => {
        const cantidad = parseInt(row.Cantidad || row.cantidad || row.CANTIDAD || 0)
        return cantidad > 0
      })
      console.log(`- Filas con cantidad > 0: ${filasConCantidad.length}`)
      
      const filasValidas = jsonData.filter(row => {
        const sku = row.SKU || row.sku || row.Sku
        const cantidad = parseInt(row.Cantidad || row.cantidad || row.CANTIDAD || 0)
        return sku && String(sku).trim() !== '' && cantidad > 0
      })
      console.log(`- Filas completamente válidas: ${filasValidas.length}`)
      
      // Mostrar ejemplos de problemas
      const skuProblems = jsonData.filter(row => {
        const sku = row.SKU || row.sku || row.Sku
        return !sku || String(sku).trim() === ''
      }).slice(0, 3)
      
      const cantidadProblems = jsonData.filter(row => {
        const cantidad = parseInt(row.Cantidad || row.cantidad || row.CANTIDAD || 0)
        return cantidad <= 0
      }).slice(0, 3)
      
      if (skuProblems.length > 0) {
        console.log(`\n❌ Problemas con SKU:`)
        skuProblems.forEach((row, i) => {
          console.log(`   Fila ${i + 1}: SKU="${row.SKU || row.sku || row.Sku}"`)
        })
      }
      
      if (cantidadProblems.length > 0) {
        console.log(`\n❌ Problemas con cantidad:`)
        cantidadProblems.forEach((row, i) => {
          const cantidad = row.Cantidad || row.cantidad || row.CANTIDAD
          console.log(`   Fila ${i + 1}: Cantidad="${cantidad}" (${typeof cantidad})`)
        })
      }
    }
    
  } catch (error) {
    console.error(`❌ Error diagnosticando ${filename}:`, error.message)
  }
}

async function main() {
  console.log('🔍 DIAGNÓSTICO DE ARCHIVOS')
  console.log('=========================')
  
  await diagnoseFile('template_compras.xlsx', 'compras')
  await diagnoseFile('template_ventas.xlsx', 'ventas')
  
  // También verificar conteos actuales en DB
  console.log(`\n📊 CONTEOS ACTUALES EN BASE DE DATOS:`)
  
  const { count: comprasCount } = await supabaseAdmin
    .from('compras')
    .select('*', { count: 'exact', head: true })
  
  const { count: ventasCount } = await supabaseAdmin
    .from('ventas')
    .select('*', { count: 'exact', head: true })
  
  console.log(`- Compras en DB: ${comprasCount}`)
  console.log(`- Ventas en DB: ${ventasCount}`)
}

main()