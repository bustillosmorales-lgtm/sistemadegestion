require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando columnas en stock_actual...\n')

  const { data, error } = await supabase
    .from('stock_actual')
    .select('*')
    .limit(5)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ Columnas en tabla stock_actual:')
    Object.keys(data[0]).forEach(col => {
      console.log(`   - ${col}`)
    })

    console.log('\n📊 Ejemplos de registros con stock > 0:')
    const { data: conStock } = await supabase
      .from('stock_actual')
      .select('*')
      .gt('stock_total', 0)
      .order('stock_total', { ascending: false })
      .limit(5)

    conStock?.forEach((row, i) => {
      console.log(`\n${i+1}. SKU: ${row.sku}`)
      console.log(`   stock_bodega_central: ${row.stock_bodega_central}`)
      console.log(`   stock_full_tlt_meli: ${row.stock_full_tlt_meli}`)
      console.log(`   stock_full_lmc_meli: ${row.stock_full_lmc_meli}`)
      console.log(`   stock_total: ${row.stock_total}`)
    })

    // Verificar si hay SKUs de las predicciones en stock_actual
    console.log('\n\n🔍 Verificando SKUs de predicciones en stock_actual...')
    const skusPrediccion = ['649762434724', '649762436650', 'R-CIB0100927', 'R-KTHY017511']

    for (const sku of skusPrediccion) {
      const { data: stockSKU } = await supabase
        .from('stock_actual')
        .select('sku, stock_total')
        .eq('sku', sku)
        .single()

      if (stockSKU) {
        console.log(`   ✅ ${sku}: stock_total = ${stockSKU.stock_total}`)
      } else {
        console.log(`   ❌ ${sku}: NO ENCONTRADO en stock_actual`)
      }
    }
  }
}

main()
