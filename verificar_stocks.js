require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Investigando problema de stock_actual en cero...\n')

  // 1. Ver ejemplos de predicciones con stock
  const { data: predicciones } = await supabase
    .from('predicciones')
    .select('sku, stock_actual, dias_stock_actual, sugerencia_reposicion')
    .gte('fecha_calculo', '2025-11-12')
    .order('valor_total_sugerencia', { ascending: false })
    .limit(20)

  console.log('📊 Top 20 predicciones - Stock Actual:')
  predicciones?.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.sku}`)
    console.log(`      Stock actual: ${p.stock_actual}`)
    console.log(`      Días stock: ${p.dias_stock_actual}`)
    console.log(`      Sugerencia: ${p.sugerencia_reposicion}`)
  })

  // 2. Contar cuántas predicciones tienen stock = 0
  const conCero = predicciones?.filter(p => p.stock_actual === 0).length || 0
  const conStock = predicciones?.filter(p => p.stock_actual > 0).length || 0

  console.log(`\n📈 Estadísticas:`)
  console.log(`   Con stock = 0: ${conCero}/${predicciones?.length}`)
  console.log(`   Con stock > 0: ${conStock}/${predicciones?.length}`)

  // 3. Verificar tabla de stocks
  console.log('\n📦 Verificando tabla de stocks...')
  const { data: stocks, error: errorStocks } = await supabase
    .from('stocks')
    .select('*')
    .limit(10)

  if (errorStocks) {
    console.error('❌ Error leyendo tabla stocks:', errorStocks)
  } else {
    console.log(`   Total registros (muestra): ${stocks?.length}`)
    if (stocks && stocks.length > 0) {
      console.log('\n   Ejemplos:')
      stocks.slice(0, 5).forEach(s => {
        console.log(`   - SKU: ${s.sku}, Stock: ${s.stock_actual || 'N/A'}`)
      })
    } else {
      console.log('   ⚠️  Tabla stocks está vacía o no existe')
    }
  }

  // 4. Verificar si hay columna de stock en ventas
  console.log('\n📊 Verificando columnas en tabla ventas...')
  const { data: ventas } = await supabase
    .from('ventas')
    .select('*')
    .limit(1)

  if (ventas && ventas.length > 0) {
    console.log('   Columnas disponibles:', Object.keys(ventas[0]).join(', '))
  }
}

main()
