require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('📦 Cargando datos de stock a Supabase...\n')

  // 1. Leer Excel
  console.log('📊 Leyendo otros_datos.xlsx...')
  const workbook = XLSX.readFile('otros_datos.xlsx')
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(sheet)

  console.log(`   ✓ ${data.length} registros leídos`)

  // 2. Transformar datos al formato de Supabase
  console.log('\n🔄 Transformando datos...')
  const stockData = data
    .filter(row => row.CodArticulo) // Solo registros con SKU
    .map(row => {
      const stockTotal = (row['TLT BODEGACENTRAL'] || 0) +
                        (row['FULL TLT MELI'] || 0) +
                        (row['FULL LMC MELI'] || 0)

      return {
        sku: row.CodArticulo,
        stock_bodega_central: row['TLT BODEGACENTRAL'] || 0,
        stock_full_tlt_meli: row['FULL TLT MELI'] || 0,
        stock_full_lmc_meli: row['FULL LMC MELI'] || 0,
        stock_total: stockTotal,
        descripcion: row['Descripción Artículo'] || null
      }
    })

  console.log(`   ✓ ${stockData.length} registros válidos`)

  // 3. Limpiar tabla existente (si existe)
  console.log('\n🗑️  Limpiando datos antiguos...')
  try {
    // Intentar eliminar todos los registros existentes
    const { error: deleteError } = await supabase
      .from('stock_actual')
      .delete()
      .neq('sku', '')  // Eliminar todos

    if (deleteError && !deleteError.message.includes('Could not find')) {
      console.log(`   ⚠️  Error limpiando: ${deleteError.message}`)
    } else {
      console.log('   ✓ Limpieza completada')
    }
  } catch (e) {
    console.log('   ℹ️  Tabla nueva o vacía')
  }

  // 4. Insertar en lotes
  console.log('\n💾 Insertando datos en Supabase...')
  const batchSize = 100
  let insertados = 0
  let errores = 0

  for (let i = 0; i < stockData.length; i += batchSize) {
    const batch = stockData.slice(i, i + batchSize)

    try {
      const { error } = await supabase
        .from('stock_actual')
        .insert(batch)

      if (error) {
        console.log(`   ❌ Error en batch ${Math.floor(i/batchSize) + 1}: ${error.message}`)
        errores += batch.length
      } else {
        insertados += batch.length
        if ((i / batchSize) % 10 === 0) {
          console.log(`   ✓ ${insertados}/${stockData.length} registros insertados...`)
        }
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`)
      errores += batch.length
    }
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Insertados: ${insertados}`)
  console.log(`   Errores: ${errores}`)

  // 5. Verificar resultado
  console.log('\n🔍 Verificando datos...')
  const { count } = await supabase
    .from('stock_actual')
    .select('*', { count: 'exact', head: true })

  console.log(`   📊 Total registros en BD: ${count}`)

  // Ver ejemplos con stock
  const { data: ejemplos } = await supabase
    .from('stock_actual')
    .select('*')
    .gt('stock_total', 100)
    .order('stock_total', { ascending: false })
    .limit(5)

  if (ejemplos && ejemplos.length > 0) {
    console.log('\n💰 Top 5 SKUs con más stock:')
    ejemplos.forEach((e, i) => {
      console.log(`   ${i+1}. ${e.sku}: ${e.stock_total} unidades`)
    })
  }
}

main()
