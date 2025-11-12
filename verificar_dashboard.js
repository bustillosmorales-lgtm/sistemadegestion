require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  console.log('📊 Verificando predicciones en dashboard...\n')

  // Simular query del dashboard (app/page.tsx)
  const { data, error } = await supabase
    .from('predicciones')
    .select('*')
    .order('fecha_calculo', { ascending: false })
    .order('valor_total_sugerencia', { ascending: false })
    .limit(5000)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`✅ Total predicciones: ${data.length}`)

  // Filtrar últimas predicciones (fecha más reciente)
  const fechaMasReciente = data[0]?.fecha_calculo
  const ultimasFecha = data.filter(p => p.fecha_calculo === fechaMasReciente)

  console.log(`📅 Fecha más reciente: ${fechaMasReciente?.split('T')[0]}`)
  console.log(`   Predicciones de esta fecha: ${ultimasFecha.length}`)

  // Verificar PACK SKUs
  const packs = ultimasFecha.filter(p => p.sku.startsWith('PACK'))
  const reales = ultimasFecha.filter(p => !p.sku.startsWith('PACK'))

  console.log(`\n📦 Análisis de SKUs:`)
  console.log(`   SKUs tipo PACK: ${packs.length}`)
  console.log(`   SKUs reales: ${reales.length}`)
  console.log(`   Porcentaje real: ${(reales.length/ultimasFecha.length*100).toFixed(1)}%`)

  if (packs.length === 0) {
    console.log(`\n✅ ¡PERFECTO! Dashboard mostrará solo SKUs reales`)
  } else {
    console.log(`\n⚠️  Dashboard incluye ${packs.length} SKUs tipo PACK`)
  }

  // Top 5 predicciones
  console.log(`\n💰 Top 5 predicciones por valor:`)
  ultimasFecha
    .sort((a, b) => b.valor_total_sugerencia - a.valor_total_sugerencia)
    .slice(0, 5)
    .forEach((p, i) => {
      const tipo = p.sku.startsWith('PACK') ? '📦' : '✅'
      console.log(`   ${i+1}. ${tipo} ${p.sku} [${p.clasificacion_abc}] - $${(p.valor_total_sugerencia/1000).toFixed(0)}k`)
    })

  // Estadísticas generales
  const totalSugerencia = ultimasFecha.reduce((sum, p) => sum + p.sugerencia_reposicion, 0)
  const totalValor = ultimasFecha.reduce((sum, p) => sum + p.valor_total_sugerencia, 0)

  console.log(`\n📈 Resumen:`)
  console.log(`   Unidades sugeridas: ${totalSugerencia.toLocaleString()}`)
  console.log(`   Valor total: $${(totalValor/1000000).toFixed(2)}M`)

  // Clasificación ABC
  const clasificacion = {
    A: ultimasFecha.filter(p => p.clasificacion_abc === 'A').length,
    B: ultimasFecha.filter(p => p.clasificacion_abc === 'B').length,
    C: ultimasFecha.filter(p => p.clasificacion_abc === 'C').length
  }

  console.log(`\n📊 Clasificación ABC:`)
  console.log(`   A: ${clasificacion.A} SKUs`)
  console.log(`   B: ${clasificacion.B} SKUs`)
  console.log(`   C: ${clasificacion.C} SKUs`)
}

main()
