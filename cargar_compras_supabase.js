require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')

// Función para convertir fecha de Excel a Date
function excelDateToJSDate(excelDate) {
  // Excel fecha base: 1900-01-01 (pero tiene bug, cuenta 1900 como bisiesto)
  const excelEpoch = new Date(1899, 11, 30) // 30 de diciembre de 1899
  const jsDate = new Date(excelEpoch.getTime() + excelDate * 86400000)
  return jsDate.toISOString().split('T')[0] // Retorna YYYY-MM-DD
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  console.log('📦 Cargando datos de compras a Supabase...\n')

  // 1. Leer Excel
  console.log('📊 Leyendo Gestión Full3.xlsm...')
  const workbook = XLSX.readFile('Gestión Full3.xlsm')
  const sheet = workbook.Sheets['compras']
  const data = XLSX.utils.sheet_to_json(sheet)

  console.log(`   ✓ ${data.length} registros leídos`)

  // 2. Transformar datos
  console.log('\n🔄 Transformando datos...')
  const comprasData = data
    .filter(row => row['ITEM NO.'] && row['TOTAL UNITS']) // Filtrar registros válidos
    .map(row => {
      // Convertir fecha de Excel a formato ISO
      let fecha = null
      if (row['Fecha']) {
        if (typeof row['Fecha'] === 'number') {
          fecha = excelDateToJSDate(row['Fecha'])
        } else {
          fecha = row['Fecha'] // Ya es string
        }
      }

      return {
        sku: String(row['ITEM NO.']).trim(),
        fecha: fecha,
        cantidad: parseFloat(row['TOTAL UNITS']) || 0,
        contenedor: row['Contenedor'] ? String(row['Contenedor']).trim() : null,
        precio_unitario: row['UNIT PRICE'] ? parseFloat(row['UNIT PRICE']) : null,
        descripcion: row['DESCRIPTION'] ? String(row['DESCRIPTION']).substring(0, 500) : null
      }
    })
    .filter(c => c.fecha) // Solo registros con fecha válida

  console.log(`   ✓ ${comprasData.length} registros válidos`)

  // Mostrar ejemplos
  console.log('\n📦 Ejemplos de datos a cargar:')
  comprasData.slice(0, 3).forEach((c, i) => {
    console.log(`\n   ${i+1}. SKU: ${c.sku}`)
    console.log(`      Fecha: ${c.fecha}`)
    console.log(`      Cantidad: ${c.cantidad}`)
    console.log(`      Contenedor: ${c.contenedor}`)
  })

  // 3. Limpiar datos antiguos
  console.log('\n\n🗑️  Limpiando datos antiguos...')
  const { error: deleteError } = await supabase
    .from('compras')
    .delete()
    .neq('id', 0) // Eliminar todos

  if (deleteError && !deleteError.message.includes('0 rows')) {
    console.log(`   ⚠️  ${deleteError.message}`)
  } else {
    console.log('   ✓ Limpieza completada')
  }

  // 4. Insertar en lotes
  console.log('\n💾 Insertando datos en Supabase...')
  const batchSize = 100
  let insertados = 0
  let errores = 0

  for (let i = 0; i < comprasData.length; i += batchSize) {
    const batch = comprasData.slice(i, i + batchSize)

    try {
      const { error } = await supabase
        .from('compras')
        .insert(batch)

      if (error) {
        console.log(`   ❌ Error en batch ${Math.floor(i/batchSize) + 1}: ${error.message}`)
        errores += batch.length
      } else {
        insertados += batch.length
        if ((i / batchSize) % 10 === 0) {
          console.log(`   ✓ ${insertados}/${comprasData.length} registros insertados...`)
        }
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`)
      errores += batch.length
    }
  }

  console.log(`\n✅ Proceso completado:`)
  console.log(`   Insertados: ${insertados}`)
  console.log(`   Errores: ${errores}`)

  // 5. Verificar resultado
  console.log('\n🔍 Verificando datos...')
  const { count } = await supabase
    .from('compras')
    .select('*', { count: 'exact', head: true })

  console.log(`   📊 Total registros en BD: ${count}`)

  // Ver estadísticas
  const { data: stats } = await supabase
    .from('compras')
    .select('fecha')
    .order('fecha', { ascending: true })
    .limit(1)

  const { data: statsMax } = await supabase
    .from('compras')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1)

  if (stats && stats.length > 0 && statsMax && statsMax.length > 0) {
    console.log(`\n📅 Rango de fechas:`)
    console.log(`   Desde: ${stats[0].fecha}`)
    console.log(`   Hasta: ${statsMax[0].fecha}`)
  }
}

main()
