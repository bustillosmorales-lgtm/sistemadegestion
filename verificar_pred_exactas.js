require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('🔍 Analizando predicciones por fecha...\n')

  // Obtener últimas 5 fechas
  const { data: fechas } = await supabase
    .from('predicciones')
    .select('fecha_calculo')
    .order('fecha_calculo', { ascending: false })
    .limit(2000)

  if (!fechas) return

  // Contar por fecha
  const conteo = {}
  fechas.forEach(f => {
    const fecha = f.fecha_calculo.split('T')[0]
    conteo[fecha] = (conteo[fecha] || 0) + 1
  })

  console.log('📅 Predicciones por fecha:')
  Object.entries(conteo)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .forEach(([fecha, total]) => {
      console.log(`  ${fecha}: ${total} predicciones`)
    })

  // Verificar última fecha completa
  const ultimaFecha = Object.keys(conteo).sort().reverse()[0]
  console.log(`\n🔍 Analizando fecha más reciente: ${ultimaFecha}`)

  const { data: ultimas } = await supabase
    .from('predicciones')
    .select('sku')
    .gte('fecha_calculo', ultimaFecha)
    .lt('fecha_calculo', ultimaFecha.split('-').map((v,i) => i===2 ? String(Number(v)+1).padStart(2,'0') : v).join('-'))

  const packs = ultimas?.filter(p => p.sku.startsWith('PACK')) || []

  console.log(`  Total: ${ultimas?.length}`)
  console.log(`  SKUs PACK: ${packs.length}`)
  console.log(`  SKUs reales: ${ultimas?.length - packs.length}`)
}

main()
