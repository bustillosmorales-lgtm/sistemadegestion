require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando si tabla compras existe...\n')

  try {
    const { data, error } = await supabase
      .from('compras')
      .select('*')
      .limit(1)

    if (error) {
      if (error.message.includes('does not exist') || error.code === 'PGRST205') {
        console.log('❌ La tabla compras NO existe')
        console.log('   Error:', error.message)
      } else {
        console.log('⚠️  Tabla existe pero hay otro error:', error.message)
      }
    } else {
      console.log('✅ La tabla compras YA EXISTE')
      if (data && data.length > 0) {
        console.log('   Columnas:', Object.keys(data[0]).join(', '))
        console.log('   Registros:', data.length)
      } else {
        console.log('   La tabla está vacía')
      }
    }
  } catch (e) {
    console.error('❌ Error:', e.message)
  }
}

main()
