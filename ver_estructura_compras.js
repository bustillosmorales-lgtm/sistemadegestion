require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Verificando estructura real de tabla compras...\n')

  // Intentar insertar un registro de prueba para ver el error
  const testRecord = {
    sku: 'TEST123',
    fecha: '2025-01-01',
    cantidad: 100
  }

  const { data, error } = await supabase
    .from('compras')
    .insert(testRecord)
    .select()

  if (error) {
    console.log('❌ Error al insertar:', error.message)
  } else {
    console.log('✅ Registro de prueba insertado')
    console.log('   Columnas detectadas:', Object.keys(data[0]).join(', '))

    // Eliminar el registro de prueba
    await supabase.from('compras').delete().eq('sku', 'TEST123')
  }
}

main()
