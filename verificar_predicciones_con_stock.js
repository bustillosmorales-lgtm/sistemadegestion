require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando predicciones con stock > 0...\n')

  // Buscar predicciones con stock_actual > 0
  const { data: conStock } = await supabase
    .from('predicciones')
    .select('sku, stock_actual, dias_stock_actual, sugerencia_reposicion, valor_total_sugerencia')
    .gte('fecha_calculo', '2025-11-12')
    .gt('stock_actual', 0)
    .order('stock_actual', { ascending: false })
    .limit(20)

  console.log(`✅ Predicciones con stock_actual > 0: ${conStock?.length || 0}`)

  if (conStock && conStock.length > 0) {
    console.log('\n📦 Top 20 predicciones con stock:')
    conStock.forEach((p, i) => {
      console.log(`\n${i+1}. SKU: ${p.sku}`)
      console.log(`   Stock actual: ${p.stock_actual}`)
      console.log(`   Días stock: ${p.dias_stock_actual.toFixed(1)}`)
      console.log(`   Sugerencia: ${p.sugerencia_reposicion}`)
    })
  } else {
    console.log('\n⚠️  NO hay predicciones con stock_actual > 0')
    console.log('\nVerificando datos en stock_actual...')

    // Ver algunos SKUs con stock
    const { data: stockDisponible } = await supabase
      .from('stock_actual')
      .select('sku, stock_total')
      .gt('stock_total', 100)
      .limit(10)

    console.log(`\n📊 SKUs con stock > 100 en stock_actual: ${stockDisponible?.length}`)
    stockDisponible?.forEach((s, i) => {
      console.log(`   ${i+1}. ${s.sku}: ${s.stock_total}`)
    })

    // Verificar si estos SKUs tienen predicciones
    if (stockDisponible && stockDisponible.length > 0) {
      console.log('\n🔍 ¿Estos SKUs tienen predicciones?')
      for (const s of stockDisponible.slice(0, 5)) {
        const { data: pred } = await supabase
          .from('predicciones')
          .select('sku, stock_actual')
          .gte('fecha_calculo', '2025-11-12')
          .eq('sku', s.sku)
          .single()

        if (pred) {
          console.log(`   ✅ ${s.sku}: predicción existe, stock_actual = ${pred.stock_actual}`)
        } else {
          console.log(`   ❌ ${s.sku}: NO tiene predicción`)
        }
      }
    }
  }

  // Estadísticas generales
  console.log('\n📊 Estadísticas de predicciones:')
  const { data: todasPred } = await supabase
    .from('predicciones')
    .select('stock_actual')
    .gte('fecha_calculo', '2025-11-12')

  if (todasPred) {
    const conStock0 = todasPred.filter(p => p.stock_actual === 0).length
    const conStockPositivo = todasPred.filter(p => p.stock_actual > 0).length

    console.log(`   Total predicciones: ${todasPred.length}`)
    console.log(`   Con stock = 0: ${conStock0} (${(conStock0/todasPred.length*100).toFixed(1)}%)`)
    console.log(`   Con stock > 0: ${conStockPositivo} (${(conStockPositivo/todasPred.length*100).toFixed(1)}%)`)
  }
}

main()
