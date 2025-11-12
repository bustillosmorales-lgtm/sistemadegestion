require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando campo descripcion en predicciones...\n')

  const { data } = await supabase
    .from('predicciones')
    .select('*')
    .gte('fecha_calculo', '2025-11-12')
    .limit(1)

  if (data && data.length > 0) {
    console.log('✅ Columnas en predicciones:')
    Object.keys(data[0]).forEach(col => {
      console.log(`   - ${col}`)
    })

    if (data[0].descripcion) {
      console.log(`\n✅ Campo descripcion existe: "${data[0].descripcion}"`)
    } else {
      console.log('\n⚠️  Campo descripcion NO existe en predicciones')
      console.log('    Necesitamos agregarlo al pipeline de forecasting')
    }
  }
}

main()
