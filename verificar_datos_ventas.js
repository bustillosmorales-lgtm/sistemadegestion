require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando estructura de datos de ventas...\n')

  const { data } = await supabase
    .from('ventas')
    .select('*')
    .limit(5)

  if (data && data.length > 0) {
    console.log('📊 Columnas disponibles en tabla ventas:')
    Object.keys(data[0]).forEach(col => {
      console.log(`   - ${col}`)
    })

    console.log('\n📦 Ejemplos de registros:')
    data.forEach((v, i) => {
      console.log(`\n${i+1}. SKU: ${v.sku}`)
      console.log(`   Fecha: ${v.fecha}`)
      console.log(`   Unidades: ${v.unidades}`)
      console.log(`   Precio: ${v.precio}`)

      // Ver si hay columnas de stock
      const stockCols = Object.keys(v).filter(k => k.toLowerCase().includes('stock'))
      if (stockCols.length > 0) {
        console.log(`   ✅ Datos de stock disponibles:`)
        stockCols.forEach(col => {
          console.log(`      ${col}: ${v[col]}`)
        })
      } else {
        console.log(`   ❌ No hay datos de stock histórico`)
      }
    })
  }
}

main()
