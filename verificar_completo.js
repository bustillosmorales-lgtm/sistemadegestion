require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificación COMPLETA de predicciones de hoy...\n')

  // 1. Contar total (esto NO tiene límite)
  const { count: totalCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true })
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')

  console.log(`📊 Total REAL en base de datos: ${totalCount}`)

  // 2. Obtener TODOS los SKUs (sin límite de 1000)
  console.log('\n📥 Obteniendo todos los SKUs...')
  let allPredictions = []
  let page = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('predicciones')
      .select('sku, created_at')
      .gte('fecha_calculo', '2025-11-12')
      .lt('fecha_calculo', '2025-11-13')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error('Error:', error)
      break
    }

    if (!data || data.length === 0) break

    allPredictions = allPredictions.concat(data)
    console.log(`   Página ${page + 1}: ${data.length} registros (total acumulado: ${allPredictions.length})`)

    if (data.length < pageSize) break
    page++
  }

  // 3. Analizar los resultados
  const packs = allPredictions.filter(p => p.sku.startsWith('PACK'))
  const reales = allPredictions.filter(p => !p.sku.startsWith('PACK'))

  console.log(`\n📦 Resultados finales:`)
  console.log(`   Total obtenido: ${allPredictions.length}`)
  console.log(`   SKUs tipo PACK: ${packs.length} (${(packs.length/allPredictions.length*100).toFixed(1)}%)`)
  console.log(`   SKUs reales: ${reales.length} (${(reales.length/allPredictions.length*100).toFixed(1)}%)`)

  // 4. Ver ejemplos de PACK
  if (packs.length > 0) {
    console.log(`\n⚠️  Primeros 15 SKUs tipo PACK encontrados:`)
    packs.slice(0, 15).forEach((p, i) => {
      console.log(`   ${i+1}. ${p.sku}`)
    })
  } else {
    console.log(`\n✅ ¡PERFECTO! No hay SKUs tipo PACK`)
  }

  // 5. Verificar timestamps de inserción
  const uniqueTimestamps = [...new Set(allPredictions.map(p => p.created_at))]
  console.log(`\n⏰ Timestamps únicos de inserción: ${uniqueTimestamps.length}`)
  uniqueTimestamps.slice(0, 3).forEach(t => {
    const count = allPredictions.filter(p => p.created_at === t).length
    console.log(`   ${t}: ${count} predicciones`)
  })

  // 6. Comparar con lo esperado del workflow
  console.log(`\n🔍 Comparación con workflow:`)
  console.log(`   Workflow reportó: 1,828 predicciones guardadas`)
  console.log(`   Base de datos tiene: ${allPredictions.length} predicciones`)
  console.log(`   Diferencia: ${allPredictions.length - 1828}`)
}

main()
