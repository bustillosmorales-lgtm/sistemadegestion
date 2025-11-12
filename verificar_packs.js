require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('📦 Verificando estructura de packs...\n')

  // Ver algunos ejemplos de packs
  const { data: packs, error } = await supabase
    .from('packs')
    .select('*')
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Ejemplos de packs:')
  console.table(packs)

  // Contar cuántos SKUs tipo PACK hay en predicciones
  const { data: packPredicciones, error: err2 } = await supabase
    .from('predicciones')
    .select('sku')
    .ilike('sku', 'PACK%')

  console.log(`\n⚠️  SKUs tipo PACK en predicciones: ${packPredicciones?.length || 0}`)

  if (packPredicciones && packPredicciones.length > 0) {
    console.log('\nEjemplos:')
    packPredicciones.slice(0, 10).forEach(p => console.log(`  - ${p.sku}`))
  }
}

main()
