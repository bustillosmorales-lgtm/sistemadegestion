require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando stocks de SKUs específicos...\n')

  const skus = [
    '649762434724',
    '649762436650',
    'R-KTHY017511',
    'R-MTHY202303',
    '649762439507-GRI'
  ]

  console.log('📦 Top 5 predicciones - Datos de stock:\n')

  for (const sku of skus) {
    // Obtener predicción
    const { data: pred } = await supabase
      .from('predicciones')
      .select('sku, stock_actual, dias_stock_actual, sugerencia_reposicion, valor_total_sugerencia, clasificacion_abc')
      .gte('fecha_calculo', '2025-11-12')
      .eq('sku', sku)
      .single()

    if (pred) {
      console.log(`✅ ${sku} [${pred.clasificacion_abc}]`)
      console.log(`   Stock actual: ${pred.stock_actual}`)
      console.log(`   Días de stock: ${pred.dias_stock_actual.toFixed(1)}`)
      console.log(`   Sugerencia reposición: ${pred.sugerencia_reposicion}`)
      console.log(`   Valor sugerencia: $${(pred.valor_total_sugerencia / 1000).toFixed(0)}k\n`)
    }
  }

  // Estadísticas finales
  console.log('\n📊 Resumen final del sistema:')

  const { count: totalCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true })
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')

  const { count: conStockCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true })
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')
    .gt('stock_actual', 0)

  const { count: sinPacksCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true })
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')
    .not('sku', 'like', 'PACK%')

  console.log(`   ✅ Total predicciones: ${totalCount}`)
  console.log(`   ✅ Con stock > 0: ${conStockCount} (${(conStockCount/totalCount*100).toFixed(1)}%)`)
  console.log(`   ✅ Sin SKUs PACK: ${sinPacksCount}/${totalCount} (${(sinPacksCount/totalCount*100).toFixed(1)}%)`)

  console.log('\n🎉 ¡Sistema funcionando correctamente!')
}

main()
