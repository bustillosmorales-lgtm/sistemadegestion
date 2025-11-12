require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando estructura de stock_actual...\n')

  try {
    // Intentar leer un registro para ver las columnas
    const { data, error } = await supabase
      .from('stock_actual')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Error:', error.message)
      return
    }

    if (data && data.length > 0) {
      console.log('✅ Tabla existe con las siguientes columnas:')
      Object.keys(data[0]).forEach(col => {
        console.log(`   - ${col}`)
      })
      console.log('\nEjemplo de registro:')
      console.log(data[0])
    } else {
      console.log('ℹ️  Tabla existe pero está vacía')

      // Intentar insertar un registro de prueba para ver qué columnas acepta
      const testRecord = {
        sku: 'TEST123'
      }

      const { error: insertError } = await supabase
        .from('stock_actual')
        .insert(testRecord)

      if (insertError) {
        console.log('\n❌ Error al insertar prueba:', insertError.message)
      }
    }
  } catch (e) {
    console.error('❌ Error:', e.message)
  }
}

main()
