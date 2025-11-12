require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Contando TODAS las predicciones de hoy...\n')

  // Obtener todas en páginas
  let allPredictions = []
  let page = 0
  const pageSize = 1000

  while (true) {
    const { data } = await supabase
      .from('predicciones')
      .select('sku, stock_actual, created_at')
      .gte('fecha_calculo', '2025-11-12')
      .lt('fecha_calculo', '2025-11-13')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (!data || data.length === 0) break

    allPredictions = allPredictions.concat(data)
    console.log(`   Página ${page + 1}: ${data.length} registros (acumulado: ${allPredictions.length})`)

    if (data.length < pageSize) break
    page++
  }

  console.log(`\n📊 Total predicciones de hoy: ${allPredictions.length}`)

  // Analizar stock
  const conStock0 = allPredictions.filter(p => p.stock_actual === 0 || p.stock_actual === null).length
  const conStockPositivo = allPredictions.filter(p => p.stock_actual > 0).length

  console.log(`\n📦 Análisis de stock:`)
  console.log(`   Con stock = 0: ${conStock0} (${(conStock0/allPredictions.length*100).toFixed(1)}%)`)
  console.log(`   Con stock > 0: ${conStockPositivo} (${(conStockPositivo/allPredictions.length*100).toFixed(1)}%)`)

  // Ver timestamps
  const timestamps = [...new Set(allPredictions.map(p => p.created_at.split('.')[0]))]
  console.log(`\n⏰ Timestamps de inserción: ${timestamps.length}`)

  // Agrupar por timestamp
  const porTimestamp = {}
  allPredictions.forEach(p => {
    const ts = p.created_at.split('.')[0]
    if (!porTimestamp[ts]) {
      porTimestamp[ts] = { total: 0, conStock: 0 }
    }
    porTimestamp[ts].total++
    if (p.stock_actual > 0) porTimestamp[ts].conStock++
  })

  console.log('\n📅 Predicciones por timestamp:')
  Object.entries(porTimestamp)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .forEach(([ts, stats]) => {
      console.log(`   ${ts}: ${stats.total} pred (${stats.conStock} con stock)`)
    })
}

main()
