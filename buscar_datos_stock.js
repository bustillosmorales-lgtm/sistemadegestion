require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Buscando dónde está la información de stock...\n')

  // 1. Listar todas las tablas
  console.log('📋 Tablas disponibles:')
  const { data: tables } = await supabase.rpc('get_tables')

  // Si no hay función get_tables, intentar con las tablas conocidas
  const tablasConocidas = ['ventas', 'packs', 'predicciones', 'otros_datos', 'metricas']

  for (const tabla of tablasConocidas) {
    try {
      const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .limit(1)

      if (!error && data) {
        console.log(`\n✅ Tabla: ${tabla}`)
        if (data.length > 0) {
          console.log('   Columnas:', Object.keys(data[0]).join(', '))
        }
      }
    } catch (e) {
      // Tabla no existe
    }
  }

  // 2. Ver si otros_datos tiene stock
  console.log('\n\n📦 Verificando tabla otros_datos...')
  const { data: otrosDatos, error: errorOtros } = await supabase
    .from('otros_datos')
    .select('*')
    .limit(5)

  if (errorOtros) {
    console.error('❌ Error:', errorOtros.message)
  } else if (otrosDatos && otrosDatos.length > 0) {
    console.log('   ✅ Tabla existe con', otrosDatos.length, 'registros')
    console.log('   Columnas:', Object.keys(otrosDatos[0]).join(', '))
    console.log('\n   Ejemplos:')
    otrosDatos.forEach(d => {
      const stockCols = Object.keys(d).filter(k => k.toLowerCase().includes('stock'))
      console.log(`   - SKU: ${d.sku || d.SKU}`)
      stockCols.forEach(col => {
        console.log(`     ${col}: ${d[col]}`)
      })
    })
  }

  // 3. Contar registros en otros_datos
  const { count } = await supabase
    .from('otros_datos')
    .select('*', { count: 'exact', head: true })

  console.log(`\n   📊 Total registros en otros_datos: ${count}`)
}

main()
