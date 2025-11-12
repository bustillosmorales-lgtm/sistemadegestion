require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando predicciones con descripción...\n')

  const { data } = await supabase
    .from('predicciones')
    .select('sku, descripcion, stock_actual, tendencia, valor_total_sugerencia, clasificacion_abc')
    .gte('fecha_calculo', '2025-11-12')
    .order('valor_total_sugerencia', { ascending: false })
    .limit(10)

  if (data && data.length > 0) {
    console.log('✅ Top 10 predicciones con descripción:\n')
    data.forEach((p, i) => {
      console.log(`${i+1}. SKU: ${p.sku} [${p.clasificacion_abc}]`)
      console.log(`   Descripción: ${p.descripcion || 'SIN DESCRIPCIÓN'}`)
      console.log(`   Stock: ${p.stock_actual}`)
      console.log(`   Tendencia: ${p.tendencia}`)
      console.log(`   Valor: $${(p.valor_total_sugerencia/1000).toFixed(0)}k\n`)
    })

    // Contar cuántas tienen descripción
    const conDescripcion = data.filter(p => p.descripcion && p.descripcion.trim() !== '').length
    const sinDescripcion = data.length - conDescripcion

    console.log(`📊 Estadísticas:`)
    console.log(`   Con descripción: ${conDescripcion}/${data.length}`)
    console.log(`   Sin descripción: ${sinDescripcion}/${data.length}`)
  } else {
    console.log('❌ No se encontraron predicciones')
  }
}

main()
