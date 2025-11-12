require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando predicciones de HOY (2025-11-12)...\n')

  // Total predicciones de hoy
  const { data: total, error } = await supabase
    .from('predicciones')
    .select('sku', { count: 'exact' })
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')

  console.log(`📊 Total predicciones hoy: ${total?.length || 0}`)

  // SKUs tipo PACK de hoy
  const { data: packs } = await supabase
    .from('predicciones')
    .select('sku')
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')
    .ilike('sku', 'PACK%')

  console.log(`📦 SKUs tipo PACK hoy: ${packs?.length || 0}`)

  if (packs && packs.length > 0) {
    console.log('\n⚠️  Ejemplos de PACK que NO deberían estar:')
    packs.slice(0, 10).forEach(p => console.log(`  - ${p.sku}`))
  } else {
    console.log('\n✅ ¡Perfecto! No hay SKUs tipo PACK en predicciones de hoy')
  }

  // Top 5 de hoy
  const { data: top5 } = await supabase
    .from('predicciones')
    .select('sku, valor_total_sugerencia, clasificacion_abc')
    .gte('fecha_calculo', '2025-11-12')
    .lt('fecha_calculo', '2025-11-13')
    .order('valor_total_sugerencia', { ascending: false })
    .limit(5)

  console.log('\n💰 Top 5 productos por valor (hoy):')
  top5?.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.sku} [${p.clasificacion_abc}] - $${(p.valor_total_sugerencia/1000).toFixed(0)}k`)
  })
}

main()
