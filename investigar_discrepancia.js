require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Investigando discrepancia en predicciones de hoy...\n')

  // 1. Contar TODAS las predicciones de hoy (sin límite)
  const { count: totalCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true })
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')

  console.log(`📊 Total REAL de predicciones hoy: ${totalCount}`)

  // 2. Ver las últimas 20 predicciones insertadas (por created_at)
  const { data: ultimas } = await supabase
    .from('predicciones')
    .select('sku, fecha_calculo, created_at')
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')
    .order('created_at', { ascending: false })
    .limit(20)

  console.log('\n⏰ Últimas 20 predicciones insertadas:')
  ultimas?.forEach((p, i) => {
    const isPack = p.sku.startsWith('PACK') ? '📦' : '✅'
    console.log(`  ${i+1}. ${isPack} ${p.sku} - insertado: ${p.created_at}`)
  })

  // 3. Contar por tipo (PACK vs real)
  const { data: allToday } = await supabase
    .from('predicciones')
    .select('sku')
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')

  const packs = allToday?.filter(p => p.sku.startsWith('PACK')) || []
  const reales = allToday?.filter(p => !p.sku.startsWith('PACK')) || []

  console.log(`\n📦 SKUs tipo PACK: ${packs.length}`)
  console.log(`✅ SKUs reales: ${reales.length}`)
  console.log(`📊 Total verificado: ${allToday?.length}`)

  // 4. Ver distribución de created_at (solo de los primeros 1000)
  const timestamps = [...new Set(allToday?.map(p => {
    if (!p.created_at) return 'sin timestamp'
    try {
      const date = new Date(p.created_at)
      return date.toISOString().split('T')[0] + ' ' + date.toISOString().split('T')[1].split('.')[0]
    } catch {
      return 'timestamp inválido'
    }
  }))]

  console.log(`\n⏰ Timestamps de inserción únicos (muestra): ${timestamps.length}`)
  timestamps.slice(0, 5).forEach(t => console.log(`  - ${t}`))

  // 5. Verificar si hay duplicados por SKU
  const { data: duplicados } = await supabase
    .from('predicciones')
    .select('sku')
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')

  const conteoSKUs = {}
  duplicados?.forEach(p => {
    conteoSKUs[p.sku] = (conteoSKUs[p.sku] || 0) + 1
  })

  const duplicadosArray = Object.entries(conteoSKUs).filter(([_, count]) => count > 1)
  console.log(`\n🔄 SKUs duplicados: ${duplicadosArray.length}`)
  if (duplicadosArray.length > 0) {
    console.log('  Ejemplos:')
    duplicadosArray.slice(0, 10).forEach(([sku, count]) => {
      console.log(`  - ${sku}: ${count} veces`)
    })
  }
}

main()
