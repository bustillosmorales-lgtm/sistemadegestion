const XLSX = require('xlsx')

console.log('📊 Verificando pestañas en ventas.xlsx...\n')

const workbook = XLSX.readFile('ventas.xlsx')

console.log('✅ Pestañas disponibles:')
workbook.SheetNames.forEach((name, i) => {
  console.log(`   ${i+1}. ${name}`)

  const sheet = workbook.Sheets[name]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  if (data.length > 0) {
    console.log(`      Columnas: ${data[0].join(', ')}`)
    console.log(`      Registros: ${data.length - 1}`)
  }
})

// Ver datos de la pestaña Compras si existe
if (workbook.SheetNames.includes('Compras') || workbook.SheetNames.includes('compras')) {
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'compras')
  console.log(`\n\n📦 Datos de la pestaña "${sheetName}":\n`)

  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(sheet)

  console.log(`   Total registros: ${data.length}`)

  if (data.length > 0) {
    console.log('\n   Primeros 5 registros:')
    data.slice(0, 5).forEach((row, i) => {
      console.log(`\n   ${i+1}.`)
      Object.keys(row).forEach(key => {
        console.log(`      ${key}: ${row[key]}`)
      })
    })
  }
}
