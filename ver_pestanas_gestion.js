const XLSX = require('xlsx')

console.log('📊 Verificando pestañas en Gestión Full3.xlsm...\n')

try {
  const workbook = XLSX.readFile('Gestión Full3.xlsm')

  console.log('✅ Pestañas disponibles:')
  workbook.SheetNames.forEach((name, i) => {
    console.log(`   ${i+1}. ${name}`)
  })

  // Ver datos de la pestaña Compras si existe
  const comprasSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('compra'))

  if (comprasSheet) {
    console.log(`\n\n📦 Analizando pestaña "${comprasSheet}":\n`)

    const sheet = workbook.Sheets[comprasSheet]
    const data = XLSX.utils.sheet_to_json(sheet)

    console.log(`   Total registros: ${data.length}`)

    if (data.length > 0) {
      console.log('\n   📋 Columnas disponibles:')
      Object.keys(data[0]).forEach(key => {
        console.log(`      - ${key}`)
      })

      console.log('\n   📦 Primeros 5 registros de compras:')
      data.slice(0, 5).forEach((row, i) => {
        console.log(`\n   ${i+1}. `)

        // Buscar columnas relevantes
        const fechaCol = Object.keys(row).find(k => k.toLowerCase().includes('fecha'))
        const skuCol = Object.keys(row).find(k => k.toLowerCase().includes('sku') || k.toLowerCase().includes('código') || k.toLowerCase().includes('articulo'))
        const cantCol = Object.keys(row).find(k => k.toLowerCase().includes('cantidad') || k.toLowerCase().includes('unidad'))

        if (fechaCol) console.log(`      Fecha: ${row[fechaCol]}`)
        if (skuCol) console.log(`      SKU: ${row[skuCol]}`)
        if (cantCol) console.log(`      Cantidad: ${row[cantCol]}`)

        // Mostrar todas las columnas
        console.log(`      Todos los datos:`)
        Object.keys(row).forEach(key => {
          console.log(`         ${key}: ${row[key]}`)
        })
      })
    }
  } else {
    console.log('\n⚠️  No se encontró pestaña de Compras')
  }
} catch (error) {
  console.error('❌ Error:', error.message)
}
